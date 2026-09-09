# Security

## Data handling

Excel Workbench is designed as a local-first static web application.

- Spreadsheet files are read through the Browser File API.
- Spreadsheet rows are processed in browser memory.
- The application has no customer-file upload endpoint.
- Imported spreadsheet rows are not written to localStorage.
- Only reusable cleaning recipes and validation rules may be stored in localStorage.
- Settings export contains recipes and validation rules only.

## Untrusted spreadsheet input

User-selected spreadsheets are untrusted input.

The import layer enforces:

- `.xlsx`, `.xls`, `.csv` extension allowlist
- 20 MB per-file limit
- 50 data-bearing worksheets per workbook
- 100,000 data-row limit
- 300-column limit
- 5,000,000-cell table limit
- explicit worksheet selection for multi-sheet workbooks
- duplicate normalized-header rejection
- parse failures converted to user-facing errors

Spreadsheet-like output values beginning with formula-trigger characters are neutralized before CSV/XLSX export to reduce formula-injection risk.

## Dependency policy

The project uses the official SheetJS Community Edition 0.20.3 distribution rather than the obsolete npm-registry `xlsx@0.18.5` release.

Every CI verification runs `npm audit --audit-level=moderate`. Moderate, high, and critical audit findings fail the release gate.

## Browser security boundary

The hosted application must be served over HTTPS in production. It does not require application secrets, API keys, cookies, authentication tokens, or a customer-data backend for its local-first workflow.

Do not add analytics that capture spreadsheet contents, filenames, cell values, or validation-result data without an explicit privacy and security review.

## Reporting

Security issues should be reported through the repository owner rather than by attaching real customer spreadsheets to a public GitHub issue.
