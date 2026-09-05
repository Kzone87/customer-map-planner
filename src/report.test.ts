import { describe, expect, it } from 'vitest';
import { DataProfile, profileRows, SAMPLE_ROWS } from './data';
import { buildIssueReportRows, exportIssueReportCsv } from './report';

describe('validation issue report', () => {
  it('converts every detected issue into a report row', () => {
    const profile = profileRows(SAMPLE_ROWS);
    const report = buildIssueReportRows(SAMPLE_ROWS, profile);

    expect(report).toHaveLength(profile.issues.length);
    expect(report[0]).toHaveProperty('행번호');
    expect(report[0]).toHaveProperty('유형');
    expect(report[0]).toHaveProperty('현재값');
  });

  it('exports only the selected issue type', () => {
    const profile = profileRows(SAMPLE_ROWS);
    const report = buildIssueReportRows(SAMPLE_ROWS, profile, 'email');

    expect(report).toHaveLength(1);
    expect(report[0]?.유형).toBe('이메일');
    expect(report[0]?.현재값).toBe('invalid-mail');
  });

  it('reuses spreadsheet-safe export for report values', async () => {
    const rows = [{ name: '=1+1' }];
    const profile: DataProfile = {
      rows: 1,
      columns: ['name'],
      blankCells: 0,
      invalidEmails: 0,
      invalidPhones: 0,
      duplicateRows: 0,
      issues: [{ rowIndex: 0, column: 'name', type: 'blank', message: '검수 필요' }]
    };

    const csv = await exportIssueReportCsv(rows, profile).text();
    expect(csv).toContain("'=1+1");
  });
});
