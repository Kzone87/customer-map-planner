import * as XLSX from 'xlsx';

export type CellValue = string | number | boolean | null;
export type DataRow = Record<string, CellValue>;

export type QualityIssue = {
  rowIndex: number;
  column: string;
  type: 'blank' | 'email' | 'phone' | 'duplicate';
  message: string;
};

export type DataProfile = {
  rows: number;
  columns: string[];
  blankCells: number;
  invalidEmails: number;
  invalidPhones: number;
  duplicateRows: number;
  issues: QualityIssue[];
};

export type OperationKind = 'trim' | 'email' | 'phone' | 'dedupe';

export type Operation = {
  kind: OperationKind;
  label: string;
};

const EMAIL_HINT = /(email|e-mail|메일|이메일)/i;
const PHONE_HINT = /(phone|mobile|tel|전화|연락처|휴대폰)/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const SAMPLE_ROWS: DataRow[] = [
  { 거래처명: '  새한상사 ', 이메일: 'SALES@SAEHAN.CO.KR', 연락처: '01012345678', 지역: '서울', 상태: 'ACTIVE' },
  { 거래처명: '에이스테크', 이메일: 'contact@acetech.co.kr', 연락처: '010-9876-5432', 지역: '서울', 상태: 'PENDING' },
  { 거래처명: '미래유통', 이메일: 'invalid-mail', 연락처: '021234567', 지역: '경기', 상태: 'ACTIVE' },
  { 거래처명: '  새한상사 ', 이메일: 'SALES@SAEHAN.CO.KR', 연락처: '01012345678', 지역: '서울', 상태: 'ACTIVE' },
  { 거래처명: '대한솔루션', 이메일: '', 연락처: '031 777 8888', 지역: '경기', 상태: 'INACTIVE' },
  { 거래처명: '한빛기획', 이메일: 'hello@hanbit.kr', 연락처: '01022223333', 지역: '부산', 상태: 'ACTIVE' }
];

function normalizeHeader(value: unknown, index: number): string {
  const text = String(value ?? '').trim();
  return text || `column_${index + 1}`;
}

function normalizeCell(value: unknown): CellValue {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  return String(value);
}

function normalizeRows(rows: Record<string, unknown>[]): DataRow[] {
  return rows.map((row) => {
    const output: DataRow = {};
    Object.entries(row).forEach(([key, value], index) => {
      output[normalizeHeader(key, index)] = normalizeCell(value);
    });
    return output;
  });
}

export async function parseFile(file: File): Promise<DataRow[]> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || !['xlsx', 'xls', 'csv'].includes(extension)) {
    throw new Error('지원 형식은 XLSX, XLS, CSV입니다.');
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error('파일에 시트가 없습니다.');

  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) throw new Error('첫 번째 시트를 읽을 수 없습니다.');

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: false
  });

  if (rows.length === 0) throw new Error('불러올 데이터가 없습니다.');
  return normalizeRows(rows);
}

export function getColumns(rows: DataRow[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) Object.keys(row).forEach((key) => seen.add(key));
  return [...seen];
}

function cellToString(value: CellValue): string {
  return value === null ? '' : String(value);
}

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
      if (!raw) {
        blankCells += 1;
        issues.push({ rowIndex, column, type: 'blank', message: '빈 값' });
        return;
      }

      if (EMAIL_HINT.test(column) && !EMAIL_PATTERN.test(raw)) {
        invalidEmails += 1;
        issues.push({ rowIndex, column, type: 'email', message: '이메일 형식 확인 필요' });
      }

      if (PHONE_HINT.test(column)) {
        const digits = raw.replace(/\D/g, '');
        if (digits.length < 9 || digits.length > 11) {
          invalidPhones += 1;
          issues.push({ rowIndex, column, type: 'phone', message: '전화번호 형식 확인 필요' });
        }
      }
    });

    const key = comparableRow(row, columns);
    const firstIndex = seen.get(key);
    if (firstIndex !== undefined) {
      duplicateRows += 1;
      issues.push({ rowIndex, column: '-', type: 'duplicate', message: `${firstIndex + 1}행과 완전 중복` });
    } else {
      seen.set(key, rowIndex);
    }
  });

  return { rows: rows.length, columns, blankCells, invalidEmails, invalidPhones, duplicateRows, issues };
}

export function normalizeWhitespace(rows: DataRow[]): DataRow[] {
  return rows.map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : value
    ])
  ));
}

export function normalizeEmails(rows: DataRow[]): DataRow[] {
  return rows.map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      if (!EMAIL_HINT.test(key) || typeof value !== 'string') return [key, value];
      return [key, value.trim().toLowerCase()];
    })
  ));
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
  return rows.map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      if (!PHONE_HINT.test(key) || typeof value !== 'string') return [key, value];
      return [key, formatPhone(value)];
    })
  ));
}

export function removeDuplicateRows(rows: DataRow[]): DataRow[] {
  const columns = getColumns(rows);
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = comparableRow(row, columns);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function applyOperation(rows: DataRow[], operation: OperationKind): DataRow[] {
  switch (operation) {
    case 'trim': return normalizeWhitespace(rows);
    case 'email': return normalizeEmails(rows);
    case 'phone': return normalizePhones(rows);
    case 'dedupe': return removeDuplicateRows(rows);
  }
}

export function operationLabel(kind: OperationKind): string {
  const labels: Record<OperationKind, string> = {
    trim: '공백 정리',
    email: '이메일 소문자 정규화',
    phone: '전화번호 형식 정리',
    dedupe: '완전 중복 행 제거'
  };
  return labels[kind];
}

export function exportCsv(rows: DataRow[]): Blob {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(sheet);
  return new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' });
}

export function exportXlsx(rows: DataRow[]): Blob {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, 'cleaned-data');
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function matchesQuery(row: DataRow, query: string): boolean {
  const normalized = query.trim().toLocaleLowerCase('ko-KR');
  if (!normalized) return true;
  return Object.values(row).some((value) => cellToString(value).toLocaleLowerCase('ko-KR').includes(normalized));
}
