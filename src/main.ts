import './styles.css';
import {
  applyOperation,
  DataProfile,
  DataRow,
  exportCsv,
  exportXlsx,
  getColumns,
  isOperationKind,
  matchesQuery,
  Operation,
  OperationKind,
  operationLabel,
  parseFile,
  profileRows,
  SAMPLE_ROWS
} from './data';
import {
  buildIssueReportRows,
  exportIssueReportCsv,
  IssueFilter
} from './report';

type Snapshot = {
  rows: DataRow[];
  operations: Operation[];
  label: string;
};

type SavedRecipe = {
  name: string;
  operations: OperationKind[];
};

const RECIPE_KEY = 'customer-data-workbench-recipes-v1';
const PAGE_SIZE = 50;

const state = {
  sourceName: '샘플 데이터',
  originalRows: SAMPLE_ROWS.map((row) => ({ ...row })),
  rows: SAMPLE_ROWS.map((row) => ({ ...row })),
  history: [] as Snapshot[],
  future: [] as Snapshot[],
  operations: [] as Operation[],
  query: '',
  page: 0,
  issueFilter: 'all' as IssueFilter
};

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element: ${id}`);
  return element as T;
}

const elements = {
  file: byId<HTMLInputElement>('fileInput'),
  sourceName: byId<HTMLElement>('sourceName'),
  sourceMeta: byId<HTMLElement>('sourceMeta'),
  status: byId<HTMLElement>('status'),
  search: byId<HTMLInputElement>('searchInput'),
  tableHead: byId<HTMLTableSectionElement>('tableHead'),
  tableBody: byId<HTMLTableSectionElement>('tableBody'),
  rowCount: byId<HTMLElement>('rowCount'),
  columnCount: byId<HTMLElement>('columnCount'),
  issueCount: byId<HTMLElement>('issueCount'),
  duplicateCount: byId<HTMLElement>('duplicateCount'),
  qualityList: byId<HTMLElement>('qualityList'),
  operationList: byId<HTMLElement>('operationList'),
  prev: byId<HTMLButtonElement>('prevPage'),
  next: byId<HTMLButtonElement>('nextPage'),
  pageLabel: byId<HTMLElement>('pageLabel'),
  recipeName: byId<HTMLInputElement>('recipeName'),
  recipeSelect: byId<HTMLSelectElement>('recipeSelect'),
  issueFilter: byId<HTMLSelectElement>('issueFilter'),
  issueReport: byId<HTMLButtonElement>('issueReportButton')
};

function cloneRows(rows: DataRow[]): DataRow[] {
  return rows.map((row) => ({ ...row }));
}

function cloneOperations(operations: Operation[]): Operation[] {
  return operations.map((operation) => ({ ...operation }));
}

function currentSnapshot(label: string): Snapshot {
  return {
    rows: cloneRows(state.rows),
    operations: cloneOperations(state.operations),
    label
  };
}

function restoreSnapshot(snapshot: Snapshot) {
  state.rows = cloneRows(snapshot.rows);
  state.operations = cloneOperations(snapshot.operations);
  state.page = 0;
}

function setStatus(message: string, kind: 'info' | 'success' | 'error' = 'info') {
  elements.status.textContent = message;
  elements.status.dataset.kind = kind;
}

function pushHistory(label: string) {
  state.history.push(currentSnapshot(label));
  if (state.history.length > 30) state.history.shift();
  state.future = [];
}

function runOperation(kind: OperationKind) {
  pushHistory(operationLabel(kind));
  state.rows = applyOperation(state.rows, kind);
  state.operations.push({ kind, label: operationLabel(kind) });
  state.page = 0;
  render();
  setStatus(`${operationLabel(kind)} 작업을 적용했습니다.`, 'success');
}

function undo() {
  const previous = state.history.pop();
  if (!previous) return;
  state.future.push(currentSnapshot(previous.label));
  restoreSnapshot(previous);
  render();
  setStatus(`실행 취소: ${previous.label}`);
}

function redo() {
  const next = state.future.pop();
  if (!next) return;
  state.history.push(currentSnapshot(next.label));
  restoreSnapshot(next);
  render();
  setStatus(`다시 실행: ${next.label}`);
}

function resetDataset() {
  state.rows = cloneRows(state.originalRows);
  state.history = [];
  state.future = [];
  state.operations = [];
  state.page = 0;
  state.query = '';
  elements.search.value = '';
  render();
  setStatus('원본 데이터 상태로 되돌렸습니다.');
}

function loadRows(rows: DataRow[], sourceName: string) {
  state.sourceName = sourceName;
  state.originalRows = cloneRows(rows);
  state.rows = cloneRows(rows);
  state.history = [];
  state.future = [];
  state.operations = [];
  state.query = '';
  state.page = 0;
  elements.search.value = '';
  render();
  setStatus(`${sourceName}에서 ${rows.length.toLocaleString()}행을 불러왔습니다.`, 'success');
}

function getFilteredRows() {
  return state.rows.filter((row) => matchesQuery(row, state.query));
}

function createCell(value: unknown) {
  const cell = document.createElement('td');
  const text = value === null || value === undefined ? '' : String(value);
  cell.textContent = text;
  if (!text.trim()) cell.classList.add('empty-cell');
  return cell;
}

function renderTable(profile: DataProfile) {
  const columns = getColumns(state.rows);
  const filtered = getFilteredRows();
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  state.page = Math.min(state.page, pageCount - 1);
  const start = state.page * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);

  const headerRow = document.createElement('tr');
  const no = document.createElement('th');
  no.textContent = '#';
  headerRow.appendChild(no);
  columns.forEach((column) => {
    const th = document.createElement('th');
    th.textContent = column;
    headerRow.appendChild(th);
  });
  elements.tableHead.replaceChildren(headerRow);

  const fragment = document.createDocumentFragment();
  if (pageRows.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = columns.length + 1;
    cell.className = 'empty-state';
    cell.textContent = '조건에 맞는 데이터가 없습니다.';
    row.appendChild(cell);
    fragment.appendChild(row);
  } else {
    pageRows.forEach((rowData, index) => {
      const row = document.createElement('tr');
      const number = document.createElement('td');
      number.className = 'row-number';
      number.textContent = String(start + index + 1);
      row.appendChild(number);
      columns.forEach((column) => row.appendChild(createCell(rowData[column])));
      fragment.appendChild(row);
    });
  }
  elements.tableBody.replaceChildren(fragment);
  elements.pageLabel.textContent = `${state.page + 1} / ${pageCount} · 검색 ${filtered.length.toLocaleString()}행`;
  elements.prev.disabled = state.page <= 0;
  elements.next.disabled = state.page >= pageCount - 1;
  elements.sourceMeta.textContent = `${profile.rows.toLocaleString()} rows · ${profile.columns.length} columns`;
}

function renderQuality(profile: DataProfile) {
  elements.rowCount.textContent = profile.rows.toLocaleString();
  elements.columnCount.textContent = String(profile.columns.length);
  elements.issueCount.textContent = (profile.blankCells + profile.invalidEmails + profile.invalidPhones).toLocaleString();
  elements.duplicateCount.textContent = profile.duplicateRows.toLocaleString();

  const filter = state.issueFilter;
  const filteredIssues = profile.issues.filter((issue) => filter === 'all' || issue.type === filter);
  elements.issueReport.disabled = filteredIssues.length === 0;
  const issues = filteredIssues.slice(0, 80);

  if (issues.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = '현재 필터에서 발견된 문제가 없습니다.';
    elements.qualityList.replaceChildren(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  issues.forEach((issue) => {
    const item = document.createElement('div');
    item.className = `issue issue-${issue.type}`;
    const title = document.createElement('strong');
    title.textContent = `${issue.rowIndex + 1}행 · ${issue.column}`;
    const text = document.createElement('span');
    text.textContent = issue.message;
    item.append(title, text);
    fragment.appendChild(item);
  });
  elements.qualityList.replaceChildren(fragment);
}

function renderOperations() {
  if (state.operations.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = '아직 적용한 변환이 없습니다.';
    elements.operationList.replaceChildren(empty);
    return;
  }
  const list = document.createElement('ol');
  state.operations.forEach((operation) => {
    const item = document.createElement('li');
    item.textContent = operation.label;
    list.appendChild(item);
  });
  elements.operationList.replaceChildren(list);
}

function render() {
  const profile = profileRows(state.rows);
  elements.sourceName.textContent = state.sourceName;
  renderTable(profile);
  renderQuality(profile);
  renderOperations();
  byId<HTMLButtonElement>('undoButton').disabled = state.history.length === 0;
  byId<HTMLButtonElement>('redoButton').disabled = state.future.length === 0;
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function readRecipes(): SavedRecipe[] {
  try {
    const raw = localStorage.getItem(RECIPE_KEY);
    if (!raw) return [];
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];

    return value.flatMap((candidate): SavedRecipe[] => {
      if (!candidate || typeof candidate !== 'object') return [];
      const record = candidate as Record<string, unknown>;
      if (typeof record.name !== 'string' || !Array.isArray(record.operations)) return [];
      const operations = record.operations.filter(isOperationKind);
      if (operations.length !== record.operations.length || operations.length === 0) return [];
      return [{ name: record.name.slice(0, 40), operations }];
    });
  } catch {
    return [];
  }
}

function writeRecipes(recipes: SavedRecipe[]) {
  localStorage.setItem(RECIPE_KEY, JSON.stringify(recipes));
  renderRecipeSelect();
}

function renderRecipeSelect() {
  const recipes = readRecipes();
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = recipes.length ? '저장된 Recipe 선택' : '저장된 Recipe 없음';
  const options = recipes.map((recipe, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `${recipe.name} · ${recipe.operations.length}단계`;
    return option;
  });
  elements.recipeSelect.replaceChildren(placeholder, ...options);
}

async function handleFile() {
  const file = elements.file.files?.[0];
  if (!file) return;
  setStatus('파일을 브라우저에서 분석하고 있습니다...');
  try {
    const rows = await parseFile(file);
    loadRows(rows, file.name);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '파일을 읽지 못했습니다.', 'error');
  } finally {
    elements.file.value = '';
  }
}

function saveRecipe() {
  const name = elements.recipeName.value.trim();
  if (!name) {
    setStatus('Recipe 이름을 입력하세요.', 'error');
    return;
  }
  const operations = state.operations.map((operation) => operation.kind);
  if (operations.length === 0) {
    setStatus('저장할 변환 작업이 없습니다.', 'error');
    return;
  }
  const recipes = readRecipes().filter((recipe) => recipe.name !== name);
  recipes.push({ name: name.slice(0, 40), operations });
  writeRecipes(recipes);
  elements.recipeName.value = '';
  setStatus(`Recipe “${name}”을 브라우저에 저장했습니다.`, 'success');
}

function runRecipe() {
  const selected = elements.recipeSelect.value;
  if (!selected) {
    setStatus('실행할 Recipe를 선택하세요.', 'error');
    return;
  }

  const index = Number(selected);
  const recipe = Number.isInteger(index) ? readRecipes()[index] : undefined;
  if (!recipe) {
    setStatus('저장된 Recipe를 읽을 수 없습니다.', 'error');
    renderRecipeSelect();
    return;
  }

  pushHistory(`Recipe: ${recipe.name}`);
  let rows = cloneRows(state.rows);
  const nextOperations = cloneOperations(state.operations);
  recipe.operations.forEach((kind) => {
    rows = applyOperation(rows, kind);
    nextOperations.push({ kind, label: operationLabel(kind) });
  });
  state.rows = rows;
  state.operations = nextOperations;
  state.page = 0;
  render();
  setStatus(`Recipe “${recipe.name}” ${recipe.operations.length}단계를 적용했습니다.`, 'success');
}

function exportIssueReport() {
  const profile = profileRows(state.rows);
  const reportRows = buildIssueReportRows(state.rows, profile, state.issueFilter);
  if (reportRows.length === 0) {
    setStatus('현재 필터에서 내보낼 품질 문제가 없습니다.', 'error');
    return;
  }

  download(
    exportIssueReportCsv(state.rows, profile, state.issueFilter),
    `quality-issues-${state.issueFilter}.csv`
  );
  setStatus(`품질 검수 리포트 ${reportRows.length.toLocaleString()}건을 CSV로 내보냈습니다.`, 'success');
}

elements.file.addEventListener('change', () => void handleFile());
byId<HTMLButtonElement>('sampleButton').addEventListener('click', () => loadRows(SAMPLE_ROWS, '샘플 거래처 데이터'));
byId<HTMLButtonElement>('trimButton').addEventListener('click', () => runOperation('trim'));
byId<HTMLButtonElement>('emailButton').addEventListener('click', () => runOperation('email'));
byId<HTMLButtonElement>('phoneButton').addEventListener('click', () => runOperation('phone'));
byId<HTMLButtonElement>('dedupeButton').addEventListener('click', () => runOperation('dedupe'));
byId<HTMLButtonElement>('undoButton').addEventListener('click', undo);
byId<HTMLButtonElement>('redoButton').addEventListener('click', redo);
byId<HTMLButtonElement>('resetButton').addEventListener('click', resetDataset);
byId<HTMLButtonElement>('saveRecipeButton').addEventListener('click', saveRecipe);
byId<HTMLButtonElement>('runRecipeButton').addEventListener('click', runRecipe);
byId<HTMLButtonElement>('exportCsvButton').addEventListener('click', () => download(exportCsv(state.rows), 'cleaned-data.csv'));
byId<HTMLButtonElement>('exportXlsxButton').addEventListener('click', () => download(exportXlsx(state.rows), 'cleaned-data.xlsx'));
elements.issueReport.addEventListener('click', exportIssueReport);
elements.search.addEventListener('input', () => {
  state.query = elements.search.value;
  state.page = 0;
  render();
});
elements.issueFilter.addEventListener('change', () => {
  state.issueFilter = elements.issueFilter.value as IssueFilter;
  render();
});
elements.prev.addEventListener('click', () => {
  state.page = Math.max(0, state.page - 1);
  render();
});
elements.next.addEventListener('click', () => {
  state.page += 1;
  render();
});

renderRecipeSelect();
render();
setStatus('API 키나 서버 없이 샘플 데이터를 바로 정리해볼 수 있습니다.');
