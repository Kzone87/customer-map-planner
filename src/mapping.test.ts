import { describe, expect, it } from 'vitest';
import { applyColumnMappings, sanitizeMappings, validateMappings } from './mapping';

const rows = [
  { 거래처명: 'Alpha', 연락처: '010-1111-1111', 상태: 'ACTIVE' },
  { 거래처명: 'Beta', 연락처: '010-2222-2222', 상태: 'INACTIVE' }
];

describe('column mapping engine', () => {
  it('renames columns without changing row values', () => {
    const mapped = applyColumnMappings(rows, [
      { source: '거래처명', target: 'company' },
      { source: '연락처', target: 'phone' }
    ]);
    expect(mapped[0]).toEqual({ company: 'Alpha', phone: '010-1111-1111', 상태: 'ACTIVE' });
    expect(rows[0]).toHaveProperty('거래처명');
  });

  it('rejects duplicate target names', () => {
    const errors = validateMappings(['a','b'], [
      { source: 'a', target: 'standard' },
      { source: 'b', target: 'standard' }
    ]);
    expect(errors.some((error) => error.includes('표준 컬럼 이름 충돌'))).toBe(true);
  });

  it('rejects collision with an untouched existing column', () => {
    expect(() => applyColumnMappings([{ a: 1, b: 2 }], [{ source: 'a', target: 'b' }])).toThrow('기존 컬럼과 충돌');
  });

  it('allows swap mappings when both existing columns are mapped', () => {
    const mapped = applyColumnMappings([{ a: 1, b: 2 }], [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'a' }
    ]);
    expect(mapped[0]).toEqual({ b: 1, a: 2 });
  });

  it('sanitizes stored mappings against current columns', () => {
    expect(sanitizeMappings([
      { source: '거래처명', target: 'company' },
      { source: 'missing', target: 'phone' },
      { source: 10, target: 'bad' }
    ], ['거래처명'])).toEqual([{ source: '거래처명', target: 'company' }]);
  });
});
