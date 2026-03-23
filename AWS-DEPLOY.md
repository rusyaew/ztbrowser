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

## AWS CLI-driven deploy from a local machine

The repo now includes a local orchestration layer under `scripts/aws-cli/` so EC2 bring-up and deployment no longer has to be done manually in the console.

### What requires credentials

You need AWS API credentials locally for:

- listing instances
- creating or updating launch templates
- creating or importing key pairs
- creating or updating security groups
- starting, stopping, and terminating EC2 instances

For this workflow, those credentials are standard AWS access keys configured in a named profile, for example `ztbrowser`.

### One-time bootstrap

If you already have an admin-capable AWS CLI profile, bootstrap the deploy user with:

```bash
AWS_PROFILE=<admin-profile> scripts/aws-cli/bootstrap-iam.sh --profile-name ztbrowser
```

That script:

- creates or reuses IAM user `ztbrowser-cli`
- creates or reuses the deploy policy from [docs/aws/ztbrowser-ec2-nitro-deployer-policy.json](/home/gleb/zt-tech/ztbrowser-nika-awscli/docs/aws/ztbrowser-ec2-nitro-deployer-policy.json)
- creates one access key pair for that user
- writes the credentials into your local AWS CLI profile

If you do not have any AWS CLI credential yet, the very first admin credential still has to be created outside this repo. After that, the rest of the deploy flow is CLI-driven.

### Default automation behavior

The AWS CLI scripts intentionally encode the deployment defaults that already worked in manual testing:

- region: `us-east-1`
- AMI: latest AL2023 x86_64 resolved via SSM
- instance type: `m5.xlarge`
- key pair: `ztbrowser-nitro-key`
- SSH: current public IP only, plus any explicit `--extra-ssh-cidr`
- parent proxy port: `9999/tcp` open to `0.0.0.0/0`
- launch template name: `ztbrowser-nitro-parent`

### Main commands

Check local prerequisites:

```bash
AWS_PROFILE=ztbrowser scripts/aws-cli/check-prereqs.sh
```

Resolve the AMI that will be used:

```bash
AWS_PROFILE=ztbrowser scripts/aws-cli/resolve-ami.sh
```

Create or reuse the EC2 key pair:

```bash
AWS_PROFILE=ztbrowser scripts/aws-cli/ensure-keypair.sh
```

Create or reuse the security group and sync SSH ingress:

```bash
AWS_PROFILE=ztbrowser scripts/aws-cli/ensure-security-group.sh
AWS_PROFILE=ztbrowser scripts/aws-cli/sync-ssh-ip.sh --extra-ssh-cidr <optional-cidr>
```

Create or update the launch template:

```bash
AWS_PROFILE=ztbrowser scripts/aws-cli/ensure-launch-template.sh
```

Create or reuse the managed instance:

```bash
AWS_PROFILE=ztbrowser scripts/aws-cli/ensure-instance.sh
```

Deploy a release to a running host and keep it running:

```bash
AWS_PROFILE=ztbrowser scripts/aws-cli/deploy-release.sh --host <public-ip> --release-tag v0.1.3
```

Run the full ephemeral flow:

```bash
AWS_PROFILE=ztbrowser scripts/aws-cli/full-deploy.sh --release-tag v0.1.3
```

Default cleanup policy for `full-deploy.sh`:

- terminate the instance after verification

If you want to preserve the instance for later reuse, use:

```bash
AWS_PROFILE=ztbrowser scripts/aws-cli/full-deploy.sh --release-tag v0.1.3 --pause
```

That stops the instance instead of terminating it.

## Operator TUI

The same automation surface is available through a stage-aware terminal UI:

```bash
npm run dev:deploy-tui
```

or:

```bash
./scripts/run-ztdeploy.sh
```

This TUI sits on top of `scripts/aws-cli/` and exposes:

- deployment repo selection
- deployment method selection
- deployment action selection:
  - `verify`: deploy, verify, then obey cleanup policy
  - `deploy`: deploy, verify, and keep the instance running
- release tag and AWS profile editing
- confirmation before any command is executed
- stage-by-stage progress
- a full live stdout/stderr console
- a deployments screen that shows managed instance IDs, states, and public IPs, and can stop or terminate them
- persisted logs in `~/.local/state/ztdeploy/runs/`

Default cleanup in the TUI matches the shell scripts:

- `terminate` by default
- `pause` if you explicitly switch cleanup mode in the settings dialog

### Reuse key for existing instances

Instance reuse is keyed on these tags:

- `Name=ztbrowser-nitro-parent`
- `ManagedBy=ztbrowser-aws-cli`

If an instance with those tags already exists in `pending`, `running`, `stopping`, or `stopped`, the scripts reuse it. Otherwise they launch a new one.
