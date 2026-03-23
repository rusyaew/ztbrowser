# AWS Nitro deployment path

This folder contains the real Nitro deployment components that complement the local Node demo:

- `parent-proxy/`: public HTTP service that runs on the EC2 parent instance
- `enclave-server/`: enclave-only attestation worker that requests a real NSM attestation document

The public contract stays aligned with the existing browser flow:

- `GET /`
- `POST /.well-known/attestation`

The parent proxy forwards nonce requests to the enclave over `vsock`, then returns:

- `platform: aws_nitro_eif`
- `nonce`: echoed nonce
- `workload`: PCR transparency metadata
- `evidence.nitro_attestation_doc_b64`: real AWS-root-backed Nitro attestation doc

## Measurements file

The parent proxy can read either:

1. a simple JSON file like `measurements.example.json`, or
2. raw `nitro-cli describe-eif --output-format json` output

Recommended build flow:

```bash
scripts/aws-build-enclave.sh
```

That produces:

- `aws-deploy/build/ztbrowser-enclave.eif`
- `aws-deploy/build/describe-eif.json`

Then run the parent proxy with:

```bash
MEASUREMENTS_PATH=aws-deploy/build/describe-eif.json \
WORKLOAD_ID=ztbrowser-aws-nitro \
REPO_URL=https://github.com/rusyaew/ztbrowser \
OCI_IMAGE_DIGEST=sha256:... \
cargo run --release --manifest-path aws-deploy/parent-proxy/Cargo.toml
```
