# Excel Workbench Delivery Runbook

## Product boundary

Excel Workbench is a local-first browser application for tabular Excel/CSV cleanup, validation, column mapping, comparison and repeated batch work.

Customer files are processed in browser memory. The application has no file-upload API and does not require an application database or customer-data server.

It is **not** a format-preserving spreadsheet editor. Imported workbooks are interpreted as tabular data and exported into newly generated CSV/XLSX files. Cell styles, charts, images, macros, comments, merged-cell layout and workbook-specific presentation are outside the delivery contract.

## Supported input contract

- `.xlsx`, `.xls`, `.csv`
- maximum file size: 20 MB per file
- maximum data-bearing worksheets: 50 per workbook
- maximum data rows: 100,000 per selected sheet
- maximum columns: 300 per selected sheet
- maximum table size: 5,000,000 cells
- multi-sheet workbooks require explicit worksheet selection
- duplicate normalized column headers are rejected instead of silently renamed
- CSV UTF-8 is the recommended interchange encoding

Batch processing isolates failures per file so one invalid file does not stop unrelated valid files.

## Data and settings boundary

Customer spreadsheet contents are not persisted by the product and are not transmitted to an application backend.

The browser stores only reusable workbench settings:

- cleaning recipes
- custom validation rules

Those settings can be exported as a versioned JSON file, cleared from the browser, and restored on another browser. The settings JSON never contains imported spreadsheet rows.

## Production build

Required build environment:

- Node.js 24
- npm

Build and verification:

```bash
npm install
npm run audit
npm test
npm run build
```

The deployable static output is `dist/`.

The current Vite base path is `/customer-map-planner/`. If the product is deployed under another path or domain, update `vite.config.ts`, rebuild, and rerun the browser acceptance suite against that deployment URL.

## Deployment options

The `dist/` directory may be deployed to any static HTTPS host, including GitHub Pages, Cloudflare Pages, S3-compatible static hosting, or a customer web server.

No application backend is required for the public local-first mode.

## Release acceptance gates

A release is accepted only when all of the following pass for the same source revision:

1. dependency audit has no moderate/high/critical findings
2. unit/domain tests pass
3. strict TypeScript type-check passes
4. production Vite build passes
5. real Chrome renders all four screens at 1440, 768 and 390 widths without horizontal overflow or runtime/network errors
6. real CSV import -> cleanup -> XLSX download passes
7. real multi-sheet XLSX import -> explicit worksheet selection passes
8. real legacy XLS Korean-data import passes
9. mapping -> apply -> download passes
10. compare -> diff -> download passes
11. batch -> isolated results -> report download passes
12. settings save -> JSON export -> clear -> JSON import -> restore passes
13. after merge, the same main SHA is deployed and the production URL passes the same Chrome suite

## Recovery and support

Because spreadsheet data is not stored by the application, there is no server-side customer-file restore process. Users should retain original source files separately.

Before browser/profile migration, export the workbench settings JSON if recipes or validation rules must be retained.

If a file is rejected by an import guardrail, reduce the file/table size or split the work into smaller files. Do not bypass the client-side processing limits in a customer deployment without repeating performance and browser-memory acceptance testing.

## Public production URL

https://kzone87.github.io/customer-map-planner/
