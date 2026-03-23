# ZTBrowser

ZTBrowser verifies Nitro-backed execution claims in the browser and enriches them with public facts metadata.

## Repo boundaries

- `ztbrowser` owns the parent proxy, extension, checker, facts node, and deployment wiring.
- The canonical measured enclave source now lives in:
  - `https://github.com/rusyaew/ztinfra-enclaveproducedhtml`

That split is deliberate: PCR facts are now anchored to the dedicated enclave repo, not to the entire integration repo.

## Local demo

Run locally in separate terminals:

```bash
npm run dev:facts
TRUST_ROOT_CERT_PATHS=./fixtures/demo-pki/root-cert.pem npm run dev:checker
MODE=good npm run dev:example
```

## Real AWS deploy

Canonical AWS deploys are artifact-first.

1. Fetch a tagged enclave release from `ztinfra-enclaveproducedhtml`:

```bash
scripts/fetch-enclave-release.sh <release-tag>
```

2. Run the EIF on the Nitro parent instance:

```bash
scripts/aws-run-enclave.sh
```

3. Run the parent proxy using the downloaded provenance manifest:

```bash
PROVENANCE_PATH=aws-deploy/build/provenance.json \
MEASUREMENTS_PATH=aws-deploy/build/describe-eif.json \
./scripts/aws-run-parent-proxy.sh
```

See `AWS-DEPLOY.md` for the full EC2 bring-up flow.
