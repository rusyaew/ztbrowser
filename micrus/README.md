# micrus

Minimal Python demo service for the `ztbrowser` attestation flow.

## What this server does

`micrus` serves a small password form demo and exposes `POST /.well-known/attestation` for the browser verification flow.

- It renders a page with `verified` / `unverified` modes.
- It generates a Nitro-shaped attestation document signed with the configured demo certificate chain.
- It includes workload metadata and configured `PCR0`/`PCR1`/`PCR2`/`PCR8` values in the attestation response.
- It accepts password submissions only in `verified` mode and stores password hashes, not plaintext secrets.

This is a demo service, not a real Nitro enclave. By default it signs simulated attestation documents using the demo PKI under `fixtures/demo-pki/`.

## Local setup

```bash
cd /Users/tati/ztbrowser/micrus
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python demo.py
```

## IDE interpreter

Point your editor to:

```bash
/Users/tati/ztbrowser/micrus/.venv/bin/python
```

## Configuration

Supported environment variables are listed in `.env.example`.

If you are running this demo with the local checker, start the checker with the demo trust root:

```bash
TRUST_ROOT_CERT_PATHS=./fixtures/demo-pki/root-cert.pem npm run dev:checker
```

The checker reads `TRUST_ROOT_CERT_PATHS` (not `RUST_ROOT_CERT_PATHS`).

`ATTESTATION_MODE` controls the cryptographic behavior:

- `valid`: emit a correctly signed attestation
- `tampered`: corrupt the attestation signature while leaving the page mode unchanged

By default, the page toggle also drives the cryptographic verdict:

- page `verified` -> attestation mode `valid`
- page `unverified` -> attestation mode `tampered`

To force a specific attestation mode at startup, run:

```bash
docker run --rm -p 9999:3000 -e ATTESTATION_MODE=tampered micrus-demo
```

## Docker

```bash
docker build -f micrus/Dockerfile -t micrus-demo .
docker run --rm -p 9999:3000 micrus-demo
```

Build from the repository root so the image can copy `fixtures/demo-pki/` into the container.

## PCR generation workflow (real EIF path)

1. Build image from the repository root:
   - `docker build -f micrus/Dockerfile -t micrus-demo:latest .`
2. Build EIF on a Linux host where Nitro CLI is installed and `nitro-cli` is on `PATH`:
   - `nitro-cli build-enclave --docker-uri micrus-demo:latest --output-file micrus-demo.eif`
3. Describe EIF measurements:
   - `nitro-cli describe-eif --eif-path micrus-demo.eif`
4. Copy `PCR0/PCR1/PCR2/(PCR8 if signed)` into facts storage and service env.

Notes:
- `build-enclave` and `describe-eif` can run only in Linux environments where Nitro CLI is installed and available on `PATH`.
- `run-enclave` and live NSM attestation generation require a Nitro-capable EC2 parent instance.
