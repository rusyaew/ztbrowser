# ZTBrowser Nitro MVP

This repository demonstrates Nitro attestation verification in a browser-assisted flow:

- `exampleserver.ts` serves a demo website and `POST /.well-known/attestation`
- `clientsidechecker.ts` verifies Nitro attestation document signatures + certificate chain + nonce + PCR extraction as a standalone checker API
- `facts-node/server.ts` exposes a public mapping from PCRs to repo/image metadata
- `ztbrowser-chrome-extension/` verifies attestation docs inside the extension, queries facts-node, and flips the lock icon

## Install

```bash
npm install
```

## Root-cert trust model

The verifier has a single verification flow. The only trust input is the selected root certificate set.

- Default: `fixtures/aws-nitro-root.pem`
- Demo/toy simulation: `fixtures/demo-pki/root-cert.pem`

No demo-specific protocol fields are required by extension, facts-node, or checker API.

## Run local demo services

Run these in **two separate terminals** for the extension flow:

Terminal 1:

```bash
npm run dev:facts
```

Terminal 2:

```bash
MODE=good npm run dev:example
```

Open `http://localhost:9999/`.

Expected behavior:
- `MODE=good`: icon becomes locked
- `MODE=bad`: icon stays unlocked

## Load extension

1. Open Chrome -> `chrome://extensions`
2. Enable Developer mode
3. Click **Load unpacked**
4. Select `ztbrowser-chrome-extension/`
5. Visit `http://localhost:9999/`

The popup shows verifier reason, verified PCRs, and repo/image metadata if facts-node has a matching PCR tuple.

## Standalone checker API

`clientsidechecker.ts` is still available when you want a separate verifier service or to exercise the old `/verify` API directly.

```bash
TRUST_ROOT_CERT_PATHS=./fixtures/demo-pki/root-cert.pem npm run dev:checker
```

## API smoke test

```bash
npm run smoke:api
```

This test still starts the standalone checker API with demo root trust, checks `MODE=good` success, then checks `MODE=bad` failure.

## Nitro / EIF notes

- Facts-node is metadata mapping, not cryptographic proof.
- `demo-service-repo/README.md` contains Docker + Nitro CLI commands for generating real EIF PCR measurements.
- `exampleserver.ts` and `demo-service-repo/server.js` both sign attestation docs per-request nonce (Nitro-shaped simulation mode).
