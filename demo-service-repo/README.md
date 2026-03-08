# demo-service-repo

Minimal service used as auditable input for EIF/PCR mapping demos.

This service emits Nitro-shaped attestation payloads at `POST /.well-known/attestation` by signing a COSE document on demand using the configured certificate chain.

## Endpoints

- `GET /` -> Hello page
- `POST /.well-known/attestation` -> returns `{ platform, nonce, workload, evidence.nitro_attestation_doc_b64 }`

## Demo trust-root swap model

There are no demo-only fields in protocol responses. The checker decides trust solely from configured root cert(s).

- Service can use `demo-pki/root-cert.pem` + `demo-pki/leaf-cert.pem` + `demo-pki/leaf-key.pem`.
- Checker trusts whichever root cert path(s) are configured in `TRUST_ROOT_CERT_PATHS`.

## PCR generation workflow (real EIF path)

1. Build image:
   - `docker build -t demo-service:latest .`
2. Build EIF (on host with Nitro CLI installed):
   - `nitro-cli build-enclave --docker-uri demo-service:latest --output-file demo-service.eif`
3. Describe EIF measurements:
   - `nitro-cli describe-eif --eif-path demo-service.eif`
4. Copy `PCR0/PCR1/PCR2/(PCR8 if signed)` into facts storage and service env.

Notes:
- `build-enclave` can run in Linux environments where Nitro CLI is available.
- `run-enclave` and live NSM attestation generation require a Nitro-capable EC2 parent instance.
