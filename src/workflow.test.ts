import { describe, expect, it } from 'vitest';
import { applyWorkflowPreset, buildMigrationReport, runBatch, sanitizeWorkflowPreset, WorkflowPreset } from './workflow';

const preset: WorkflowPreset = {
  version: 1,
  name: 'ERP customer migration',
  mappings: [
    { source: '거래처명', target: 'company' },
    { source: '메일', target: 'email' },
    { source: '전화', target: 'phone' }
  ],
  operations: ['trim', 'email', 'phone'],
  rules: [
    { id: 'r-company', column: 'company', kind: 'required' },
    { id: 'r-email', column: 'email', kind: 'email' }
  ],
  targetColumns: ['company', 'email', 'phone']
};

describe('workflow preset', () => {
  it('maps cleans validates and projects to the target schema', () => {
    const result = applyWorkflowPreset([
      { 거래처명: ' ACME ', 메일: 'SALES@ACME.COM', 전화: '01012345678', 임시: 'drop-me' }
    ], preset);
    expect(result.rows).toEqual([{ company: 'ACME', email: 'sales@acme.com', phone: '010-1234-5678' }]);
    expect(result.issues).toEqual([]);
    expect(result.columns).toEqual(['company', 'email', 'phone']);
  });

  it('keeps validation issues while producing migration rows', () => {
    const result = applyWorkflowPreset([
      { 거래처명: '', 메일: 'broken-mail', 전화: '01012345678' }
    ], preset);
    expect(result.rows).toHaveLength(1);
    expect(result.issues.map((issue) => issue.ruleId)).toEqual(['r-company', 'r-email']);
  });

  it('rejects presets that cannot satisfy the target schema', () => {
    expect(() => applyWorkflowPreset([
      { 거래처명: 'A', 메일: 'a@example.com', 전화: '01012345678' }
    ], { ...preset, targetColumns: ['company', 'missing'] })).toThrow(/목표 스키마/);
  });

  it('sanitizes untrusted preset JSON to allow-listed operations and rules', () => {
    const sanitized = sanitizeWorkflowPreset({
      name: ' Demo ',
      mappings: [{ source: 'A', target: 'company' }, { source: 1, target: 'bad' }],
      operations: ['trim', 'delete-all', 'email'],
      rules: [{ id: 'x', column: 'company', kind: 'required' }, { id: 'bad', column: 'x', kind: 'script' }],
      targetColumns: ['company', 'company', '', 123]
    });
    expect(sanitized.name).toBe('Demo');
    expect(sanitized.operations).toEqual(['trim', 'email']);
    expect(sanitized.rules).toHaveLength(1);
    expect(sanitized.targetColumns).toEqual(['company']);
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
    expect(structuralError?.error).toMatch(/존재하지 않는 원본 컬럼/);
  });

  it('builds a concise migration report for every input file', () => {
    const results = runBatch([
      { name: 'ok.csv', rows: [{ 거래처명: 'A', 메일: 'a@example.com', 전화: '01012345678' }] }
    ], preset);
    expect(buildMigrationReport(results)).toEqual([
      { file: 'ok.csv', status: 'SUCCESS', rows: 1, validationIssues: 0, error: '' }
    ]);
  });
});