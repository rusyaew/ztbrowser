# AGENTS.md

Repository guidance for coding agents working in `ztbrowser`.

## Project purpose

ZTBrowser is a browser-side attestation verification project.

Current intended trust story:

- a website exposes `POST /.well-known/attestation`
- the browser extension requests attestation
- local `clientsidechecker` verifies the Nitro attestation document against trusted roots
- facts DB maps PCR tuples to public workload metadata
- the extension shows a lock when the attestation verifies

Current stronger demo property:

- on the real AWS Nitro path, `GET /` is now generated inside the enclave and forwarded through the parent instance over `vsock`
- so the landing page bytes can reasonably be described as enclave-originated

## Core components

- [exampleserver.ts](/home/gleb/zt-tech/ztbrowser/exampleserver.ts)
  - local/demo attestation service
- [clientsidechecker.ts](/home/gleb/zt-tech/ztbrowser/clientsidechecker.ts)
  - local verifier on `POST /verify`
  - verifies signature, chain, nonce, PCR extraction
- [facts-node/server.ts](/home/gleb/zt-tech/ztbrowser/facts-node/server.ts)
  - PCR lookup service and public facts table
- [ztbrowser-chrome-extension/](/home/gleb/zt-tech/ztbrowser/ztbrowser-chrome-extension)
  - extension logic, icon state, popup
- [src/shared/nitroAttestation.ts](/home/gleb/zt-tech/ztbrowser/src/shared/nitroAttestation.ts)
  - shared Nitro attestation verification logic
- [aws-deploy/parent-proxy/](/home/gleb/zt-tech/ztbrowser/aws-deploy/parent-proxy)
  - real AWS parent-instance HTTP proxy
- [aws-deploy/enclave-server/](/home/gleb/zt-tech/ztbrowser/aws-deploy/enclave-server)
  - real enclave-side Rust service using NSM

## Trust model

This repo intentionally keeps one verifier protocol and swaps only trust roots.

Rules:

- do not add protocol-level demo markers
- real and demo verifier behavior should stay structurally identical
- trust-anchor choice is the only supported mode switch

Current trust roots:

- real AWS Nitro:
  - [aws-nitro-root.pem](/home/gleb/zt-tech/ztbrowser/fixtures/aws-nitro-root.pem)
- demo/toy mode:
  - [root-cert.pem](/home/gleb/zt-tech/ztbrowser/fixtures/demo-pki/root-cert.pem)

## Current extension assumptions

- checker URL:
  - `http://localhost:3000/verify`
- facts DB URL:
  - `https://facts-db.onrender.com`
- extension no longer injects visible UI into the page
- debug should go to:
  - extension popup
  - browser console
  - extension service worker console

If changing extension networking:

- prefer background-service-worker fetches for privileged cross-origin requests
- avoid direct content-script fetches to local services when the page origin is remote

## Local development paths

### Local demo path

Use 3 terminals:

1. `npm run dev:facts`
2. `TRUST_ROOT_CERT_PATHS=./fixtures/demo-pki/root-cert.pem npm run dev:checker`
3. `MODE=good npm run dev:example`

Then load the unpacked extension from:

- [ztbrowser-chrome-extension/](/home/gleb/zt-tech/ztbrowser/ztbrowser-chrome-extension)

Open:

- `http://localhost:9999/`

### Real AWS path

The authoritative runbook is:

- [AWS-DEPLOY.md](/home/gleb/zt-tech/ztbrowser/AWS-DEPLOY.md)

That document reflects the currently working Nitro deployment and should be updated if the live deployment process changes.

## Reproducibility requirements

For the real enclave build, preserve these properties:

1. pinned Docker base-image digests in:
   - [Dockerfile](/home/gleb/zt-tech/ztbrowser/aws-deploy/enclave-server/Dockerfile)
2. `Cargo.lock` copied into the enclave build context
3. `cargo build --locked` used inside the enclave image build
4. helper scripts aligned with actual working allocator/runtime settings

Do not casually relax these, or PCRs will drift.

Current working AWS allocator/runtime values:

- `memory_mib: 2048`
- `cpu_count: 2`
- enclave CID: `16`
- vsock port: `5005`
- public parent proxy port: `9999`

## Validation commands

Repository checks:

- `npx tsc --noEmit`
- `cargo check --manifest-path aws-deploy/parent-proxy/Cargo.toml`
- `cargo check --manifest-path aws-deploy/enclave-server/Cargo.toml`

Local API smoke:

- `npm run smoke:api`

Useful live AWS checks:

- `nitro-cli describe-enclaves`
- `ss -ltnp | grep 9999`
- `tail -n 100 /tmp/ztbrowser-parent-proxy.log`

## Safety and repo hygiene

This repo intentionally contains demo PKI private keys for reproducible simulation.

Tracked demo private-key locations:

- [root-key.pem](/home/gleb/zt-tech/ztbrowser/fixtures/demo-pki/root-key.pem)
- [leaf-key.pem](/home/gleb/zt-tech/ztbrowser/fixtures/demo-pki/leaf-key.pem)
- [root-key.pem](/home/gleb/zt-tech/ztbrowser/demo-service-repo/demo-pki/root-key.pem)
- [leaf-key.pem](/home/gleb/zt-tech/ztbrowser/demo-service-repo/demo-pki/leaf-key.pem)

Policy for this repo:

- this is accepted intentionally for demo reproducibility
- these keys are non-production only
- do not treat them as secrets worth preserving
- do not accidentally mix them into real trust roots or production infra

Other hygiene rules:

- do not commit `node_modules/`
- do not rely on live EC2 public IPs as stable identifiers
- prefer documenting reproducible steps in repo files over host-only changes
- if AWS deployment behavior changes, update [AWS-DEPLOY.md](/home/gleb/zt-tech/ztbrowser/AWS-DEPLOY.md) in the same change

## What agents should preserve

- `POST /.well-known/attestation` contract
- local checker API shape
- extension lock semantics
- facts lookup shape unless explicitly changing the trust model

If making architectural changes:

- keep the external verifier workflow coherent
- separate cryptographic verification from metadata lookup
- document any PCR-impacting build changes
