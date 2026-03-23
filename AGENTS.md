# AGENTS

## Architecture authority

- `ztbrowser` is the integration repo.
- `https://github.com/rusyaew/ztinfra-enclaveproducedhtml` is the canonical measured enclave repo.
- Real AWS deploys must consume enclave release artifacts from that repo.
- Canonical facts rows must come from enclave release CI, not from manual workspace builds.

## Current deploy model

- parent proxy: in this repo under `aws-deploy/parent-proxy`
- enclave EIF: fetched from enclave release artifacts into `aws-deploy/build/`
- checker: local or browser-side verifier
- facts node: metadata lookup only

## Important rules

- Do not reintroduce monorepo-owned canonical enclave builds in `ztbrowser`.
- If you need to change the measured enclave workload, change `ztinfra-enclaveproducedhtml` and cut a new tagged release.
- If you need new canonical facts, they must be generated from enclave repo CI provenance and merged into `facts-node/facts-db.json`.
- Historical demo and pre-split rows may exist in the facts DB, but they are noncanonical.

## AWS CLI automation

- Local EC2 orchestration lives under `scripts/aws-cli/`.
- The operator-facing terminal UI lives under `src/ztdeploy/`.
- Shared deployment definitions live in `deploy/catalog.yml`.
- Personal deployment definitions live in `~/.config/ztdeploy/config.yml`.
- The current defaults are intentional and presentation-tested:
  - `us-east-1`
  - `m5.xlarge`
  - AL2023 x86_64 resolved via SSM
  - Nitro Enclaves enabled in the launch template
  - SSH limited to the current public IP by default
  - `9999/tcp` public for the parent proxy
- `full-deploy.sh` is the ephemeral safety-first entrypoint:
  - it deploys, verifies, and then cleans up compute
  - cleanup defaults to termination
  - `--pause` downgrades cleanup to stop
- `deploy-release.sh` is the persistent-host entrypoint:
  - it assumes the instance already exists and leaves it running
- `ztdeploy` must continue to expose the same deployment backend as visible explicit stages:
  - do not regress it into a single opaque `full-deploy.sh` subprocess
  - do not hide raw stdout/stderr when runs fail
- The deploy IAM policy is intentionally separate from IAM bootstrap:
  - deploy profile needs EC2 + SSM read permissions only
  - `bootstrap-iam.sh` must be run with an already-admin-capable profile
