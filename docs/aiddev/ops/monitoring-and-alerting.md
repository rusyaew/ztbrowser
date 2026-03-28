# Monitoring and Alerting

## Current real signals

Today the project has real but lightweight operational signals across all three delivery lanes:
- CI failures on the merged repo lane
- smoke API failures on the demo lane
- canonical enclave release and rebuild-verification workflow outcomes
- operator deployment verification output from the AWS automation lane
- logs from services and operator flows
- manual checks against deployed endpoints where automation is not yet wired into CI

## Why there is no claimed production dashboard today

A stable always-on production environment is not the repo’s strongest truth today.
Creating a fake dashboard for the course would be harmful and misleading.

## Recommended observability posture

### Immediate low-risk path
- keep CI and smoke checks as baseline quality signals
- treat canonical release workflow status as a first-class operational signal
- document structured logging expectations for the Rust parent proxy and AWS deployment flows
- persist and inspect `ztdeploy` run logs as operator evidence

### Next implementation path
- use OpenTelemetry JavaScript for Node services first
- add minimal metrics around:
  - facts lookup requests
  - facts lookup matches/misses
  - verifier success/failure by reason
  - deploy-run success/failure by stage
  - deploy-to-verification time
- avoid introducing heavy infra into the canonical enclave path just for coursework

### Alert concepts
- facts service unavailable
- canonical facts drift from release provenance process
- deploy verification fails repeatedly
- AWS deployment stages fail repeatedly for the same operator path
- attestation verification failure rate spikes in pilot environments

## Course deliverable position

For the course, the honest deliverable is:
- a monitoring strategy grounded in current repo reality
- a minimal implementation path that can be executed safely later
- no fabricated dashboard screenshots
