# Excel Workbench Commercial Delivery

Excel Workbench is commercially delivered as a static, local-first browser application. Customer workbook contents are processed in browser memory and are not uploaded to an application backend.

The verified handover artifact is `dist/` produced by `npm run build:delivery`. `dist/MANIFEST.json` records SHA-256 and byte size for every application file; `npm run verify:delivery` rejects changed, missing, or substituted files.

This delivery contract includes tabular XLSX/XLS/CSV cleanup, validation, mapping, comparison, batch processing, downloads, and reusable browser settings within the documented limits. It does not include workbook-format preservation, macros, images, charts, shared server storage, user accounts, or server-side backup. Those are separate product requirements rather than hidden capabilities.

A release is commercially acceptable only after CI, dependency audit, tests, type-check/build, manifest verification, same-SHA Pages deployment, and production Chrome workflow QA are all green.
