import * as XLSX from 'xlsx';

export type CellValue = string | number | boolean | null;
export type DataRow = Record<string, CellValue>;
export type QualityIssue = { rowIndex: number; column: string; type: 'blank' | 'email' | 'phone' | 'duplicate'; message: string };
export type DataProfile = { rows: number; columns: string[]; blankCells: number; invalidEmails: number; invalidPhones: number; duplicateRows: number; issues: QualityIssue[] };
export type OperationKind = 'trim' | 'email' | 'phone' | 'dedupe';
export type Operation = { kind: OperationKind; label: string };
export type WorkbookInspection = { fileName: string; fileSize: number; sheetNames: string[] };

export const IMPORT_LIMITS = Object.freeze({
  maxFileBytes: 20 * 1024 * 1024,
  maxSheets: 50,
  maxRows: 100_000,
  maxColumns: 300,
  maxCells: 5_000_000
});

const EMAIL_HINT = /(email|e-mail|메일|이메일)/i;
const PHONE_HINT = /(phone|mobile|tel|전화|연락처|휴대폰)/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_OPERATIONS = new Set<OperationKind>(['trim', 'email', 'phone', 'dedupe']);
const SUPPORTED_EXTENSIONS = new Set(['xlsx', 'xls', 'csv']);

export const SAMPLE_ROWS: DataRow[] = [
  { 거래처명: '  새한상사 ', 이메일: 'SALES@SAEHAN.CO.KR', 연락처: '01012345678', 지역: '서울', 상태: '사용중' },
  { 거래처명: '에이스테크', 이메일: 'contact@acetech.co.kr', 연락처: '010-9876-5432', 지역: '서울', 상태: '확인중' },
  { 거래처명: '미래유통', 이메일: 'invalid-mail', 연락처: '021234567', 지역: '경기', 상태: '사용중' },
  { 거래처명: '  새한상사 ', 이메일: 'SALES@SAEHAN.CO.KR', 연락처: '01012345678', 지역: '서울', 상태: '사용중' },
  { 거래처명: '대한솔루션', 이메일: '', 연락처: '031 777 8888', 지역: '경기', 상태: '중지' },
  { 거래처명: '한빛기획', 이메일: 'hello@hanbit.kr', 연락처: '01022223333', 지역: '부산', 상태: '사용중' }
];

function extensionOf(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

function validateInputFile(file: File) {
  const extension = extensionOf(file.name);
  if (!SUPPORTED_EXTENSIONS.has(extension)) throw new Error('Excel 또는 CSV 파일만 불러올 수 있습니다.');
  if (file.size <= 0) throw new Error('내용이 없는 파일은 불러올 수 없습니다.');
  if (file.size > IMPORT_LIMITS.maxFileBytes) {
    throw new Error(`파일이 너무 큽니다. 한 파일은 ${Math.floor(IMPORT_LIMITS.maxFileBytes / 1024 / 1024)}MB 이하만 처리할 수 있습니다.`);
  }
}

function readWorkbook(buffer: ArrayBuffer): XLSX.WorkBook {
  try {
    return XLSX.read(buffer, { type: 'array' });
  } catch {
    throw new Error('파일 형식을 읽지 못했습니다. 손상되지 않은 Excel 또는 CSV 파일인지 확인해 주세요.');
  }
}

function dataSheetNames(workbook: XLSX.WorkBook): string[] {
  return workbook.SheetNames.filter((name) => Boolean(workbook.Sheets[name]?.['!ref']));
}

export function validateTableShape(rows: number, columns: number) {
  if (rows > IMPORT_LIMITS.maxRows) throw new Error(`행이 너무 많습니다. 한 번에 ${IMPORT_LIMITS.maxRows.toLocaleString('ko-KR')}행 이하만 처리할 수 있습니다.`);
  if (columns > IMPORT_LIMITS.maxColumns) throw new Error(`항목이 너무 많습니다. 한 번에 ${IMPORT_LIMITS.maxColumns.toLocaleString('ko-KR')}개 이하만 처리할 수 있습니다.`);
  if (rows * columns > IMPORT_LIMITS.maxCells) throw new Error('표가 너무 큽니다. 행과 항목 수를 줄인 뒤 다시 시도해 주세요.');
}

export async function inspectFile(file: File): Promise<WorkbookInspection> {
  validateInputFile(file);
  const workbook = readWorkbook(await file.arrayBuffer());
  const sheetNames = dataSheetNames(workbook);
  if (!sheetNames.length) throw new Error('파일 안에서 읽을 수 있는 표를 찾지 못했습니다.');
  if (sheetNames.length > IMPORT_LIMITS.maxSheets) throw new Error(`시트가 너무 많습니다. 한 파일은 ${IMPORT_LIMITS.maxSheets}개 시트 이하만 처리할 수 있습니다.`);
  return { fileName: file.name, fileSize: file.size, sheetNames };
}

function ensureSheetPickerStyle() {
  if (typeof document === 'undefined' || document.getElementById('workbook-sheet-picker-style')) return;
  const style = document.createElement('style');
  style.id = 'workbook-sheet-picker-style';
  style.textContent = `
    .workbook-sheet-dialog{border:0;border-radius:18px;padding:0;width:min(460px,calc(100vw - 32px));box-shadow:0 24px 80px rgba(20,24,32,.24);color:#20242c;background:#fff}
    .workbook-sheet-dialog::backdrop{background:rgba(20,24,32,.48);backdrop-filter:blur(3px)}
    .workbook-sheet-dialog form{padding:24px;display:grid;gap:16px}
    .workbook-sheet-dialog h2{margin:0;font-size:20px;line-height:1.35}
    .workbook-sheet-dialog p{margin:0;color:#656b76;line-height:1.6;font-size:14px}
    .workbook-sheet-dialog label{display:grid;gap:8px;font-size:13px;font-weight:700}
    .workbook-sheet-dialog select{width:100%;min-height:44px;border:1px solid #cfd4dc;border-radius:10px;background:#fff;padding:0 12px;font:inherit}
    .workbook-sheet-dialog .sheet-dialog-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}
    .workbook-sheet-dialog button{min-height:42px;border-radius:10px;border:1px solid #cfd4dc;background:#fff;padding:0 16px;font:inherit;font-weight:700;cursor:pointer}
    .workbook-sheet-dialog button[data-primary="true"]{background:#2b2f38;color:#fff;border-color:#2b2f38}
  `;
  document.head.appendChild(style);
}

async function chooseSheet(sheetNames: string[], fileName: string): Promise<string> {
  if (sheetNames.length === 1) return sheetNames[0]!;
  if (typeof document === 'undefined' || typeof HTMLDialogElement === 'undefined') {
    throw new Error(`여러 시트가 있는 파일입니다. 사용할 시트를 선택해야 합니다: ${sheetNames.join(', ')}`);
  }
  ensureSheetPickerStyle();
  return new Promise<string>((resolve, reject) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'workbook-sheet-dialog';
    dialog.id = 'workbook-sheet-dialog';
    dialog.setAttribute('aria-labelledby', 'workbook-sheet-title');

    const form = document.createElement('form');
    form.method = 'dialog';
    const title = document.createElement('h2');
    title.id = 'workbook-sheet-title';
    title.textContent = '처리할 시트를 선택하세요.';
    const description = document.createElement('p');
    description.textContent = `${fileName}에는 데이터가 있는 시트가 ${sheetNames.length}개 있습니다. 잘못된 시트를 자동으로 처리하지 않습니다.`;
    const label = document.createElement('label');
    label.textContent = '사용할 시트';
    const select = document.createElement('select');
    select.id = 'workbook-sheet-select';
    select.setAttribute('aria-label', '사용할 시트');
    sheetNames.forEach((name) => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    });
    label.appendChild(select);

    const actions = document.createElement('div');
    actions.className = 'sheet-dialog-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = '취소';
    const confirm = document.createElement('button');
    confirm.type = 'submit';
    confirm.dataset.primary = 'true';
    confirm.textContent = '이 시트 사용';
    actions.append(cancel, confirm);
    form.append(title, description, label, actions);
    dialog.appendChild(form);
    document.body.appendChild(dialog);

    let settled = false;
    const cleanup = () => dialog.remove();
    const fail = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('시트 선택을 취소했습니다.'));
    };
    cancel.addEventListener('click', () => { dialog.close(); fail(); });
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); dialog.close(); fail(); });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (settled) return;
      const selected = select.value;
      if (!sheetNames.includes(selected)) return;
      settled = true;
      dialog.close();
      cleanup();
      resolve(selected);
    });
    dialog.showModal();
    select.focus();
  });
}

function normalizeHeader(value: unknown, index: number): string {
  const text = String(value ?? '').trim();
  return text || `이름없는항목_${index + 1}`;
}
function normalizeCell(value: unknown): CellValue {
  if (value === undefined || value === null) return null;
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : String(value);
}
function normalizeRows(rows: Record<string, unknown>[]): DataRow[] {
  return rows.map((row) => {
    const output: DataRow = {};
    Object.entries(row).forEach(([key, value], index) => { output[normalizeHeader(key, index)] = normalizeCell(value); });
    return output;
  });
}

function rowsFromSheet(sheet: XLSX.WorkSheet): DataRow[] {
  const ref = sheet['!ref'];
  if (!ref) throw new Error('선택한 시트에 읽을 수 있는 표가 없습니다.');
  const range = XLSX.utils.decode_range(ref);
  const estimatedRows = Math.max(0, range.e.r - range.s.r);
  const estimatedColumns = Math.max(0, range.e.c - range.s.c + 1);
  validateTableShape(estimatedRows, estimatedColumns);

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: false, blankrows: false });
  if (matrix.length < 2) throw new Error('선택한 시트에 불러올 데이터 행이 없습니다.');
  const headerValues = matrix[0] ?? [];
  const headers = headerValues.map((value, index) => normalizeHeader(value, index));
  validateTableShape(matrix.length - 1, headers.length);

  const duplicates = headers.filter((header, index) => headers.indexOf(header) !== index);
  if (duplicates.length) {
    throw new Error(`같은 항목 이름이 두 번 이상 있습니다: ${[...new Set(duplicates)].join(', ')}. 머리글을 서로 다르게 바꾼 뒤 다시 시도해 주세요.`);
  }

  const rows = matrix.slice(1).map((values) => {
    const row: DataRow = {};
    headers.forEach((header, index) => { row[header] = normalizeCell(values[index]); });
    return row;
  });
  if (!rows.length) throw new Error('불러올 데이터가 없습니다.');
  return rows;
}

export async function parseFile(file: File): Promise<DataRow[]> {
  validateInputFile(file);
  const workbook = readWorkbook(await file.arrayBuffer());
  const sheetNames = dataSheetNames(workbook);
  if (!sheetNames.length) throw new Error('파일 안에서 읽을 수 있는 표를 찾지 못했습니다.');
  if (sheetNames.length > IMPORT_LIMITS.maxSheets) throw new Error(`시트가 너무 많습니다. 한 파일은 ${IMPORT_LIMITS.maxSheets}개 시트 이하만 처리할 수 있습니다.`);
  const selectedSheetName = await chooseSheet(sheetNames, file.name);
  const sheet = workbook.Sheets[selectedSheetName];
  if (!sheet) throw new Error('선택한 시트를 읽지 못했습니다.');
  return rowsFromSheet(sheet);
}

export function getColumns(rows: DataRow[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) Object.keys(row).forEach((key) => seen.add(key));
  return [...seen];
}
function cellToString(value: CellValue): string { return value === null ? '' : String(value); }
function comparableRow(row: DataRow, columns: string[]): string {
  return columns.map((column) => cellToString(row[column] ?? null).trim().toLocaleLowerCase('ko-KR')).join('\u001f');
}

export function profileRows(rows: DataRow[]): DataProfile {
  const columns = getColumns(rows);
  const issues: QualityIssue[] = [];
  let blankCells = 0;
  let invalidEmails = 0;
  let invalidPhones = 0;
  let duplicateRows = 0;
  const seen = new Map<string, number>();
  rows.forEach((row, rowIndex) => {
    columns.forEach((column) => {
      const raw = cellToString(row[column] ?? null).trim();
      if (!raw) { blankCells += 1; issues.push({ rowIndex, column, type: 'blank', message: '빈 값' }); return; }
      if (EMAIL_HINT.test(column) && !EMAIL_PATTERN.test(raw)) { invalidEmails += 1; issues.push({ rowIndex, column, type: 'email', message: '이메일 형식 확인 필요' }); }
      if (PHONE_HINT.test(column)) {
        const digits = raw.replace(/\D/g, '');
        if (digits.length < 9 || digits.length > 11) { invalidPhones += 1; issues.push({ rowIndex, column, type: 'phone', message: '전화번호 형식 확인 필요' }); }
      }
    });
    const key = comparableRow(row, columns);
    const firstIndex = seen.get(key);
    if (firstIndex !== undefined) { duplicateRows += 1; issues.push({ rowIndex, column: '-', type: 'duplicate', message: `${firstIndex + 1}행과 완전히 같은 내용` }); }
    else seen.set(key, rowIndex);
  });
  return { rows: rows.length, columns, blankCells, invalidEmails, invalidPhones, duplicateRows, issues };
}

export function normalizeWhitespace(rows: DataRow[]): DataRow[] {
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : value])));
}
export function normalizeEmails(rows: DataRow[]): DataRow[] {
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => !EMAIL_HINT.test(key) || typeof value !== 'string' ? [key, value] : [key, value.trim().toLowerCase()])));
}
export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('01')) return digits.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  if (digits.length === 10 && digits.startsWith('02')) return digits.replace(/(\d{2})(\d{4})(\d{4})/, '$1-$2-$3');
  if (digits.length === 9 && digits.startsWith('02')) return digits.replace(/(\d{2})(\d{3})(\d{4})/, '$1-$2-$3');
  if (digits.length === 10) return digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  return value.trim();
}
export function normalizePhones(rows: DataRow[]): DataRow[] {
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => !PHONE_HINT.test(key) || typeof value !== 'string' ? [key, value] : [key, formatPhone(value)])));
}
export function removeDuplicateRows(rows: DataRow[]): DataRow[] {
  const columns = getColumns(rows);
  const seen = new Set<string>();
  return rows.filter((row) => { const key = comparableRow(row, columns); if (seen.has(key)) return false; seen.add(key); return true; });
}
export function isOperationKind(value: unknown): value is OperationKind { return typeof value === 'string' && VALID_OPERATIONS.has(value as OperationKind); }
export function applyOperation(rows: DataRow[], operation: OperationKind): DataRow[] {
  switch (operation) {
    case 'trim': return normalizeWhitespace(rows);
    case 'email': return normalizeEmails(rows);
    case 'phone': return normalizePhones(rows);
    case 'dedupe': return removeDuplicateRows(rows);
  }
}
export function operationLabel(kind: OperationKind): string {
  const labels: Record<OperationKind, string> = { trim: '앞뒤 공백 정리', email: '이메일 소문자로 통일', phone: '전화번호 형식 정리', dedupe: '완전히 같은 행 제거' };
  return labels[kind];
}

export function sanitizeSpreadsheetCell(value: CellValue): CellValue {
  if (typeof value !== 'string') return value;
  const first = value[0];
  if (first === '=' || first === '+' || first === '@' || first === '\t' || first === '\r') return `'${value}`;
  if (first === '-' && !/^-\d+(?:[.,]\d+)?$/.test(value.trim())) return `'${value}`;
  return value;
}
export function prepareRowsForSpreadsheet(rows: DataRow[]): DataRow[] {
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, sanitizeSpreadsheetCell(value)])));
}
export function exportCsv(rows: DataRow[]): Blob {
  const sheet = XLSX.utils.json_to_sheet(prepareRowsForSpreadsheet(rows));
  return new Blob(['\ufeff', XLSX.utils.sheet_to_csv(sheet)], { type: 'text/csv;charset=utf-8' });
}
export function exportXlsx(rows: DataRow[]): Blob {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(prepareRowsForSpreadsheet(rows));
  XLSX.utils.book_append_sheet(workbook, sheet, '정리된 데이터');
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
export function matchesQuery(row: DataRow, query: string): boolean {
  const normalized = query.trim().toLocaleLowerCase('ko-KR');
  return !normalized || Object.values(row).some((value) => cellToString(value).toLocaleLowerCase('ko-KR').includes(normalized));
}
