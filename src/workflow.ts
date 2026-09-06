import {
  applyOperation,
  DataRow,
  getColumns,
  isOperationKind,
  OperationKind,
  prepareRowsForSpreadsheet
} from './data';
import { applyColumnMappings, ColumnMapping, validateMappings } from './mapping';
import { isRuleKind, RuleIssue, ValidationRule, validateRules } from './rules';

export type WorkflowPreset = {
  version: 1;
  name: string;
  mappings: ColumnMapping[];
  operations: OperationKind[];
  rules: ValidationRule[];
  targetColumns: string[];
};

export type WorkflowResult = {
  rows: DataRow[];
  issues: RuleIssue[];
  columns: string[];
  targetColumns: string[];
};

export type BatchItem = {
  name: string;
  rows: DataRow[];
};

export type BatchResult = {
  name: string;
  status: 'SUCCESS' | 'VALIDATION_FAILED' | 'ERROR';
  rows: DataRow[];
  issues: RuleIssue[];
  error: string | null;
};

function cleanName(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 80) : '';
}

function cleanTargetColumns(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const output: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const column = item.trim().slice(0, 120);
    if (!column || seen.has(column)) continue;
    seen.add(column);
    output.push(column);
  }
  return output.slice(0, 200);
}

export function sanitizeWorkflowPreset(value: unknown): WorkflowPreset {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Preset must be a JSON object.');
  const record = value as Record<string, unknown>;
  const name = cleanName(record.name);
  if (!name) throw new Error('Preset name is required.');

  const mappings: ColumnMapping[] = Array.isArray(record.mappings)
    ? record.mappings.flatMap((item): ColumnMapping[] => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
        const mapping = item as Record<string, unknown>;
        if (typeof mapping.source !== 'string' || typeof mapping.target !== 'string') return [];
        const source = mapping.source.trim().slice(0, 120);
        const target = mapping.target.trim().slice(0, 120);
        return source && target ? [{ source, target }] : [];
      })
    : [];

  const operations = Array.isArray(record.operations)
    ? [...new Set(record.operations.filter(isOperationKind))]
    : [];

  const rules: ValidationRule[] = Array.isArray(record.rules)
    ? record.rules.flatMap((item): ValidationRule[] => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
        const rule = item as Record<string, unknown>;
        if (typeof rule.id !== 'string' || typeof rule.column !== 'string' || !isRuleKind(rule.kind)) return [];
        const column = rule.column.trim().slice(0, 120);
        const parameter = typeof rule.parameter === 'string' ? rule.parameter.slice(0, 500) : undefined;
        if (!column) return [];
        if (rule.kind === 'enum' && !parameter?.split(',').some((entry) => entry.trim())) return [];
        return [{ id: rule.id.slice(0, 80), column, kind: rule.kind, parameter }];
      })
    : [];

  return {
    version: 1,
    name,
    mappings,
    operations,
    rules,
    targetColumns: cleanTargetColumns(record.targetColumns)
  };
}

export function validatePresetForColumns(columns: string[], preset: WorkflowPreset): string[] {
  const errors = validateMappings(columns, preset.mappings);
  const mappedColumns = columns.map((column) => preset.mappings.find((mapping) => mapping.source === column)?.target ?? column);
  const mappedSet = new Set(mappedColumns);
  for (const rule of preset.rules) {
    if (!mappedSet.has(rule.column)) errors.push(`규칙 대상 컬럼이 없습니다: ${rule.column}`);
  }
  if (preset.targetColumns.length) {
    for (const target of preset.targetColumns) {
      if (!mappedSet.has(target)) errors.push(`목표 스키마 컬럼을 만들 수 없습니다: ${target}`);
    }
  }
  return [...new Set(errors)];
}

function projectTargetSchema(rows: DataRow[], targetColumns: string[]): DataRow[] {
  if (!targetColumns.length) return rows;
  return rows.map((row) => Object.fromEntries(targetColumns.map((column) => [column, row[column] ?? null])));
}

export function applyWorkflowPreset(rows: DataRow[], preset: WorkflowPreset): WorkflowResult {
  if (!rows.length) throw new Error('데이터가 없습니다.');
  const inputColumns = getColumns(rows);
  const errors = validatePresetForColumns(inputColumns, preset);
  if (errors.length) throw new Error(errors.join('\n'));

  let output = applyColumnMappings(rows, preset.mappings);
  for (const operation of preset.operations) output = applyOperation(output, operation);
  const issues = validateRules(output, preset.rules);
  output = projectTargetSchema(output, preset.targetColumns);
  return {
    rows: prepareRowsForSpreadsheet(output),
    issues,
    columns: getColumns(output),
    targetColumns: preset.targetColumns
  };
}

export function runBatch(items: BatchItem[], preset: WorkflowPreset): BatchResult[] {
  return items.map((item) => {
    try {
      const result = applyWorkflowPreset(item.rows, preset);
      return {
        name: item.name,
        status: result.issues.length ? 'VALIDATION_FAILED' : 'SUCCESS',
        rows: result.rows,
        issues: result.issues,
        error: null
      };
    } catch (error) {
      return {
        name: item.name,
        status: 'ERROR',
        rows: [],
        issues: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });
}

export function buildMigrationReport(results: BatchResult[]) {
  return results.map((result) => ({
    file: result.name,
    status: result.status,
    rows: result.rows.length,
    validationIssues: result.issues.length,
    error: result.error ?? ''
  }));
}
