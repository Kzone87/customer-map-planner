import { describe, expect, it } from 'vitest';
import { validateSettingsBundle } from './settings-portability';

describe('portable workbench settings', () => {
  it('accepts a versioned recipe and validation-rule bundle', () => {
    const bundle = validateSettingsBundle({
      format: 'customer-data-workbench-settings',
      version: 1,
      exportedAt: '2026-09-10T00:00:00.000Z',
      recipes: [{ name: '월간 정리', operations: ['trim', 'email', 'dedupe'] }],
      rules: [{ id: 'r1', column: '거래처명', kind: 'required' }]
    });
    expect(bundle.recipes[0]?.name).toBe('월간 정리');
    expect(bundle.rules[0]?.column).toBe('거래처명');
  });

  it('rejects unknown bundle versions', () => {
    expect(() => validateSettingsBundle({
      format: 'customer-data-workbench-settings',
      version: 2,
      recipes: [],
      rules: []
    })).toThrow('지원하지 않는 버전');
  });

  it('rejects unsupported operations and malformed enum rules', () => {
    expect(() => validateSettingsBundle({
      format: 'customer-data-workbench-settings',
      version: 1,
      recipes: [{ name: '위험한 작업', operations: ['delete-everything'] }],
      rules: []
    })).toThrow('지원하지 않는 정리 단계');

    expect(() => validateSettingsBundle({
      format: 'customer-data-workbench-settings',
      version: 1,
      recipes: [],
      rules: [{ id: 'r1', column: '상태', kind: 'enum' }]
    })).toThrow('허용값');
  });
});
