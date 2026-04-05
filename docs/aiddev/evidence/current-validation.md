# Current Validation Evidence

This note captures the current repo-only validation pass after syncing the AIDev package to merged truth.

## ztbrowser validation

Executed in `/tmp/ztbrowser-facts-pr`.

- `npm run typecheck`
  - pass
- `npx -y node@22.12.0 /usr/bin/npm run test:unit`
  - pass, `24` tests across `6` files
- `npx vitest run tests/integration/facts-node/factsDb.test.mjs tests/integration/facts-node/server.test.mjs tests/unit/extension/attestationVerifier.test.mjs`
  - pass, `11` tests across `3` files
- `npm run smoke:api`
  - pass
  - proves both the legacy Nitro compatibility path and the release-centered realization lookup path

## What this validates

- the facts-node test is visible to Vitest as `.mjs`
- the smoke script checks release-centered lookup, not only PCR lookup
- the repository-level Node 22.12 floor is compatible with the current test suite

## What this does not claim

- live AWS CoCo substrate proof
- production AWS operator CI
- removal of the Nitro compatibility path
