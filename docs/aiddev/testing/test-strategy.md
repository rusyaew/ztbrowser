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
- smoke API path for demo services
- release/provenance behavior as documented process
- deployment automation behavior as a current merged capability, with mostly manual/process-heavy evidence today

### Out of Scope
- full browser automation for every demo
- full AWS integration test suite on every CI run
- multi-cloud / CoCo paths

## 4. System Overview

ZTBrowser combines:
- a browser extension that verifies attestation and shows trust state
- a facts service that maps verified PCRs to metadata
- a canonical enclave release pipeline in `ztinfra-enclaveproducedhtml`
- merged AWS CLI + `ztdeploy` operator tooling for AWS Nitro deployment
- demo paths including Micrus and local example services

## 5. Requirements Overview

### Functional Requirements
- browser-visible verification
- facts/provenance lookup
- canonical release provenance
- operator deployment workflow
- demo and self-signed trust-root path

### Non-Functional Requirements
- security of verification boundary
- clarity of failure states
- auditability/reproducibility of canonical release evidence
- cost-aware deployment automation
- clear noncanonical labeling for demos

## 6. Test Objectives

- prove core cryptographic verification behavior remains correct
- ensure facts metadata never overrides cryptographic truth
- ensure canonical release provenance remains auditable
- keep operator deployment workflow understandable and repeatable
- keep demo paths clearly separated from canonical trust claims

## 7. Test Levels and Test Types

### Unit Testing
- attestation parsing, signature/path validation, nonce checks, PCR extraction

### Integration Testing
- extension background/content/popup interactions
- facts lookup behavior
- state transitions between cryptographic result and metadata result

### End-to-End / Smoke Testing
- local demo service + facts integration via `scripts/smoke-api.ts`

### Manual / Process-Backed Testing
- AWS deploy verification path
- canonical release provenance and rebuild verification path
- Micrus trust-root differentiation

### Non-Functional Testing
- security boundary reasoning around verifier location
- operability/cost behavior for deploy cleanup defaults
- clarity of error/debug output

## 8. Requirement-to-Test-Level Mapping

- F001 -> unit + integration
- F002 -> integration
- F003 -> workflow/process-backed verification
- F004 -> manual integration today, future targeted automation
- F005 -> manual/demo today, future focused automation

## 9. Test Priorities

1. Cryptographic verification correctness
2. Lock/unlock decision integrity
3. Facts lookup semantics
4. Canonical release provenance discipline
5. Operator deployment workflow
6. Demo-path clarity

## 10. Test Environment

- Node.js/Vitest environment for extension tests
- local demo facts + example services for smoke tests
- GitHub Actions for merged repo CI and canonical enclave release CI
- AWS account/profile for manual operator deployment verification

## 11. Test Data Strategy

- use valid and tampered attestation payloads for verifier tests
- use matching and mismatching PCR tuples for facts lookup tests
- use release tags and provenance manifests as stable identifiers for provenance verification
- use demo trust roots explicitly labeled as noncanonical

## 12. Automation Strategy

- keep unit and integration tests in mainline CI
- keep smoke checks lightweight and repeatable
- avoid brittle full-cloud automation in default CI
- prefer targeted script/TUI tests and structural validations for deployment tooling before considering paid-cloud CI

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

## 15. Risks and Limitations

- no full AWS end-to-end CI today
- no automated Micrus suite today
- no automated `ztdeploy` UI tests today
- hosted facts service behavior under sleep/staleness is still partly manual

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

### Smoke checks
- `scripts/smoke-api.ts`
  - demo service + checker + facts integration flow
