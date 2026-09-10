# Delivery artifact scope

The customer handover unit is the generated `dist/` directory, not the repository source tree. CI builds it from the release SHA, generates `MANIFEST.json`, verifies every SHA-256 digest, proves tamper rejection, and retains the exact artifact. GitHub Pages deploys that same manifest-bearing output on main.
