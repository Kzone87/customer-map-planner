import { describe, expect, it } from 'vitest';
import { sanitizeRules, validateRules, ValidationRule } from './rules';

const rows = [
  { name: 'Alpha', email: 'alpha@example.com', amount: '1,200', status: 'ACTIVE' },
  { name: '', email: 'invalid-mail', amount: 'abc', status: 'UNKNOWN' },
  { name: 'Gamma', email: '', amount: 300, status: 'INACTIVE' }
];

const rules: ValidationRule[] = [
  { id: 'r1', column: 'name', kind: 'required' },
  { id: 'r2', column: 'email', kind: 'email' },
  { id: 'r3', column: 'amount', kind: 'number' },
  { id: 'r4', column: 'status', kind: 'enum', parameter: 'ACTIVE,INACTIVE' }
];

describe('rule validation engine', () => {
  it('reports required, email, number and enum violations', () => {
    const issues = validateRules(rows, rules);
    expect(issues).toHaveLength(4);
    expect(issues.map((issue) => issue.kind)).toEqual(['required', 'email', 'number', 'enum']);
    expect(issues.every((issue) => issue.rowIndex === 1)).toBe(true);
  });

  it('treats blank optional email as valid', () => {
    const issues = validateRules(rows, [{ id: 'email', column: 'email', kind: 'email' }]);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.rowIndex).toBe(1);
  });

  it('accepts comma-formatted numeric text', () => {
    const issues = validateRules(rows, [{ id: 'amount', column: 'amount', kind: 'number' }]);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.value).toBe('abc');
  });
});

describe('stored rule sanitization', () => {
  it('keeps only supported rules for existing columns', () => {
    const stored = [
      { id: 'ok', column: 'status', kind: 'enum', parameter: 'ACTIVE,INACTIVE' },
      { id: 'bad-kind', column: 'status', kind: 'regex' },
      { id: 'bad-column', column: 'missing', kind: 'required' },
      { id: 'empty-enum', column: 'status', kind: 'enum', parameter: '   ' }
    ];
    expect(sanitizeRules(stored, ['status'])).toEqual([
      { id: 'ok', column: 'status', kind: 'enum', parameter: 'ACTIVE,INACTIVE' }
    ]);
  });
});
