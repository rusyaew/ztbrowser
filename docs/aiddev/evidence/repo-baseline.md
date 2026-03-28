# Repo Baseline

## Authoritative baseline

Execution and artifact claims in this package should be grounded in:

1. `origin/main` for merged implementation truth
2. `rusyaew/ztinfra-enclaveproducedhtml` for canonical enclave release provenance
3. the AIDev bundle for course structure and expectations

## Root worktree warning

The root local worktree at `/home/gleb/zt-tech/ztbrowser` is dirty and behind `origin/main`.
It contains useful draft material, but it is not authoritative for repo truth.

## What `origin/main` already contains

- Chrome extension verifier flow
- facts node and canonical facts row support
- standalone checker
- demo service and Micrus demo
- canonical enclave split to `ztinfra-enclaveproducedhtml`
- AWS Nitro parent-proxy path
- AWS CLI lifecycle scripts for EC2/Nitro deployment
- `ztdeploy` operator TUI
- managed deployment listing and lifecycle actions
- tests for extension unit/integration behavior
- CI and Render deploy hooks

## What the external canonical enclave repo owns

- measured enclave source code
- release workflow
- rebuild-verification workflow
- canonical release artifacts:
  - `ztbrowser-enclave.eif`
  - `describe-eif.json`
  - `provenance.json`
  - `SHA256SUMS`
- facts PR generation for canonical rows

## Delivery model in current repo truth

ZTBrowser should now be described through three delivery lanes:

1. merged repo CI and hosted demo/facts deployment hooks
2. canonical enclave release CI in `ztinfra-enclaveproducedhtml`
3. operator-driven AWS deployment automation from `origin/main` via `scripts/aws-cli/` and `ztdeploy`

The third lane is real current capability, but it is human-triggered deployment automation rather than push-triggered GitHub CD to AWS.

## Current product truth

ZTBrowser is best described as a browser-visible trust and provenance platform for enclave-backed web services.
It is not only an extension, not only a facts service, and not only an AWS deployment script collection.
