import { describe, expect, it } from 'vitest';
import { applyWorkflowPreset, buildMigrationReport, runBatch, sanitizeWorkflowPreset, WorkflowPreset } from './workflow';

const preset: WorkflowPreset = {
  version: 1,
  name: '거래처 파일 정리',
  mappings: [
    { source: '거래처명', target: '업체명' },
    { source: '메일', target: '이메일' },
    { source: '전화', target: '연락처' }
  ],
  operations: ['trim', 'email', 'phone'],
  rules: [
    { id: 'r-company', column: '업체명', kind: 'required' },
    { id: 'r-email', column: '이메일', kind: 'email' }
  ],
  targetColumns: ['업체명', '이메일', '연락처']
};

describe('workflow preset', () => {
  it('maps cleans validates and projects to the target schema', () => {
    const result = applyWorkflowPreset([
      { 거래처명: ' ACME ', 메일: 'SALES@ACME.COM', 전화: '01012345678', 임시: 'drop-me' }
    ], preset);
    expect(result.rows).toEqual([{ 업체명: 'ACME', 이메일: 'sales@acme.com', 연락처: '010-1234-5678' }]);
    expect(result.issues).toEqual([]);
    expect(result.columns).toEqual(['업체명', '이메일', '연락처']);
  });

  it('keeps validation issues while producing migration rows', () => {
    const result = applyWorkflowPreset([
      { 거래처명: '', 메일: 'broken-mail', 전화: '01012345678' }
    ], preset);
    expect(result.rows).toHaveLength(1);
    expect(result.issues.map((issue) => issue.ruleId)).toEqual(['r-company', 'r-email']);
  });

  it('rejects presets that cannot satisfy requested output fields', () => {
    expect(() => applyWorkflowPreset([
      { 거래처명: 'A', 메일: 'a@example.com', 전화: '01012345678' }
    ], { ...preset, targetColumns: ['업체명', '없는항목'] })).toThrow(/결과에 남길/);
  });

  it('sanitizes untrusted preset data to allow-listed operations and rules', () => {
    const sanitized = sanitizeWorkflowPreset({
      name: ' Demo ',
      mappings: [{ source: 'A', target: '업체명' }, { source: 1, target: 'bad' }],
      operations: ['trim', 'delete-all', 'email'],
      rules: [{ id: 'x', column: '업체명', kind: 'required' }, { id: 'bad', column: 'x', kind: 'script' }],
      targetColumns: ['업체명', '업체명', '', 123]
    });
    expect(sanitized.name).toBe('Demo');
    expect(sanitized.operations).toEqual(['trim', 'email']);
    expect(sanitized.rules).toHaveLength(1);
    expect(sanitized.targetColumns).toEqual(['업체명']);
  });
});

describe('batch migration', () => {
  it('isolates validation failures and structural errors per file', () => {
    const results = runBatch([
      { name: 'ok.xlsx', rows: [{ 거래처명: 'A', 메일: 'a@example.com', 전화: '01012345678' }] },
      { name: 'invalid.xlsx', rows: [{ 거래처명: '', 메일: 'bad', 전화: '01012345678' }] },
      { name: 'wrong-schema.xlsx', rows: [{ 회사: 'B', 메일: 'b@example.com', 전화: '01012345678' }] }
    ], preset);
    expect(results.map((result) => result.status)).toEqual(['SUCCESS', 'VALIDATION_FAILED', 'ERROR']);
    const structuralError = results.at(2);
    expect(structuralError).toBeDefined();
    expect(structuralError?.error).toMatch(/존재하지 않는 원본 항목/);
  });

  it('builds a customer-facing report for every input file', () => {
    const results = runBatch([
      { name: 'ok.csv', rows: [{ 거래처명: 'A', 메일: 'a@example.com', 전화: '01012345678' }] }
    ], preset);
    expect(buildMigrationReport(results)).toEqual([
      { 파일: 'ok.csv', 상태: '정상 완료', 행수: 1, 확인할내용: 0, 안내: '' }
    ]);
  });
});