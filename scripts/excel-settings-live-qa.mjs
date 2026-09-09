import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const baseUrl = (process.env.EXCEL_BASE_URL || 'https://kzone87.github.io/customer-map-planner/').replace(/\/?$/, '/');
const chromePath = process.env.CHROME_PATH;
if (!chromePath) throw new Error('CHROME_PATH is required.');

const evidenceDir = path.resolve('excel-live-qa-artifacts');
fs.mkdirSync(evidenceDir, { recursive: true });
const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();
const runtimeFailures = [];

page.on('pageerror', (error) => runtimeFailures.push(`pageerror ${error.message}`));
page.on('console', (message) => { if (message.type() === 'error') runtimeFailures.push(`console.error ${message.text()}`); });
page.on('requestfailed', (request) => runtimeFailures.push(`requestfailed ${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`));
page.on('response', (response) => { if (response.status() >= 400 && response.url().startsWith(baseUrl)) runtimeFailures.push(`HTTP ${response.status()} ${response.url()}`); });

await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.locator('details').filter({ hasText: '작업순서 저장' }).locator('summary').click();
await page.locator('#trimButton').click();
await page.locator('#emailButton').click();
await page.locator('#recipeName').fill('QA 월간 정리');
await page.locator('#saveRecipeButton').click();

await page.locator('details').filter({ hasText: '내 검사 기준' }).locator('summary').click();
await page.locator('#ruleColumn').selectOption('거래처명');
await page.locator('#ruleKind').selectOption('required');
await page.locator('#addRuleButton').click();

const [settingsDownload] = await Promise.all([
  page.waitForEvent('download'),
  page.locator('#exportSettingsButton').click()
]);
const settingsPath = await settingsDownload.path();
if (!settingsPath) throw new Error('settings export path is unavailable');
const settingsBytes = fs.readFileSync(settingsPath);
const exported = JSON.parse(settingsBytes.toString('utf8'));
if (exported.format !== 'customer-data-workbench-settings' || exported.version !== 1) throw new Error('settings export version contract mismatch');
if (!exported.recipes.some((item) => item.name === 'QA 월간 정리')) throw new Error('saved recipe is missing from settings export');
if (!exported.rules.some((item) => item.column === '거래처명' && item.kind === 'required')) throw new Error('saved rule is missing from settings export');

page.once('dialog', (dialog) => dialog.accept());
const clearNavigation = page.waitForNavigation({ waitUntil: 'networkidle' });
await page.locator('#clearSettingsButton').click();
await clearNavigation;
if ((await page.locator('#recipeSelect option').count()) !== 1) throw new Error('settings clear did not remove saved recipes');

const importNavigation = page.waitForNavigation({ waitUntil: 'networkidle' });
await page.locator('#importSettingsInput').setInputFiles({ name: 'qa-settings.json', mimeType: 'application/json', buffer: settingsBytes });
await importNavigation;
await page.waitForFunction(() => document.querySelectorAll('#recipeSelect option').length > 1);
if (!(await page.locator('#recipeSelect').innerText()).includes('QA 월간 정리')) throw new Error('settings import did not restore saved recipe');

await page.locator('details').filter({ hasText: '내 검사 기준' }).locator('summary').click();
if (!(await page.locator('#ruleList').innerText()).includes('거래처명')) throw new Error('settings import did not restore saved validation rule');

const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
if (overflow > 1) throw new Error(`settings workflow horizontal overflow ${overflow}px`);
if (runtimeFailures.length) throw new Error(`settings workflow runtime failures: ${runtimeFailures.join(' | ')}`);
await page.screenshot({ path: path.join(evidenceDir, 'settings-portability-desktop.png'), fullPage: true });
console.log('PASS settings save -> JSON export -> clear -> JSON import -> restore');

await context.close();
await browser.close();
console.log('EXCEL SETTINGS LIVE QA: PASS');
