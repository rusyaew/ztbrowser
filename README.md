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

## AWS CLI automation

`dev/nika` carries a local AWS CLI orchestration layer under `scripts/aws-cli/`.

What it does:

- creates or reuses the EC2 key pair
- creates or reuses a dedicated security group
- keeps SSH restricted to your current public IP by default
- allows additional SSH CIDRs with repeated `--extra-ssh-cidr`
- creates or updates the launch template with Nitro Enclaves enabled
- reuses an existing tagged instance when possible
- deploys a tagged enclave release over SSH

Important cleanup behavior:

- `scripts/aws-cli/full-deploy.sh` terminates the instance by default after verification
- pass `--pause` to stop the instance instead of terminating it
- `scripts/aws-cli/deploy-release.sh` does no cleanup and leaves the instance running

One-time local prerequisites:

1. Install AWS CLI v2:

```bash
curl -fsSL https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip -o /tmp/awscliv2.zip
cd /tmp
unzip -q awscliv2.zip
sudo ./aws/install
```

2. Create deploy credentials:

- If you already have an admin-capable AWS CLI profile, bootstrap the deploy user entirely by CLI:

```bash
AWS_PROFILE=<admin-profile> scripts/aws-cli/bootstrap-iam.sh --profile-name ztbrowser
```

- If you have no AWS CLI credentials at all yet, that first admin credential still has to come from IAM or AWS account setup. There is no safe way to bootstrap AWS access from zero entirely inside this repo.

3. Verify the deploy profile works:

```bash
AWS_PROFILE=ztbrowser scripts/aws-cli/check-prereqs.sh
```

End-to-end ephemeral deploy:

```bash
AWS_PROFILE=ztbrowser scripts/aws-cli/full-deploy.sh --release-tag v0.1.3
```

Reusable instance deploy:

```bash
AWS_PROFILE=ztbrowser scripts/aws-cli/ensure-instance.sh
AWS_PROFILE=ztbrowser scripts/aws-cli/deploy-release.sh --host <public-ip> --release-tag v0.1.3
```
