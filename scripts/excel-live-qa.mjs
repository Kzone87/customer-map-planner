import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import * as XLSX from 'xlsx';

const baseUrl = (process.env.EXCEL_BASE_URL || 'https://kzone87.github.io/customer-map-planner/').replace(/\/?$/, '/');
const chromePath = process.env.CHROME_PATH;
if (!chromePath) throw new Error('CHROME_PATH is required.');

const evidenceDir = path.resolve('excel-live-qa-artifacts');
fs.rmSync(evidenceDir, { recursive: true, force: true });
fs.mkdirSync(evidenceDir, { recursive: true });

const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--no-sandbox'] });
const failures = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function workbookBuffer() {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['설명'],
    ['이 시트는 안내용입니다.']
  ]), '안내');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['고객번호', '거래처명', '이메일'],
    ['C001', '가람상사', 'SALES@GARAM.CO.KR'],
    ['C002', '한빛유통', 'hello@hanbit.kr']
  ]), '거래처');
  return Buffer.from(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }));
}

function attachDiagnostics(page, label) {
  const localFailures = [];
  const record = (message) => {
    localFailures.push(message);
    failures.push(`${label}: ${message}`);
  };
  page.on('pageerror', (error) => record(`pageerror ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') record(`console.error ${message.text()}`); });
  page.on('requestfailed', (request) => record(`requestfailed ${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`));
  page.on('response', (response) => {
    if (response.status() >= 400 && response.url().startsWith(baseUrl)) record(`HTTP ${response.status()} ${response.url()}`);
  });
  return localFailures;
}

async function assertNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(overflow <= 1, `${label}: horizontal overflow ${overflow}px`);
}

const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 }
];

const screens = [
  { name: 'cleanup', path: '' },
  { name: 'mapping', path: 'mapping.html' },
  { name: 'compare', path: 'compare.html' },
  { name: 'batch', path: 'batch.html' }
];

for (const screen of screens) {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, acceptDownloads: true });
    const page = await context.newPage();
    const label = `${screen.name} ${viewport.width}x${viewport.height}`;
    const localFailures = attachDiagnostics(page, label);
    await page.goto(new URL(screen.path, baseUrl).href, { waitUntil: 'networkidle' });
    assert((await page.locator('body').innerText()).trim().length > 80, `${label}: page body is unexpectedly empty`);
    await assertNoHorizontalOverflow(page, label);
    await page.screenshot({ path: path.join(evidenceDir, `${screen.name}-${viewport.name}.png`), fullPage: true });
    assert(localFailures.length === 0, `${label}: runtime/network failures detected`);
    console.log(`PASS render ${label}`);
    await context.close();
  }
}

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage();
  const localFailures = attachDiagnostics(page, 'cleanup workflow');
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  const csv = Buffer.from('\ufeff거래처명,이메일,연락처\n  가람상사  ,SALES@GARAM.CO.KR,01012345678\n한빛유통,invalid-mail,021234567\n  가람상사  ,SALES@GARAM.CO.KR,01012345678\n', 'utf8');
  await page.locator('#fileInput').setInputFiles({ name: 'qa-customers.csv', mimeType: 'text/csv', buffer: csv });
  await page.waitForFunction(() => document.querySelector('#sourceName')?.textContent?.includes('qa-customers.csv'));
  assert((await page.locator('#rowCount').textContent()) === '3', 'cleanup workflow: CSV row count mismatch');
  await page.locator('#trimButton').click();
  await page.locator('#emailButton').click();
  await page.locator('#phoneButton').click();
  await page.locator('#dedupeButton').click();
  assert((await page.locator('#rowCount').textContent()) === '2', 'cleanup workflow: dedupe did not remove the duplicate row');

  const [xlsxDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#exportXlsxButton').click()
  ]);
  assert((await xlsxDownload.suggestedFilename()).endsWith('.xlsx'), 'cleanup workflow: XLSX export did not start');

  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#fileInput').setInputFiles({
    name: 'qa-multi-sheet.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: workbookBuffer()
  });
  const dialog = page.locator('#workbook-sheet-dialog');
  await dialog.waitFor({ state: 'visible' });
  assert(await page.locator('#workbook-sheet-select option').count() === 2, 'cleanup workflow: multi-sheet selector did not list both worksheets');
  await page.locator('#workbook-sheet-select').selectOption('거래처');
  await page.getByRole('button', { name: '이 시트 사용' }).click();
  await page.waitForFunction(() => document.querySelector('#sourceName')?.textContent?.includes('qa-multi-sheet.xlsx'));
  assert((await page.locator('#rowCount').textContent()) === '2', 'cleanup workflow: selected worksheet row count mismatch');
  assert((await page.locator('#tableBody').innerText()).includes('C001'), 'cleanup workflow: selected worksheet data was not rendered');
  assert(!(await page.locator('#tableBody').innerText()).includes('이 시트는 안내용입니다.'), 'cleanup workflow: wrong worksheet was silently imported');
  assert(localFailures.length === 0, 'cleanup workflow: runtime/network failures detected');
  console.log('PASS cleanup actual CSV -> operations -> XLSX download -> multi-sheet selection');
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage();
  const localFailures = attachDiagnostics(page, 'mapping workflow');
  await page.goto(new URL('mapping.html', baseUrl).href, { waitUntil: 'networkidle' });
  await page.locator('#mappingSample').click();
  await page.locator('#mappingSourceColumn').selectOption('거래처명');
  await page.locator('#mappingTargetColumn').fill('고객사명');
  await page.locator('#mappingAdd').click();
  await page.locator('#mappingApply').click();
  assert((await page.locator('#mappingHead').innerText()).includes('고객사명'), 'mapping workflow: mapped header is missing');
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#mappingXlsx').click()]);
  assert((await download.suggestedFilename()).endsWith('.xlsx'), 'mapping workflow: XLSX export did not start');
  assert(localFailures.length === 0, 'mapping workflow: runtime/network failures detected');
  console.log('PASS mapping sample -> rename -> apply -> XLSX download');
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage();
  const localFailures = attachDiagnostics(page, 'compare workflow');
  await page.goto(new URL('compare.html', baseUrl).href, { waitUntil: 'networkidle' });
  await page.locator('#compare-sample').click();
  await page.locator('#result-section').waitFor({ state: 'visible' });
  assert((await page.locator('#added-count').textContent()) === '1', 'compare workflow: added summary mismatch');
  assert((await page.locator('#removed-count').textContent()) === '1', 'compare workflow: removed summary mismatch');
  assert((await page.locator('#changed-count').textContent()) === '2', 'compare workflow: changed summary mismatch');
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#export-xlsx').click()]);
  assert((await download.suggestedFilename()).endsWith('.xlsx'), 'compare workflow: XLSX export did not start');
  assert(localFailures.length === 0, 'compare workflow: runtime/network failures detected');
  console.log('PASS compare sample -> diff summary -> XLSX download');
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage();
  const localFailures = attachDiagnostics(page, 'batch workflow');
  await page.goto(new URL('batch.html', baseUrl).href, { waitUntil: 'networkidle' });
  await page.locator('#sampleBatch').click();
  assert((await page.locator('#metricTotal').textContent()) === '3', 'batch workflow: sample did not process three files');
  assert(await page.locator('#resultBody tr').count() === 3, 'batch workflow: result table row count mismatch');
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#reportCsv').click()]);
  assert((await download.suggestedFilename()).endsWith('.csv'), 'batch workflow: result report download did not start');
  assert(localFailures.length === 0, 'batch workflow: runtime/network failures detected');
  console.log('PASS batch sample -> per-file results -> report CSV download');
  await context.close();
}

await browser.close();
if (failures.length) {
  console.error('\nEXCEL LIVE QA FAILURES');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log('\nEXCEL WORKBENCH LIVE QA: PASS');
}
