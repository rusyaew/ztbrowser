# AWS Nitro deployment path

This folder now contains only the AWS-facing integration pieces that complement the canonical enclave repo:

- `parent-proxy/`: public HTTP service that runs on the EC2 parent instance
- `provenance.example.json`: example of the canonical release manifest consumed by the parent proxy

The measured enclave source of truth now lives in:

- `https://github.com/rusyaew/ztinfra-enclaveproducedhtml`

The public contract stays aligned with the existing browser flow:

- `GET /`
- `POST /.well-known/attestation`

The parent proxy forwards nonce requests to the enclave over `vsock`, then returns:

- `platform: aws_nitro_eif`
- `nonce`: echoed nonce
- `workload`: metadata loaded from canonical `provenance.json`
- `evidence.nitro_attestation_doc_b64`: real AWS-root-backed Nitro attestation doc

## Canonical deploy flow

1. Fetch a tagged enclave release:

```bash
scripts/fetch-enclave-release.sh <release-tag>
```

2. Run the enclave from the downloaded EIF:

```bash
scripts/aws-run-enclave.sh
```

3. Run the parent proxy with canonical metadata from the downloaded manifest:

```bash
PROVENANCE_PATH=aws-deploy/build/provenance.json \
MEASUREMENTS_PATH=aws-deploy/build/describe-eif.json \
cargo run --release --manifest-path aws-deploy/parent-proxy/Cargo.toml
```

If both `PROVENANCE_PATH` and `MEASUREMENTS_PATH` are provided, the parent proxy validates that their PCRs match before serving traffic.
