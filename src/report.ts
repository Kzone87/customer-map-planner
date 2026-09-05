import { DataProfile, DataRow, exportCsv, QualityIssue } from './data';

export type IssueFilter = 'all' | QualityIssue['type'];

const ISSUE_LABELS: Record<QualityIssue['type'], string> = {
  blank: '빈 값',
  email: '이메일',
  phone: '전화번호',
  duplicate: '중복'
};

function displayCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function currentIssueValue(row: DataRow | undefined, issue: QualityIssue) {
  if (!row) return null;
  if (issue.column === '-') {
    return Object.values(row).map(displayCell).join(' | ');
  }
  return row[issue.column] ?? null;
}

export function buildIssueReportRows(
  rows: DataRow[],
  profile: DataProfile,
  filter: IssueFilter = 'all'
): DataRow[] {
  return profile.issues
    .filter((issue) => filter === 'all' || issue.type === filter)
    .map((issue) => ({
      행번호: issue.rowIndex + 1,
      컬럼: issue.column === '-' ? '전체 행' : issue.column,
      유형: ISSUE_LABELS[issue.type],
      메시지: issue.message,
      현재값: currentIssueValue(rows[issue.rowIndex], issue)
    }));
}

export function exportIssueReportCsv(
  rows: DataRow[],
  profile: DataProfile,
  filter: IssueFilter = 'all'
): Blob {
  return exportCsv(buildIssueReportRows(rows, profile, filter));
}
