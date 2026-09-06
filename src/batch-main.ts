import './batch.css';
import { DataRow, exportCsv, exportXlsx, parseFile } from './data';
import { buildMigrationReport, runBatch, sanitizeWorkflowPreset, BatchResult, WorkflowPreset } from './workflow';

const presetJson = document.querySelector<HTMLTextAreaElement>('#presetJson')!;
const presetFile = document.querySelector<HTMLInputElement>('#presetFile')!;
const batchFiles = document.querySelector<HTMLInputElement>('#batchFiles')!;
const presetStatus = document.querySelector<HTMLElement>('#presetStatus')!;
const batchStatus = document.querySelector<HTMLElement>('#batchStatus')!;
const resultBody = document.querySelector<HTMLTableSectionElement>('#resultBody')!;
const progressBar = document.querySelector<HTMLElement>('#progressBar')!;
const reportCsv = document.querySelector<HTMLButtonElement>('#reportCsv')!;
const combinedXlsx = document.querySelector<HTMLButtonElement>('#combinedXlsx')!;

const samplePreset: WorkflowPreset = {
  version: 1,
  name: 'ERP customer migration',
  mappings: [
    { source: '거래처명', target: 'company' },
    { source: '이메일', target: 'email' },
    { source: '연락처', target: 'phone' }
  ],
  operations: ['trim', 'email', 'phone', 'dedupe'],
  rules: [
    { id: 'company-required', column: 'company', kind: 'required' },
    { id: 'email-format', column: 'email', kind: 'email' }
  ],
  targetColumns: ['company', 'email', 'phone', '지역', '상태']
};

let lastResults: BatchResult[] = [];

function setSamplePreset() {
  presetJson.value = JSON.stringify(samplePreset, null, 2);
  presetStatus.textContent = '샘플 Preset을 불러왔습니다. 입력 파일 컬럼에 맞게 수정할 수 있습니다.';
}

function parsePreset(): WorkflowPreset {
  let parsed: unknown;
  try {
    parsed = JSON.parse(presetJson.value);
  } catch {
    throw new Error('Preset JSON 문법을 확인해 주세요.');
  }
  return sanitizeWorkflowPreset(parsed);
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function updateMetrics(results: BatchResult[]) {
  document.querySelector<HTMLElement>('#metricTotal')!.textContent = String(results.length);
  document.querySelector<HTMLElement>('#metricSuccess')!.textContent = String(results.filter((item) => item.status === 'SUCCESS').length);
  document.querySelector<HTMLElement>('#metricValidation')!.textContent = String(results.filter((item) => item.status === 'VALIDATION_FAILED').length);
  document.querySelector<HTMLElement>('#metricError')!.textContent = String(results.filter((item) => item.status === 'ERROR').length);
}

function renderResults(results: BatchResult[]) {
  resultBody.replaceChildren();
  results.forEach((result) => {
    const row = document.createElement('tr');
    const cells = [result.name, result.status, String(result.rows.length), String(result.issues.length), result.error ?? ''];
    cells.forEach((value, index) => {
      const cell = document.createElement('td');
      cell.textContent = value;
      if (index === 1) cell.dataset.status = result.status;
      row.appendChild(cell);
    });
    resultBody.appendChild(row);
  });
  updateMetrics(results);
  reportCsv.disabled = results.length === 0;
  combinedXlsx.disabled = !results.some((item) => item.status === 'SUCCESS');
}

async function readFiles(files: File[]) {
  const items: { name: string; rows: DataRow[] }[] = [];
  const parseErrors: BatchResult[] = [];
  for (const [index, file] of files.entries()) {
    progressBar.style.width = `${Math.round((index / Math.max(files.length, 1)) * 55)}%`;
    batchStatus.textContent = `${index + 1}/${files.length} 파일 읽는 중: ${file.name}`;
    try {
      items.push({ name: file.name, rows: await parseFile(file) });
    } catch (error) {
      parseErrors.push({
        name: file.name,
        status: 'ERROR',
        rows: [],
        issues: [],
        error: error instanceof Error ? error.message : String(error)
      });
    }
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  }
  return { items, parseErrors };
}

async function executeBatch() {
  const files = [...(batchFiles.files ?? [])];
  if (!files.length) {
    batchStatus.textContent = '처리할 XLSX/XLS/CSV 파일을 1개 이상 선택해 주세요.';
    return;
  }
  let preset: WorkflowPreset;
  try {
    preset = parsePreset();
    presetStatus.textContent = `Preset 확인 완료: ${preset.name}`;
  } catch (error) {
    presetStatus.textContent = error instanceof Error ? error.message : String(error);
    return;
  }

  progressBar.style.width = '2%';
  batchStatus.textContent = 'Batch Migration을 준비하고 있습니다.';
  const { items, parseErrors } = await readFiles(files);
  progressBar.style.width = '65%';
  await new Promise((resolve) => window.setTimeout(resolve, 0));
  const workflowResults = runBatch(items, preset);
  lastResults = [...workflowResults, ...parseErrors];
  progressBar.style.width = '100%';
  renderResults(lastResults);
  const success = lastResults.filter((item) => item.status === 'SUCCESS').length;
  const validation = lastResults.filter((item) => item.status === 'VALIDATION_FAILED').length;
  const errors = lastResults.filter((item) => item.status === 'ERROR').length;
  batchStatus.textContent = `완료 · 정상 ${success} · 검증필요 ${validation} · 오류 ${errors}`;
}

document.querySelector<HTMLButtonElement>('#samplePreset')!.addEventListener('click', setSamplePreset);
document.querySelector<HTMLButtonElement>('#runBatch')!.addEventListener('click', () => void executeBatch());

document.querySelector<HTMLButtonElement>('#presetExport')!.addEventListener('click', () => {
  try {
    const preset = parsePreset();
    download(new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json;charset=utf-8' }), 'customer-data-workflow-preset.json');
    presetStatus.textContent = '검증된 Preset JSON을 내보냈습니다.';
  } catch (error) {
    presetStatus.textContent = error instanceof Error ? error.message : String(error);
  }
});

presetFile.addEventListener('change', async () => {
  const file = presetFile.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const preset = sanitizeWorkflowPreset(JSON.parse(text));
    presetJson.value = JSON.stringify(preset, null, 2);
    presetStatus.textContent = `Preset Import 완료: ${preset.name}`;
  } catch (error) {
    presetStatus.textContent = error instanceof Error ? error.message : 'Preset을 읽지 못했습니다.';
  }
});

reportCsv.addEventListener('click', () => {
  const report = buildMigrationReport(lastResults) as unknown as DataRow[];
  download(exportCsv(report), 'migration-report.csv');
});

combinedXlsx.addEventListener('click', () => {
  const combined: DataRow[] = lastResults
    .filter((result) => result.status === 'SUCCESS')
    .flatMap((result) => result.rows.map((row) => ({ __source_file: result.name, ...row })));
  if (!combined.length) return;
  download(exportXlsx(combined), 'migration-success-results.xlsx');
});

setSamplePreset();
renderResults([]);