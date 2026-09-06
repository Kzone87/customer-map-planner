import type { CellValue, DataRow } from './data';

export type CompareStatus = 'ADDED' | 'REMOVED' | 'CHANGED' | 'UNCHANGED';
export type CompareEntry = { key: string; status: CompareStatus; before: DataRow | null; after: DataRow | null; changedColumns: string[] };
export type CompareSummary = { added: number; removed: number; changed: number; unchanged: number; total: number };
export type CompareResult = { keyColumn: string; columns: string[]; entries: CompareEntry[]; summary: CompareSummary };

const STATUS_LABELS: Record<CompareStatus, string> = {
  ADDED: '새로 추가',
  REMOVED: '삭제됨',
  CHANGED: '값 변경',
  UNCHANGED: '변화 없음'
};

function text(value: CellValue | undefined): string { return value === null || value === undefined ? '' : String(value).trim(); }
function comparable(value: CellValue | undefined): string { return text(value).toLocaleLowerCase('ko-KR'); }
function allColumns(before: DataRow[], after: DataRow[]): string[] {
  const seen = new Set<string>();
  for (const row of [...before, ...after]) Object.keys(row).forEach((column) => seen.add(column));
  return [...seen];
}

function indexByKey(rows: DataRow[], keyColumn: string, side: 'before' | 'after'): Map<string, DataRow> {
  const index = new Map<string, DataRow>();
  const sideLabel = side === 'before' ? '이전' : '새';
  rows.forEach((row, rowIndex) => {
    const raw = text(row[keyColumn]);
    if (!raw) throw new Error(`${sideLabel} 파일 ${rowIndex + 2}행의 “${keyColumn}” 값이 비어 있습니다.`);
    const key = comparable(row[keyColumn]);
    if (index.has(key)) throw new Error(`${sideLabel} 파일에 같은 구분값 “${raw}”이 여러 번 있습니다. 각 행을 구분하는 항목에는 같은 값이 없어야 합니다.`);
    index.set(key, row);
  });
  return index;
}

function changedColumns(before: DataRow, after: DataRow, columns: string[], keyColumn: string): string[] {
  return columns.filter((column) => column !== keyColumn && comparable(before[column]) !== comparable(after[column]));
}

export function compareDatasets(before: DataRow[], after: DataRow[], keyColumn: string): CompareResult {
  if (!before.length || !after.length) throw new Error('비교할 두 파일을 모두 선택해 주세요.');
  const columns = allColumns(before, after);
  if (!keyColumn || !columns.includes(keyColumn)) throw new Error('같은 행을 구분할 항목을 선택해 주세요.');
  const beforeHasKey = before.some((row) => Object.prototype.hasOwnProperty.call(row, keyColumn));
  const afterHasKey = after.some((row) => Object.prototype.hasOwnProperty.call(row, keyColumn));
  if (!beforeHasKey || !afterHasKey) throw new Error(`“${keyColumn}” 항목이 두 파일에 모두 있어야 합니다.`);

  const beforeIndex = indexByKey(before, keyColumn, 'before');
  const afterIndex = indexByKey(after, keyColumn, 'after');
  const keys = [...new Set([...beforeIndex.keys(), ...afterIndex.keys()])].sort((a, b) => a.localeCompare(b, 'ko-KR'));
  const entries: CompareEntry[] = keys.map((normalizedKey) => {
    const beforeRow = beforeIndex.get(normalizedKey) ?? null;
    const afterRow = afterIndex.get(normalizedKey) ?? null;
    const displayKey = text(afterRow?.[keyColumn] ?? beforeRow?.[keyColumn]);
    if (!beforeRow) return { key: displayKey, status: 'ADDED', before: null, after: afterRow, changedColumns: [] };
    if (!afterRow) return { key: displayKey, status: 'REMOVED', before: beforeRow, after: null, changedColumns: [] };
    const changes = changedColumns(beforeRow, afterRow, columns, keyColumn);
    return { key: displayKey, status: changes.length ? 'CHANGED' : 'UNCHANGED', before: beforeRow, after: afterRow, changedColumns: changes };
  });

  const summary: CompareSummary = {
    added: entries.filter((entry) => entry.status === 'ADDED').length,
    removed: entries.filter((entry) => entry.status === 'REMOVED').length,
    changed: entries.filter((entry) => entry.status === 'CHANGED').length,
    unchanged: entries.filter((entry) => entry.status === 'UNCHANGED').length,
    total: entries.length
  };
  return { keyColumn, columns, entries, summary };
}

export function changeReportRows(result: CompareResult, includeUnchanged = false): DataRow[] {
  return result.entries
    .filter((entry) => includeUnchanged || entry.status !== 'UNCHANGED')
    .map((entry) => {
      const row: DataRow = {
        상태: STATUS_LABELS[entry.status],
        구분값: entry.key,
        바뀐항목: entry.changedColumns.join(', ')
      };
      for (const column of result.columns) {
        if (column === result.keyColumn) continue;
        row[`이전_${column}`] = entry.before?.[column] ?? null;
        row[`이후_${column}`] = entry.after?.[column] ?? null;
      }
      return row;
    });
}

export function sharedColumns(before: DataRow[], after: DataRow[]): string[] {
  if (!before.length || !after.length) return [];
  const beforeColumns = new Set(before.flatMap((row) => Object.keys(row)));
  const afterColumns = new Set(after.flatMap((row) => Object.keys(row)));
  return [...beforeColumns].filter((column) => afterColumns.has(column));
}
