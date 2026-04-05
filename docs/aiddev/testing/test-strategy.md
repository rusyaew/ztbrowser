# Test Strategy

## 1. Document Information

- Product: ZTBrowser
- Artifact type: course-aligned test strategy
- Baseline: merged repo truth plus external canonical enclave release repo

## 2. Purpose

This strategy translates the current ZTBrowser requirements into a risk-based testing model.
The goal is safer change, not test count inflation.

## 3. Scope

### In Scope
- extension verifier logic
- extension integration behavior
- smoke API path for demo and realization lookup coverage
- release/provenance behavior as a documented process
- deployment automation behavior as a current merged capability, including the AWS CoCo lane as experimental operator functionality
- facts-node lookup and compatibility behavior

### Out of Scope
- full browser automation for every demo
- full AWS integration test suite on every CI run
- non-AWS multi-cloud portability
- live AWS CoCo substrate provisioning inside the course package

## 4. System Overview

ZTBrowser combines:
- a browser extension that verifies attestation and shows trust state
- a facts service that maps verified realizations to metadata
- a canonical enclave release pipeline in `ztinfra-enclaveproducedhtml`
- merged AWS CLI + `ztdeploy` operator tooling for AWS Nitro deployment and AWS CoCo experimental operator flows
- demo paths including Micrus and local example services

## 5. Requirements Overview

### Functional Requirements
- browser-visible verification
- facts/provenance lookup
- canonical release provenance
- operator deployment workflow
- demo and self-signed trust-root path
- multi-backend service realizations and AWS CoCo integration

### Non-Functional Requirements
- security of verification boundary
- clarity of failure states
- auditability/reproducibility of canonical release evidence
- cost-aware deployment automation
- clear noncanonical labeling for demos
- explicit experimental labeling for AWS CoCo operator support

## 6. Test Objectives

- prove core cryptographic verification behavior remains correct
- ensure facts metadata never overrides cryptographic truth
- ensure release-centered realization lookup remains correct for Nitro and CoCo
- ensure canonical release provenance remains auditable
- keep operator deployment workflow understandable and repeatable
- keep demo paths clearly separated from canonical trust claims
- keep AWS CoCo experimental behavior from regressing Nitro behavior

## 7. Test Levels and Test Types

### Unit Testing
- attestation parsing, signature/path validation, nonce checks, PCR extraction
- common-envelope parsing and realization normalization
- facts-db normalization helpers

### Integration Testing
- extension background/content/popup interactions
- facts lookup behavior
- state transitions between cryptographic result and metadata result
- facts-node compatibility and release-centered lookup

### End-to-End / Smoke Testing
- local demo service + facts integration via `scripts/smoke-api.ts`
- realization lookup and Nitro compatibility checks in `scripts/smoke-api.ts`

### Manual / Process-Backed Testing
- AWS deploy verification path
- canonical release provenance and rebuild verification path
- Micrus trust-root differentiation
- AWS CoCo deploy/verify path when a real substrate is available

### Non-Functional Testing
- security boundary reasoning around verifier location
- operability/cost behavior for deploy cleanup defaults
- clarity of error/debug output
- explicit experimental labeling for AWS CoCo operator support

## 8. Requirement-to-Test-Level Mapping

- F001 -> unit + integration
- F002 -> integration
- F003 -> workflow/process-backed verification
- F004 -> manual integration today, future targeted automation
- F005 -> manual/demo today, future focused automation
- F006 -> unit + integration + manual/process-backed operator proof depending on the sub-requirement

## 9. Test Priorities

1. Cryptographic verification correctness
2. Lock/unlock decision integrity
3. Facts lookup semantics
4. Canonical release provenance discipline
5. Operator deployment workflow
6. Demo-path clarity
7. AWS CoCo experimental safety and Nitro backward compatibility

## 10. Test Environment

- Node.js/Vitest environment for extension and facts-node tests
- local demo facts + example services for smoke tests
- GitHub Actions for merged repo CI and canonical enclave release CI
- AWS account/profile for manual operator deployment verification

## 11. Test Data Strategy

- use valid and tampered attestation payloads for verifier tests
- use matching and mismatching PCR tuples for legacy compatibility lookup tests
- use normalized realization identities for CoCo lookup tests
- use release tags and provenance manifests as stable identifiers for provenance verification
- use demo trust roots explicitly labeled as noncanonical

## 12. Automation Strategy

- keep unit and integration tests in mainline CI
- keep smoke checks lightweight and repeatable
- avoid brittle full-cloud automation in default CI
- prefer targeted script/TUI tests and structural validations for deployment tooling before considering paid-cloud CI
- keep AWS CoCo runtime/operator proof manual or process-backed unless the repo later gains a real substrate suite

## 13. Entry and Exit Criteria

### Entry
- requirement IDs locked
- test owners identified by feature
- source-of-truth docs aligned

### Exit
- all current automated tests mapped to requirement IDs
- major uncovered scenarios explicitly documented
- no test is claimed without a real file or real planned gap ticket

## 14. Quality Gates

- `npm ci` completes
- typecheck passes
- extension unit/integration tests pass
- smoke API passes
- course docs do not claim unsupported automation
- CoCo operator lane is not described as production-proven unless a real substrate run exists

## 15. Risks and Limitations

- no full AWS end-to-end CI today
- no automated Micrus suite today
- no automated `ztdeploy` UI tests today
- hosted facts service behavior under sleep/staleness is still partly manual
- AWS CoCo operator behavior remains experimental without live substrate evidence in this repo-only pass

## 16. Deliverables

- requirements list with IDs
- `prd.json` and `SPEC.csv`
- test strategy
- test case catalog
- traceability matrix
- documented test gaps and next additions

## Current Automated Evidence

### Unit tests
- `tests/unit/extension/attestationVerifier.test.mjs`
  - valid attestation acceptance
  - nonce mismatch handling
  - unsupported platform handling
  - invalid payload handling
  - invalid signature handling
- `tests/integration/facts-node/factsDb.test.mjs`
  - legacy row normalization
  - release realization matching
  - legacy projection preservation

### Integration tests
- `tests/integration/extension/background.test.mjs`
  - background fetch bridge
  - verify-attestation message handling
  - icon updates
- `tests/integration/extension/content.test.mjs`
  - locked state after full happy path
  - facts miss behavior
  - invalid payload behavior
  - missing PCR behavior
  - runtime messaging failure handling
- `tests/integration/extension/popup.test.mjs`
  - popup rendering for locked and unlocked states
- `tests/integration/facts-node/server.test.mjs`
  - lookup-by-pcr compatibility
  - lookup-by-realization response shape

### Smoke checks
- `scripts/smoke-api.ts`
  - demo service + checker + facts integration flow
  - realization lookup for the canonical CoCo release row
  - Nitro compatibility lookup
