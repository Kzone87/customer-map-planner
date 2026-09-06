import './compare.css';
import { exportCsv, exportXlsx, getColumns, parseFile, type DataRow } from './data';
import { changeReportRows, compareDatasets, sharedColumns, type CompareEntry, type CompareResult, type CompareStatus } from './compare';

let beforeRows: DataRow[] = [];
let afterRows: DataRow[] = [];
let result: CompareResult | null = null;

const STATUS_LABELS: Record<CompareStatus, string> = {
  ADDED: '새로 추가',
  REMOVED: '삭제됨',
  CHANGED: '값 변경',
  UNCHANGED: '변화 없음'
};

const beforeFile = document.querySelector<HTMLInputElement>('#before-file')!;
const afterFile = document.querySelector<HTMLInputElement>('#after-file')!;
const beforeMeta = document.querySelector<HTMLElement>('#before-meta')!;
const afterMeta = document.querySelector<HTMLElement>('#after-meta')!;
const keyColumn = document.querySelector<HTMLSelectElement>('#key-column')!;
const compareButton = document.querySelector<HTMLButtonElement>('#compare-button')!;
const statusMessage = document.querySelector<HTMLElement>('#status-message')!;
const resultSection = document.querySelector<HTMLElement>('#result-section')!;
const resultBody = document.querySelector<HTMLTableSectionElement>('#result-body')!;
const statusFilter = document.querySelector<HTMLSelectElement>('#status-filter')!;

function meta(rows: DataRow[], name: string): string {
  return `${name} · ${rows.length.toLocaleString('ko-KR')}행 · ${getColumns(rows).length}개 항목`;
}

function friendlyError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replaceAll('key', '구분값')
    .replaceAll('Key', '구분값')
    .replaceAll('키', '구분값')
    .replaceAll('컬럼', '항목')
    .replaceAll('column', '항목')
    .trim() || '두 파일을 비교하지 못했습니다. 파일과 구분 기준을 확인해 주세요.';
}

function setStatus(message: string, error = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle('error', error);
}

function refreshKeys() {
  const columns = sharedColumns(beforeRows, afterRows);
  keyColumn.replaceChildren();
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = columns.length ? '같은 행을 구분할 항목 선택' : '두 파일에 공통으로 있는 항목이 없습니다.';
  keyColumn.append(placeholder);
  for (const column of columns) {
    const option = document.createElement('option');
    option.value = column;
    option.textContent = column;
    keyColumn.append(option);
  }
  compareButton.disabled = columns.length === 0;
  result = null;
  resultSection.hidden = true;
}

async function loadFile(file: File | undefined, side: 'before' | 'after') {
  if (!file) return;
  setStatus('파일을 읽는 중입니다.');
  try {
    const rows = await parseFile(file);
    if (side === 'before') {
      beforeRows = rows;
      beforeMeta.textContent = meta(rows, file.name);
    } else {
      afterRows = rows;
      afterMeta.textContent = meta(rows, file.name);
    }
    refreshKeys();
    setStatus(beforeRows.length && afterRows.length ? '두 파일을 불러왔습니다. 같은 행을 구분할 항목을 선택하세요.' : '비교할 다른 파일도 선택하세요.');
  } catch (error) {
    if (side === 'before') beforeRows = [];
    else afterRows = [];
    refreshKeys();
    setStatus(friendlyError(error), true);
  }
}

function cell(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function valuesFor(entry: CompareEntry, side: 'before' | 'after'): string {
  const row = side === 'before' ? entry.before : entry.after;
  if (!row) return '—';
  if (!entry.changedColumns.length) return entry.status === 'ADDED' || entry.status === 'REMOVED' ? '행 전체' : '변경 없음';
  return entry.changedColumns.map((column) => `${column}: ${cell(row[column])}`).join(' / ');
}

function td(text: string, className = '') {
  const node = document.createElement('td');
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function renderRows() {
  resultBody.replaceChildren();
  if (!result) return;
  const filter = statusFilter.value as CompareStatus | 'ALL';
  const entries = result.entries.filter((entry) => filter === 'ALL' || entry.status === filter);
  for (const entry of entries) {
    const tr = document.createElement('tr');
    tr.append(
      td(STATUS_LABELS[entry.status], `status-cell ${entry.status.toLowerCase()}`),
      td(entry.key, 'key-cell'),
      td(entry.changedColumns.join(', ') || '—'),
      td(valuesFor(entry, 'before')),
      td(valuesFor(entry, 'after'))
    );
    resultBody.append(tr);
  }
  if (!entries.length) {
    const tr = document.createElement('tr');
    const empty = td('선택한 조건에 해당하는 결과가 없습니다.', 'empty-row');
    empty.colSpan = 5;
    tr.append(empty);
    resultBody.append(tr);
  }
}

function renderResult(next: CompareResult) {
  result = next;
  document.querySelector<HTMLElement>('#added-count')!.textContent = String(next.summary.added);
  document.querySelector<HTMLElement>('#removed-count')!.textContent = String(next.summary.removed);
  document.querySelector<HTMLElement>('#changed-count')!.textContent = String(next.summary.changed);
  document.querySelector<HTMLElement>('#unchanged-count')!.textContent = String(next.summary.unchanged);
  resultSection.hidden = false;
  statusFilter.value = 'ALL';
  renderRows();
  setStatus(`총 ${next.summary.total.toLocaleString('ko-KR')}개 행을 비교했습니다. 바뀐 내용은 파일로 저장할 수 있습니다.`);
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

beforeFile.addEventListener('change', () => void loadFile(beforeFile.files?.[0], 'before'));
afterFile.addEventListener('change', () => void loadFile(afterFile.files?.[0], 'after'));

compareButton.addEventListener('click', () => {
  try {
    const next = compareDatasets(beforeRows, afterRows, keyColumn.value);
    renderResult(next);
  } catch (error) {
    result = null;
    resultSection.hidden = true;
    setStatus(friendlyError(error), true);
  }
});

statusFilter.addEventListener('change', renderRows);

document.querySelector<HTMLButtonElement>('#export-csv')!.addEventListener('click', () => {
  if (!result) return;
  download(exportCsv(changeReportRows(result)), '파일-변경목록.csv');
});

document.querySelector<HTMLButtonElement>('#export-xlsx')!.addEventListener('click', () => {
  if (!result) return;
  download(exportXlsx(changeReportRows(result)), '파일-변경목록.xlsx');
});
