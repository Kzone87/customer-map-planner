import './batch.css';
import { DataRow, exportCsv, exportXlsx, parseFile, SAMPLE_ROWS } from './data';
import { buildMigrationReport, runBatch, BatchResult, WorkflowPreset } from './workflow';

const presetName = document.querySelector<HTMLInputElement>('#presetName')!;
const mappingSource = document.querySelector<HTMLInputElement>('#mappingSource')!;
const mappingTarget = document.querySelector<HTMLInputElement>('#mappingTarget')!;
const requiredColumn = document.querySelector<HTMLInputElement>('#requiredColumn')!;
const emailColumn = document.querySelector<HTMLInputElement>('#emailColumn')!;
const targetColumns = document.querySelector<HTMLInputElement>('#targetColumns')!;
const batchFiles = document.querySelector<HTMLInputElement>('#batchFiles')!;
const presetStatus = document.querySelector<HTMLElement>('#presetStatus')!;
const batchStatus = document.querySelector<HTMLElement>('#batchStatus')!;
const resultBody = document.querySelector<HTMLTableSectionElement>('#resultBody')!;
const progressBar = document.querySelector<HTMLElement>('#progressBar')!;
const reportCsv = document.querySelector<HTMLButtonElement>('#reportCsv')!;
const combinedXlsx = document.querySelector<HTMLButtonElement>('#combinedXlsx')!;

const STATUS_LABELS: Record<BatchResult['status'], string> = {
  SUCCESS: '정상 완료',
  VALIDATION_FAILED: '확인 필요',
  ERROR: '처리 실패'
};

let lastResults: BatchResult[] = [];

function checked(id: string): boolean {
  return document.querySelector<HTMLInputElement>(`#${id}`)!.checked;
}

function buildPresetFromForm(): WorkflowPreset {
  const name = presetName.value.trim();
  if (!name) throw new Error('작업 이름을 입력해 주세요.');

  const source = mappingSource.value.trim();
  const target = mappingTarget.value.trim();
  if ((source && !target) || (!source && target)) {
    throw new Error('항목 이름을 바꾸려면 원본 이름과 새 이름을 모두 입력해 주세요.');
  }

  const operations: WorkflowPreset['operations'] = [];
  if (checked('opTrim')) operations.push('trim');
  if (checked('opEmail')) operations.push('email');
  if (checked('opPhone')) operations.push('phone');
  if (checked('opDedupe')) operations.push('dedupe');

  const rules: WorkflowPreset['rules'] = [];
  const required = requiredColumn.value.trim();
  const email = emailColumn.value.trim();
  if (required) rules.push({ id: 'required-field', column: required, kind: 'required' });
  if (email) rules.push({ id: 'email-field', column: email, kind: 'email' });

  const outputColumns = targetColumns.value
    .split(',')
    .map((value) => value.trim())
    .filter((value, index, values) => value && values.indexOf(value) === index);

  return {
    version: 1,
    name,
    mappings: source && target ? [{ source, target }] : [],
    operations,
    rules,
    targetColumns: outputColumns
  };
}

function friendlyError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replaceAll('Preset', '작업 규칙')
    .replaceAll('preset', '작업 규칙')
    .replaceAll('JSON', '설정값')
    .replaceAll('컬럼', '항목')
    .replaceAll('스키마', '결과 형식')
    .replace(/\s*\n\s*/g, ' · ')
    .trim() || '파일을 처리하지 못했습니다. 입력 파일과 작업 기준을 확인해 주세요.';
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
    const cells = [
      result.name,
      STATUS_LABELS[result.status],
      String(result.rows.length),
      String(result.issues.length),
      result.error ? friendlyError(result.error) : result.issues.length ? '입력값을 확인해 주세요.' : '완료'
    ];
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
    batchStatus.textContent = `${index + 1}/${files.length} 파일 읽는 중 · ${file.name}`;
    try {
      items.push({ name: file.name, rows: await parseFile(file) });
    } catch (error) {
      parseErrors.push({ name: file.name, status: 'ERROR', rows: [], issues: [], error: friendlyError(error) });
    }
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  }
  return { items, parseErrors };
}

function finish(results: BatchResult[]) {
  lastResults = results;
  progressBar.style.width = '100%';
  renderResults(lastResults);
  const success = lastResults.filter((item) => item.status === 'SUCCESS').length;
  const validation = lastResults.filter((item) => item.status === 'VALIDATION_FAILED').length;
  const errors = lastResults.filter((item) => item.status === 'ERROR').length;
  batchStatus.textContent = `완료 · 정상 ${success}개 · 확인 필요 ${validation}개 · 처리 실패 ${errors}개`;
}

async function executeBatch() {
  const files = [...(batchFiles.files ?? [])];
  if (!files.length) {
    batchStatus.textContent = '정리할 Excel 또는 CSV 파일을 1개 이상 선택해 주세요.';
    return;
  }
  let preset: WorkflowPreset;
  try {
    preset = buildPresetFromForm();
    presetStatus.textContent = `적용할 작업: ${preset.name}`;
  } catch (error) {
    presetStatus.textContent = friendlyError(error);
    return;
  }

  progressBar.style.width = '2%';
  batchStatus.textContent = '파일 정리를 준비하고 있습니다.';
  const { items, parseErrors } = await readFiles(files);
  progressBar.style.width = '65%';
  await new Promise((resolve) => window.setTimeout(resolve, 0));
  finish([...runBatch(items, preset), ...parseErrors]);
}

function runSampleBatch() {
  presetName.value = '거래처 파일 정리';
  mappingSource.value = '';
  mappingTarget.value = '';
  requiredColumn.value = '거래처명';
  emailColumn.value = '이메일';
  targetColumns.value = '';
  const preset = buildPresetFromForm();
  const samples = [
    { name: '서울_거래처_8월.xlsx', rows: SAMPLE_ROWS.map((row) => ({ ...row })) },
    { name: '경기_거래처_8월.xlsx', rows: SAMPLE_ROWS.slice(1).map((row) => ({ ...row })) },
    { name: '신규_거래처_8월.csv', rows: SAMPLE_ROWS.slice(0, 4).map((row) => ({ ...row })) }
  ];
  presetStatus.textContent = '샘플용 거래처 정리 기준을 적용했습니다.';
  progressBar.style.width = '65%';
  finish(runBatch(samples, preset));
}

document.querySelector<HTMLButtonElement>('#runBatch')!.addEventListener('click', () => void executeBatch());
document.querySelector<HTMLButtonElement>('#sampleBatch')!.addEventListener('click', runSampleBatch);

reportCsv.addEventListener('click', () => {
  const report = buildMigrationReport(lastResults) as unknown as DataRow[];
  download(exportCsv(report), '파일-처리-결과.csv');
});

combinedXlsx.addEventListener('click', () => {
  const combined: DataRow[] = lastResults
    .filter((result) => result.status === 'SUCCESS')
    .flatMap((result) => result.rows.map((row) => ({ 출처파일: result.name, ...row })));
  if (!combined.length) return;
  download(exportXlsx(combined), '정상-처리-통합.xlsx');
});

presetStatus.textContent = '필요한 정리 작업을 체크한 뒤 파일을 선택하세요.';
renderResults([]);