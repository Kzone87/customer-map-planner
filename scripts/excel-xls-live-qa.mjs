import { chromium } from 'playwright-core';
import * as XLSX from 'xlsx';

const baseUrl = (process.env.EXCEL_BASE_URL || 'https://kzone87.github.io/customer-map-planner/').replace(/\/?$/, '/');
const chromePath = process.env.CHROME_PATH;
if (!chromePath) throw new Error('CHROME_PATH is required.');

const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
  ['고객번호', '거래처명', '연락처'],
  ['L001', '대한상사', '01012345678'],
  ['L002', '서울유통', '0212345678']
]), '거래처');
const xls = Buffer.from(XLSX.write(workbook, { type: 'array', bookType: 'xls' }));

const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();
const failures = [];
page.on('pageerror', (error) => failures.push(`pageerror ${error.message}`));
page.on('console', (message) => { if (message.type() === 'error') failures.push(`console.error ${message.text()}`); });
page.on('requestfailed', (request) => failures.push(`requestfailed ${request.url()} ${request.failure()?.errorText || ''}`));
page.on('response', (response) => { if (response.status() >= 400 && response.url().startsWith(baseUrl)) failures.push(`HTTP ${response.status()} ${response.url()}`); });

await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.locator('#fileInput').setInputFiles({
  name: 'qa-legacy-korean.xls',
  mimeType: 'application/vnd.ms-excel',
  buffer: xls
});
await page.waitForFunction(() => document.querySelector('#sourceName')?.textContent?.includes('qa-legacy-korean.xls'));
if ((await page.locator('#rowCount').textContent()) !== '2') throw new Error('XLS row count mismatch');
const table = await page.locator('#tableBody').innerText();
if (!table.includes('L001') || !table.includes('대한상사') || !table.includes('서울유통')) throw new Error(`XLS Korean data mismatch: ${table}`);
await page.locator('#phoneButton').click();
if (!(await page.locator('#tableBody').innerText()).includes('010-1234-5678')) throw new Error('XLS cleanup operation did not run');
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
if (overflow > 1) throw new Error(`XLS workflow horizontal overflow ${overflow}px`);
if (failures.length) throw new Error(`XLS runtime failures: ${failures.join(' | ')}`);
console.log('PASS legacy XLS Korean import -> render -> cleanup');

await context.close();
await browser.close();
console.log('EXCEL XLS LIVE QA: PASS');
