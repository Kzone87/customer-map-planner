import { describe, expect, it } from 'vitest';
import {
  formatPhone,
  isOperationKind,
  normalizeEmails,
  normalizeWhitespace,
  prepareRowsForSpreadsheet,
  profileRows,
  removeDuplicateRows,
  SAMPLE_ROWS,
  sanitizeSpreadsheetCell
} from './data';

describe('data quality engine', () => {
  it('detects duplicate, email, blank and phone issues', () => {
    const profile = profileRows(SAMPLE_ROWS);
    expect(profile.rows).toBe(6);
    expect(profile.duplicateRows).toBe(1);
    expect(profile.invalidEmails).toBe(1);
    expect(profile.blankCells).toBeGreaterThan(0);
  });

  it('removes exact duplicate rows deterministically', () => {
    expect(removeDuplicateRows(SAMPLE_ROWS)).toHaveLength(5);
  });
});

describe('normalization', () => {
  it('normalizes whitespace without changing non-string values', () => {
    const rows = normalizeWhitespace([{ name: '  A   B ', amount: 10 }]);
    expect(rows[0]?.name).toBe('A B');
    expect(rows[0]?.amount).toBe(10);
  });

  it('lowercases columns recognized as email fields', () => {
    const rows = normalizeEmails([{ 이메일: '  TEST@EXAMPLE.COM ' }]);
    expect(rows[0]?.이메일).toBe('test@example.com');
  });

  it('formats common Korean phone numbers', () => {
    expect(formatPhone('01012345678')).toBe('010-1234-5678');
    expect(formatPhone('02 1234 5678')).toBe('02-1234-5678');
  });
});

describe('recipe and export safety', () => {
  it('accepts only supported operation identifiers', () => {
    expect(isOperationKind('trim')).toBe(true);
    expect(isOperationKind('dedupe')).toBe(true);
    expect(isOperationKind('unknown')).toBe(false);
  });

  it('neutralizes formula-like text before spreadsheet export', () => {
    expect(sanitizeSpreadsheetCell('=HYPERLINK("https://example.com")')).toBe("'=HYPERLINK(\"https://example.com\")");
    expect(sanitizeSpreadsheetCell('+SUM(1,2)')).toBe("'+SUM(1,2)");
    expect(sanitizeSpreadsheetCell('@cmd')).toBe("'@cmd");
    expect(sanitizeSpreadsheetCell('-1200')).toBe('-1200');
    expect(sanitizeSpreadsheetCell(1200)).toBe(1200);
  });

  it('sanitizes exported rows without mutating source rows', () => {
    const source = [{ name: '=1+1', amount: -10 }];
    const output = prepareRowsForSpreadsheet(source);
    expect(output[0]?.name).toBe("'=1+1");
    expect(source[0]?.name).toBe('=1+1');
    expect(output[0]?.amount).toBe(-10);
  });
});
