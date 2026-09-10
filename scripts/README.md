# Delivery scripts

- `build-delivery.mjs` creates `dist/MANIFEST.json` with byte sizes and SHA-256 digests.
- `verify-delivery.mjs` verifies that an artifact matches its manifest and rejects unsafe paths.
- `delivery-self-test.mjs` copies the built artifact, deliberately tampers with a file, and proves that verification fails closed.

These scripts contain no customer workbook data and operate only on the generated static application artifact.
