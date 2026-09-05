import { CellValue, DataRow } from './data';

export type RuleKind = 'required' | 'email' | 'number' | 'enum';

export type ValidationRule = {
  id: string;
  column: string;
  kind: RuleKind;
  parameter?: string;
};

export type RuleIssue = {
  ruleId: string;
  rowIndex: number;
  column: string;
  kind: RuleKind;
  message: string;
  value: CellValue;
};

const RULE_KINDS = new Set<RuleKind>(['required', 'email', 'number', 'enum']);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isRuleKind(value: unknown): value is RuleKind {
  return typeof value === 'string' && RULE_KINDS.has(value as RuleKind);
}

function text(value: CellValue): string {
  return value === null ? '' : String(value).trim();
}

function ruleMessage(rule: ValidationRule): string {
  switch (rule.kind) {
    case 'required': return '필수값이 비어 있습니다.';
    case 'email': return '이메일 형식이 올바르지 않습니다.';
    case 'number': return '숫자 형식이 아닙니다.';
    case 'enum': return `허용값이 아닙니다: ${rule.parameter ?? ''}`;
  }
}

function violates(value: CellValue, rule: ValidationRule): boolean {
  const current = text(value);
  if (rule.kind === 'required') return current.length === 0;
  if (!current) return false;
  if (rule.kind === 'email') return !EMAIL_PATTERN.test(current);
  if (rule.kind === 'number') return !Number.isFinite(Number(current.replace(/,/g, '')));
  const allowed = (rule.parameter ?? '').split(',').map((item) => item.trim()).filter(Boolean);
  return allowed.length > 0 && !allowed.includes(current);
}

export function validateRules(rows: DataRow[], rules: ValidationRule[]): RuleIssue[] {
  const issues: RuleIssue[] = [];
  rows.forEach((row, rowIndex) => {
    rules.forEach((rule) => {
      const value = row[rule.column] ?? null;
      if (violates(value, rule)) {
        issues.push({
          ruleId: rule.id,
          rowIndex,
          column: rule.column,
          kind: rule.kind,
          message: ruleMessage(rule),
          value
        });
      }
    });
  });
  return issues;
}

export function sanitizeRules(value: unknown, columns: string[]): ValidationRule[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate): ValidationRule[] => {
    if (!candidate || typeof candidate !== 'object') return [];
    const record = candidate as Record<string, unknown>;
    if (typeof record.id !== 'string' || typeof record.column !== 'string' || !isRuleKind(record.kind)) return [];
    if (!columns.includes(record.column)) return [];
    const parameter = typeof record.parameter === 'string' ? record.parameter.slice(0, 500) : undefined;
    if (record.kind === 'enum' && !parameter?.split(',').some((item) => item.trim())) return [];
    return [{ id: record.id.slice(0, 80), column: record.column, kind: record.kind, parameter }];
  });
}

export function ruleLabel(rule: ValidationRule): string {
  const labels: Record<RuleKind, string> = {
    required: '필수값',
    email: '이메일',
    number: '숫자',
    enum: '허용값'
  };
  const suffix = rule.kind === 'enum' && rule.parameter ? ` · ${rule.parameter}` : '';
  return `${rule.column} · ${labels[rule.kind]}${suffix}`;
}
