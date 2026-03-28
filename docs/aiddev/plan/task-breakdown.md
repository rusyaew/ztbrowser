# Task Breakdown

## T-1 Browser verification packaging

- align F001 across `prd.json`, SPEC, requirements, and test docs
- ensure lock/unlock, failure reason, and root-handling semantics are stated once and referenced elsewhere
- keep extension-side verification as part of the open trust substrate

## T-2 Failure-path and edge-case coverage

- enumerate invalid signature, malformed payload, unsupported platform, nonce mismatch, and missing endpoint cases
- ensure traceability matrix and test catalog reflect current evidence honestly
- identify any still-manual failure-path checks as gaps, not implemented tests

## T-3 Provenance and release packaging

- align facts lookup semantics with canonical release provenance
- keep `ztinfra-enclaveproducedhtml` as the release authority
- ensure rebuild verification remains visible as an auditable supply-chain path

## T-4 AWS deploy/operator packaging

- document merged AWS CLI automation and `ztdeploy` as current capability
- preserve distinction between repo CI, enclave release CI, and operator-driven deploy automation
- make verify vs deploy and cleanup semantics explicit

## T-5 Monitoring dashboard definition

- define dashboard panels grounded in current data sources and current signals
- avoid fake screenshots or claiming always-on production telemetry that does not exist
- connect dashboard panels to PMF metrics, release freshness, and deploy success

## T-6 Business and governance boundary

- keep verifier, provenance format, and local policy evaluation open
- define the organization policy control plane as a future centralized management layer
- keep monetization hypotheses tied to actual repo strengths
