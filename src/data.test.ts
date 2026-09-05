import { describe, expect, it } from 'vitest';
import {
  formatPhone,
  normalizeEmails,
  normalizeWhitespace,
  profileRows,
  removeDuplicateRows,
  SAMPLE_ROWS
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
