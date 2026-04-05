# CI/CD

## Current delivery model

ZTBrowser should present delivery as three coordinated lanes, not one monolithic pipeline.

### Lane 1 — Merged repo CI and hosted demo hooks

Workflow: `.github/workflows/ci.yml`

This lane currently covers:
- checkout
- Node setup
- `npm ci`
- typecheck
- extension unit/integration tests
- facts-node tests
- smoke API checks
- Render deploy hooks on pushes to `main`

This lane validates the integration repo and supports hosted demo/facts surfaces.
It is the mainline CI story for the repo itself.

### Lane 2 — Canonical enclave release CI

Lives in `ztinfra-enclaveproducedhtml`.

Release workflow responsibilities:
- build EIF artifacts
- generate `describe-eif.json`
- generate `provenance.json`
- publish checksums
- publish `release-manifest.json`
- publish `coco-runtime-config.json`
- open a canonical facts PR into `ztbrowser`

Rebuild-verification workflow responsibilities:
- rebuild a repo/ref pair against a published provenance manifest
- publish comparison artifacts

This lane is the canonical measured-workload release path.

### Lane 3 — Operator-driven AWS deployment automation

Lives in the merged repo under:
- `scripts/aws-cli/`
- `src/ztdeploy/`

This lane currently covers:
- AWS prerequisite and IAM bootstrap assistance
- EC2 key pair, security group, launch template, and instance lifecycle automation
- deployment of tagged canonical enclave releases onto Nitro-capable EC2 parents
- experimental AWS CoCo deployment and verification lane
- verification-oriented runs and long-lived deployment runs
- managed deployment listing, stop, and terminate actions through the TUI

This is a real deployment capability on `origin/main`.
It should be described as human-triggered deployment automation or operator CD, not as push-triggered GitHub CD to AWS.

## CI/CD story for the course

For the course, present CI/CD as:
1. merged repo CI and demo/facts hosting hooks
2. canonical enclave release and provenance CI
3. operator-driven AWS deployment automation that consumes the canonical release artifacts

That framing is accurate and stronger than claiming there is only repo CI plus enclave CI.

## What is still missing

- stronger automated checks linking canonical release fields to facts rows in `ztbrowser`
- stronger automated tests around `ztdeploy` stage behavior and AWS script semantics
- a live AWS CoCo substrate proof in this repo-only pass
- a single cross-repo operational dashboard or metrics layer
