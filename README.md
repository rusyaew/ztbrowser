# ZTBrowser Nitro MVP

This repository demonstrates Nitro attestation verification in a browser-assisted flow:

- `exampleserver.ts` serves a demo website and `POST /.well-known/attestation`
- `clientsidechecker.ts` verifies Nitro attestation document signatures + certificate chain + nonce + PCR extraction
- `facts-node/server.ts` exposes a public mapping from PCRs to repo/image metadata
- `ztbrowser-chrome-extension/` queries checker + facts-node and flips lock icon

## Install

```bash
npm install
```

## Root-cert trust model

`clientsidechecker` has a single verification flow. The only trust input is `TRUST_ROOT_CERT_PATHS`.

- Default: `fixtures/aws-nitro-root.pem`
- Demo/toy simulation: set `TRUST_ROOT_CERT_PATHS=fixtures/demo-pki/root-cert.pem`

No demo-specific protocol fields are required by extension, facts-node, or checker API.

## Run local demo services

Run these in **three separate terminals**:

Terminal 1:

```bash
npm run dev:facts
```

Terminal 2:

```bash
TRUST_ROOT_CERT_PATHS=./fixtures/demo-pki/root-cert.pem npm run dev:checker
```

Terminal 3:

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

## API smoke test

```bash
npm run smoke:api
```

This test starts all services with demo root trust, checks `MODE=good` success, then checks `MODE=bad` failure.

## Nitro / EIF notes

- Facts-node is metadata mapping, not cryptographic proof.
- `demo-service-repo/README.md` contains Docker + Nitro CLI commands for generating real EIF PCR measurements.
- `exampleserver.ts` and `demo-service-repo/server.js` both sign attestation docs per-request nonce (Nitro-shaped simulation mode).

## Real AWS Nitro deployment

The real AWS deployment path lives under `aws-deploy/`:

- `aws-deploy/parent-proxy/`: public HTTP service on the EC2 parent instance
- `aws-deploy/enclave-server/`: enclave-only `vsock` service that requests a real NSM attestation document

This keeps the browser/checker contract unchanged while replacing demo signing with a real AWS-root-backed attestation document.

High-level flow:

1. Browser calls `POST /.well-known/attestation` on the parent instance.
2. Parent proxy forwards `{ nonce_hex }` over `vsock` to the enclave.
3. Enclave calls NSM and returns a real attestation document.
4. Parent proxy responds with:
   - `platform: aws_nitro_eif`
   - `nonce`
   - `workload` metadata and PCR transparency fields
   - `evidence.nitro_attestation_doc_b64`

Typical EC2 commands:

```bash
sudo dnf install aws-nitro-enclaves-cli aws-nitro-enclaves-cli-devel docker git tmux -y
sudo usermod -aG ne ec2-user
sudo usermod -aG docker ec2-user
sudo systemctl enable --now docker
```

After reconnecting, configure the allocator:

```bash
sudo tee /etc/nitro_enclaves/allocator.yaml >/dev/null <<'EOF'
---
memory_mib: 512
cpu_count: 2
EOF
sudo systemctl enable --now nitro-enclaves-allocator.service
```

Then build and run:

```bash
scripts/aws-build-enclave.sh
scripts/aws-run-enclave.sh
MEASUREMENTS_PATH=aws-deploy/build/describe-eif.json cargo run --release --manifest-path aws-deploy/parent-proxy/Cargo.toml
```

See [aws-deploy/README.md](/home/gleb/zt-tech/ztbrowser/aws-deploy/README.md) for the AWS-specific details.
