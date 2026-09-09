import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { IMPORT_LIMITS, inspectFile, parseFile, validateTableShape } from './data';

function workbookFile(name: string, sheets: Array<{ name: string; rows: unknown[][] }>): File {
  const workbook = XLSX.utils.book_new();
  sheets.forEach((item) => XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(item.rows), item.name));
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  return new File([buffer], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

describe('workbook import safety', () => {
  it('lists only data-bearing worksheets before import', async () => {
    const file = workbookFile('multi.xlsx', [
      { name: '안내', rows: [['설명'], ['이 파일은 샘플입니다.']] },
      { name: '거래처', rows: [['거래처명', '이메일'], ['가람상사', 'sales@example.com']] }
    ]);
    const inspection = await inspectFile(file);
    expect(inspection.sheetNames).toEqual(['안내', '거래처']);
  });

  it('parses a single-sheet workbook without changing headers', async () => {
    const file = workbookFile('single.xlsx', [
      { name: '거래처', rows: [['거래처명', '연락처'], ['가람상사', '010-1234-5678']] }
    ]);
    const rows = await parseFile(file);
    expect(rows).toEqual([{ 거래처명: '가람상사', 연락처: '010-1234-5678' }]);
  });

  it('never silently chooses the first worksheet when multiple worksheets exist outside the browser UI', async () => {
    const file = workbookFile('multi.xlsx', [
      { name: '안내', rows: [['설명'], ['첫 시트']] },
      { name: '실데이터', rows: [['ID'], ['C001']] }
    ]);
    await expect(parseFile(file)).rejects.toThrow('여러 시트');
  });

  it('rejects duplicate normalized headers instead of inventing a new column name', async () => {
    const file = workbookFile('duplicate-header.xlsx', [
      { name: 'Sheet1', rows: [['고객명', ' 고객명 '], ['A', 'B']] }
    ]);
    await expect(parseFile(file)).rejects.toThrow('같은 항목 이름');
  });

  it('enforces row, column and total-cell processing limits', () => {
    expect(() => validateTableShape(IMPORT_LIMITS.maxRows + 1, 2)).toThrow('행이 너무 많습니다');
    expect(() => validateTableShape(2, IMPORT_LIMITS.maxColumns + 1)).toThrow('항목이 너무 많습니다');
    expect(() => validateTableShape(50_001, 101)).toThrow('표가 너무 큽니다');
  });
});
