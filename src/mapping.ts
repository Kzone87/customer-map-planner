import { DataRow } from './data';

export type ColumnMapping = { source: string; target: string };

export function normalizeMappings(mappings: ColumnMapping[]): ColumnMapping[] {
  return mappings
    .map((mapping) => ({ source: mapping.source.trim(), target: mapping.target.trim() }))
    .filter((mapping) => mapping.source && mapping.target && mapping.source !== mapping.target);
}

export function validateMappings(columns: string[], mappings: ColumnMapping[]): string[] {
  const errors: string[] = [];
  const normalized = normalizeMappings(mappings);
  const sourceSet = new Set<string>();
  const targetSet = new Set<string>();
  const mappedSources = new Set(normalized.map((mapping) => mapping.source));

  for (const mapping of normalized) {
    if (!columns.includes(mapping.source)) errors.push(`존재하지 않는 원본 컬럼: ${mapping.source}`);
    if (sourceSet.has(mapping.source)) errors.push(`원본 컬럼 중복 매핑: ${mapping.source}`);
    if (targetSet.has(mapping.target)) errors.push(`표준 컬럼 이름 충돌: ${mapping.target}`);
    if (columns.includes(mapping.target) && !mappedSources.has(mapping.target)) errors.push(`기존 컬럼과 충돌: ${mapping.target}`);
    sourceSet.add(mapping.source);
    targetSet.add(mapping.target);
  }
  return [...new Set(errors)];
}

export function applyColumnMappings(rows: DataRow[], mappings: ColumnMapping[]): DataRow[] {
  if (rows.length === 0) return [];
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const errors = validateMappings(columns, mappings);
  if (errors.length) throw new Error(errors.join('\n'));
  const map = new Map(normalizeMappings(mappings).map((mapping) => [mapping.source, mapping.target]));
  return rows.map((row) => {
    const output: DataRow = {};
    for (const [key, value] of Object.entries(row)) output[map.get(key) ?? key] = value;
    return output;
  });
}

export function sanitizeMappings(value: unknown, columns: string[]): ColumnMapping[] {
  if (!Array.isArray(value)) return [];
  const candidates = value.flatMap((item): ColumnMapping[] => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    if (typeof record.source !== 'string' || typeof record.target !== 'string') return [];
    const source = record.source.trim();
    const target = record.target.trim().slice(0, 120);
    if (!columns.includes(source) || !target) return [];
    return [{ source, target }];
  });
  return validateMappings(columns, candidates).length === 0 ? normalizeMappings(candidates) : [];
}
