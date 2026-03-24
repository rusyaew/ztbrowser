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
MODE=good npm run dev:example
```

### OR
Just run the following configurations:

- `Dev facts`
- `Dev example`

And then load/reload the unpacked extension from `ztbrowser-chrome-extension/` in Chrome and open the demo page.

## IDE run configurations

JetBrains IDE run configurations are checked into [.run/](/Users/daniil.stankevych/Code/ztbrowser/.run).

### Demo
- `Dev facts`: starts the facts metadata service used by the extension demo.
- `Dev example`: starts the demo attestation service used by the extension demo.
### Checks
- `Typecheck`: runs `tsc --noEmit`.
- `Unit + integration tests`: runs the shared Vitest suite for extension unit and integration tests.
- `Unit + integration tests coverage`: runs the same Vitest suite with coverage reporting.
- `Smoke API`: runs the local end-to-end API smoke flow.
### Deploy
- `Dev deploy tui`: starts the deployment TUI.
- `ZTDeploy init`: initializes local ztdeploy config.
- `ZTDeploy validate`: validates ztdeploy config and catalog wiring.
### Deprecated
- `Dev checker`: starts the standalone checker API used for direct verification and smoke compatibility checks.
  - Currtenly verifier is a part of the extension.

For the current extension demo, the only configurations you usually need are in `Demo`:

- `Dev facts`
- `Dev example`

If you need the old standalone `/verify` flow for compatibility testing, run `Dev checker` from `Legacy`.

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

## ztdeploy TUI

`dev/nika` also ships an operator-facing deployment UI built with TypeScript, React, and Ink.

Start it from the repo root:

```bash
npm run dev:deploy-tui
```

or:

```bash
./scripts/run-ztdeploy.sh
```

What it does:

- shows deployment repos from `deploy/catalog.yml`
- lets operators add personal repos in `~/.config/ztdeploy/config.yml`
- exposes deployment method selection, deployment action, release tag, AWS profile, SSH CIDR overrides, and cleanup mode
- runs the existing `scripts/aws-cli/` automation as explicit stages instead of one opaque subprocess
- persists run logs under `~/.local/state/ztdeploy/runs/`
- includes a deployments view that lists managed EC2 instances with their public IPs and lets operators stop or terminate them

Useful keys:

- `↑/↓`: change selected repo
- `m`: choose method
- `e`: edit run settings
- `o`: toggle run action between `verify` and `deploy`
- `d`: open the managed deployments list
- `a`: add a personal deployment repo
- `u`: publish the selected local repo into the shared repo catalog
- `r`: open run confirmation and execute
- `q`: quit when no run is active

Non-interactive helpers:

```bash
node bin/ztdeploy.mjs validate
node bin/ztdeploy.mjs catalog list
node bin/ztdeploy.mjs init
```
