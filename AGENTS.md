# AGENTS.md

Repository guidance for coding agents working in `ztbrowser`.

## Project purpose
- Verify Nitro-style attestation documents in a browser flow.
- Keep verification logic mode-agnostic: only checker trust roots change.
- Facts node is metadata mapping, not cryptographic trust.

## Core components
- `exampleserver.ts`: demo attestation service on `/.well-known/attestation`.
- `clientsidechecker.ts`: local verifier (`POST /verify`), signature + chain + nonce + PCR checks.
- `facts-node/server.ts`: PCR lookup and public facts table.
- `ztbrowser-chrome-extension/`: extension UI + runtime verification orchestration.
- `src/shared/nitroAttestation.ts`: shared COSE/CBOR/cert-chain verification logic.

## Local run commands
Use 3 terminals:

1. `npm run dev:facts`
2. `TRUST_ROOT_CERT_PATHS=./fixtures/demo-pki/root-cert.pem npm run dev:checker`
3. `MODE=good npm run dev:example`

Then load unpacked extension from `ztbrowser-chrome-extension/` and open `http://localhost:9999/`.

## Trust-root model (important)
- Do not add protocol-level “demo mode” markers.
- Checker behavior must stay identical across real/demo.
- Only trust anchor input should vary:
  - Real: `fixtures/aws-nitro-root.pem`
  - Demo: `fixtures/demo-pki/root-cert.pem`

## Validation
- Typecheck: `npx tsc --noEmit`
- API smoke: `npm run smoke:api`

## Safety and repo hygiene
- Demo keys/certs exist for reproducibility under `fixtures/demo-pki/` and `demo-service-repo/demo-pki/`.
- Treat these as non-production material only.
- Do not commit `node_modules/`.
- Keep extension/checker/facts contracts stable unless explicitly requested.
