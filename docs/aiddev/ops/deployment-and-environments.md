# Deployment and Environments

## Environment model

### 1. Local demo environment
- `demo-service-repo/exampleserver.ts`
- local facts node
- optional standalone checker
- useful for smoke tests and protocol demos

### 2. Demo application environment
- `micrus/`
- self-signed demo root
- useful for attestation-gated product interaction demos

### 3. Canonical AWS Nitro environment
- parent proxy on EC2 parent instance
- measured enclave workload from `ztinfra-enclaveproducedhtml`
- release artifacts fetched into `ztbrowser`
- browser verification path against real AWS-root-backed documents

## Canonical deploy path

1. canonical enclave repo publishes a tagged release
2. release artifacts include EIF, measurements, provenance, checksums
3. `ztbrowser` fetches the tagged release
4. EC2 parent runs the EIF and parent proxy
5. browser verifies attestation and optionally resolves facts metadata

## Operator deployment automation in the merged repo

Deployment can be orchestrated from `origin/main` via:
- AWS CLI scripts under `scripts/aws-cli/`
- `ztdeploy` TUI

This operator lane:
- provisions or reuses the AWS resources needed for Nitro deployment
- deploys canonical enclave releases by tag
- supports `verify` runs that clean up after validation
- supports `deploy` runs that keep an instance live for continued use
- exposes managed deployment listing and lifecycle controls

This is part of current project reality. It is not just historical branch evidence.

## Deployment semantics

The project now has two different but connected deployment semantics:

1. **Canonical release production semantics**
   - release identity comes from `ztinfra-enclaveproducedhtml`
   - provenance is artifact-first
   - facts publication follows the release manifest

2. **Operator deployment semantics**
   - the merged repo automates AWS bring-up and release consumption
   - operators choose between short-lived verification runs and kept-live deployments
   - deployment success is confirmed through live HTTP and attestation checks
