import { describe, expect, it } from 'vitest';
import { changeReportRows, compareDatasets, sharedColumns } from './compare';
import type { DataRow } from './data';

const before: DataRow[] = [
  { 고객ID:'A-001', 회사명:'Alpha', 상태:'ACTIVE', 금액:'1000' },
  { 고객ID:'A-002', 회사명:'Beta', 상태:'ACTIVE', 금액:'2000' },
  { 고객ID:'A-003', 회사명:'Gamma', 상태:'INACTIVE', 금액:'3000' }
];

const after: DataRow[] = [
  { 고객ID:'A-001', 회사명:'Alpha', 상태:'ACTIVE', 금액:'1000' },
  { 고객ID:'A-002', 회사명:'Beta', 상태:'INACTIVE', 금액:'2500' },
  { 고객ID:'A-004', 회사명:'Delta', 상태:'ACTIVE', 금액:'4000' }
];

describe('compareDatasets', () => {
  it('classifies added, removed, changed and unchanged rows', () => {
    const result = compareDatasets(before, after, '고객ID');
    expect(result.summary).toEqual({ added:1, removed:1, changed:1, unchanged:1, total:4 });
    expect(result.entries.find((entry) => entry.key === 'A-002')).toMatchObject({
      status:'CHANGED',
      changedColumns:['상태','금액']
    });
    expect(result.entries.find((entry) => entry.key === 'A-004')?.status).toBe('ADDED');
    expect(result.entries.find((entry) => entry.key === 'A-003')?.status).toBe('REMOVED');
  });

  it('blocks duplicate keys before comparing', () => {
    expect(() => compareDatasets([...before, { ...before[0] }], after, '고객ID')).toThrow(/중복 키/);
  });

  it('blocks blank keys', () => {
    expect(() => compareDatasets([{ 고객ID:'', 회사명:'Blank' }], after, '고객ID')).toThrow(/비어 있습니다/);
  });

  it('requires the key column on both datasets', () => {
    expect(() => compareDatasets(before, [{ other:'x' }], '고객ID')).toThrow(/두 파일에 모두 존재/);
  });

  it('builds an export-friendly change report without unchanged rows by default', () => {
    const result = compareDatasets(before, after, '고객ID');
    const rows = changeReportRows(result);
    expect(rows).toHaveLength(3);
    expect(rows.some((row) => row.상태 === 'UNCHANGED')).toBe(false);
    expect(rows.find((row) => row.키 === 'A-002')).toMatchObject({
      상태:'CHANGED',
      변경컬럼:'상태, 금액',
      이전_상태:'ACTIVE',
      이후_상태:'INACTIVE'
    });
  });

  it('returns only columns shared by both files for key selection', () => {
    expect(sharedColumns(before, after)).toEqual(['고객ID','회사명','상태','금액']);
  });
});
