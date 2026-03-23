# AWS Nitro Deployment

This runbook now assumes the enclave workload is released from:

- `https://github.com/rusyaew/ztinfra-enclaveproducedhtml`

`ztbrowser` no longer builds the canonical EIF itself. It deploys a tagged enclave release and serves it through the parent proxy.

## Scope

- deploy only the AWS-facing server side
- keep checker local
- keep facts DB elsewhere
- consume canonical release artifacts from the dedicated enclave repo

## Canonical release artifacts

Each enclave release provides:

- `ztbrowser-enclave.eif`
- `describe-eif.json`
- `provenance.json`
- `SHA256SUMS`

`provenance.json` is the metadata authority for:

- `workload_id`
- `repo_url`
- `project_repo_url`
- `oci_image_digest`
- `pcr0/1/2/8`
- release tag and commit
- artifact hashes

## Fresh-host deploy

1. Launch a Nitro-enabled EC2 parent instance.
2. Install Docker, Rust, Nitro CLI, and allocator dependencies.
3. Copy `ztbrowser` to the host.
4. Fetch the enclave release:

```bash
cd ~/ztbrowser
scripts/fetch-enclave-release.sh <release-tag>
```

5. Run the enclave:

```bash
scripts/aws-run-enclave.sh
```

6. Run the parent proxy:

```bash
PROVENANCE_PATH=/home/ec2-user/ztbrowser/aws-deploy/build/provenance.json \
MEASUREMENTS_PATH=/home/ec2-user/ztbrowser/aws-deploy/build/describe-eif.json \
./scripts/aws-run-parent-proxy.sh
```

## Verification

- `GET /` should return enclave-generated HTML.
- `POST /.well-known/attestation` should return a real AWS-signed attestation doc.
- The local checker should validate the document against the AWS root.
- Facts lookup should match only after the canonical facts PR from the enclave release is merged.
