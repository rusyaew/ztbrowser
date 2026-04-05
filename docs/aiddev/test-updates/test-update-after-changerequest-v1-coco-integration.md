# TEST UPDATE PACKAGE

## 1. Test Update Summary

- **Change Title**: Test update after `changerequest-v1-coco-integration`
- **Related CR / SPEC Patch Summary**: Add AWS-only experimental CoCo integration for the canonical HTML service through a common attestation envelope, platform dispatch, release-centered facts with `accepted_realizations`, a normalized realization lookup path, and a second operator lane `aws_coco_snp`, while preserving Nitro as the working baseline.
- **Impacted Requirement IDs**:
  - patched FRs: `FR-004`, `FR-005`, `FR-007`, `FR-010`, `FR-011`, `FR-012`
  - new FRs: `FR-016`, `FR-017`, `FR-018`, `FR-019`, `FR-020`, `FR-021`, `FR-022`, `FR-023`, `FR-024`, `FR-025`
  - patched NFRs: `NFR-003`, `NFR-005`
  - new NFRs: `NFR-008`, `NFR-009`, `NFR-010`, `NFR-011`, `NFR-012`, `NFR-013`
- **Impacted Use Case IDs**: patched `SC001`, `SC003`, `SC005`, `SC007`, `SC008`; new `SC011`, `SC012`, `SC013`, `SC014`, `SC015`, `SC016`
- **Testing Change Type**: Add + Modify
- **Primary impacted test levels**: unit, integration, manual/process-backed E2E, monitoring-oriented workflow checks

### Canonical ID authority for this update

- User story / use case IDs: `docs/aiddev/spec/user-stories-and-bdd.md`, `docs/aiddev/spec/prd.json`
- FR / NFR IDs: `docs/aiddev/spec/requirements.md`
- Work/task IDs: `docs/aiddev/plan/work-plan.md`, `docs/aiddev/plan/task-breakdown.md`
- Submission mirrors only: `docs/artifacts/SPEC.csv`, `docs/artifacts/SPEC.xlsx`
- All downstream testing rows in this artifact use hyphenated IDs as the only authoritative identifiers.

---

## 2. Current Test Reality (As-Is)

### Current coverage by test level
- **Unit**: Nitro verifier semantics only in `tests/unit/extension/attestationVerifier.test.mjs`
- **Integration**: extension content/background/popup flows in:
  - `tests/integration/extension/content.test.mjs`
  - `tests/integration/extension/background.test.mjs`
  - `tests/integration/extension/popup.test.mjs`
- **End-to-End / Smoke**: `scripts/smoke-api.ts` exercises demo service + checker + facts compatibility flow, but this is not part of `vitest run`
- **Manual / Process-backed**: canonical release workflow, Nitro AWS deploy/verify, deployment lifecycle management, Micrus demo path
- **Monitoring-related checks**: GitHub Actions CI in `.github/workflows/ci.yml`, Render hooks, manual deploy verification evidence, but no runtime monitoring suite

### Current executable testing artifacts
- test runner wiring:
  - `package.json`
  - `vitest.config.mjs`
- current strategy docs to be patched downstream:
  - `docs/aiddev/testing/test-strategy.md`
  - `docs/aiddev/testing/traceability-matrix.md`
  - `docs/aiddev/testing/test-case-catalog.md`
  - `docs/aiddev/testing/test-gaps.md`

### Current strong areas
- Nitro cryptographic verification semantics
- Nitro browser lock/unlock behavior
- facts-miss preserving cryptographic success
- background bridge behavior and invalid-doc fallback
- popup rendering of current stored verification state

### Current weak areas
- facts-node contract behavior is documented but not directly tested
- runtime attestation endpoint contract is not directly tested
- operator workflow and deployment listing are documented/manual only
- there is no current automation for CoCo-related behavior

### Current gaps
- no common-envelope or CoCo verification coverage
- no release-centered facts coverage
- no runtime/common-envelope contract coverage
- no automated operator coverage for Nitro or CoCo
- no automated coverage yet for the merged deploy hardening now present in `origin/main`

### Current regression baseline candidates
- `T001` / `tests/unit/extension/attestationVerifier.test.mjs`: highest-value Nitro crypto baseline
- `T003` and `T004` / `tests/integration/extension/content.test.mjs`: highest-value lock/facts baseline
- background invalid-doc and fetch bridge cases in `tests/integration/extension/background.test.mjs`
- popup locked/unlocked rendering in `tests/integration/extension/popup.test.mjs`

### Mismatches between Test Strategy and actual test implementation
- current strategy is feature-level; prompt and CR require requirement-level patches
- current traceability matrix mixes automation types without explicit automation status
- current test case catalog lacks requirement IDs and automation IDs
- current strategy marks all CoCo paths out of scope; the approved CR moves AWS-only CoCo into scope while keeping general multi-cloud out of scope

---

## 3. Test Obligations from the Updated SPEC

The updated test layer must now guarantee:

- **New behaviors to validate**
  - common envelope parsing and `platform` dispatch
  - CoCo verifier success normalization to `image_digest + initdata_hash`
  - rejection of generic CoCo evidence
  - release-centered facts lookup via `POST /api/v1/lookup-by-realization`
  - canonical release outputs for Nitro + CoCo realizations
  - AWS-only experimental `aws_coco_snp` deploy/verify path
  - platform-visible runtime and deployment metadata

- **Changed behaviors to revalidate**
  - `SC001`: browser verification now dispatches by `platform`
  - `SC003`: facts transition from PCR-only lookup to release-centered lookup while keeping Nitro compatibility
  - `SC005`: canonical release outputs broaden from Nitro-only to Nitro+CoCo realization data
  - `SC007`: operator flow now includes platform selection
  - `SC008`: deployments view must distinguish realization platform

- **Unchanged behaviors that require regression protection**
  - Nitro nonce handling
  - Nitro reason codes and invalid/tampered document handling
  - existing `POST /.well-known/attestation` browser entrypoint
  - facts remain additive only; a facts miss does not negate cryptographic success
  - existing Nitro deploy/verify success rule: landing page + attestation endpoint
  - current cost-aware cleanup discipline

- **Critical acceptance points that must be preserved**
  - current extension contract must not silently regress while CoCo is added
  - new operator/test docs must not claim automated AWS CoCo CI that does not exist
  - merged deploy hardening in `origin/main` must remain part of the shared operator regression baseline

---

## 4. What Changes in Testing

### Exact testing artifacts impacted
- strategy patch target: `docs/aiddev/testing/test-strategy.md`
- traceability patch target: `docs/aiddev/testing/traceability-matrix.md`
- test case patch target: `docs/aiddev/testing/test-case-catalog.md`
- gap patch target: `docs/aiddev/testing/test-gaps.md`
- current executable regression baseline files that the later implementation stage must preserve:
  - `tests/unit/extension/attestationVerifier.test.mjs`
  - `tests/integration/extension/content.test.mjs`
  - `tests/integration/extension/background.test.mjs`
  - `tests/integration/extension/popup.test.mjs`

- **Changed Test Strategy sections**
  - `3. Scope`
  - `5. Requirements Overview`
  - `6. Test Objectives`
  - `7. Test Levels and Test Types`
  - `8. Requirement-to-Test-Level Mapping`
  - `9. Test Priorities`
  - `10. Test Environment`
  - `11. Test Data Strategy`
  - `12. Automation Strategy`
  - `13. Entry and Exit Criteria`
  - `14. Quality Gates`
  - `15. Risks and Limitations`
  - `16. Deliverables`

- **Changed requirement mappings**
  - introduce requirement-level mapping for patched and new FR/NFR IDs listed in section `1`
  - preserve current unchanged mappings for unaffected scenarios

- **Changed test cases**
  - modify existing Nitro baseline cases where the public contract broadens but Nitro semantics stay unchanged
  - add new CoCo/common-envelope/release-centered-facts/operator cases `T011` through `T027`

- **Changed traceability rows**
  - split current feature-level rows into requirement-level rows for the impacted change surface
  - mark each row as `New`, `Updated`, or `Unchanged baseline`

- **Changed automation scope**
  - add new automated targets for verifier/content/facts logic
  - keep AWS CoCo operator lane manual/process-backed in v1
  - keep operator-hardening cases `T025..T027` explicit as merged-baseline planned/manual coverage until real automation is added

- **Changed quality gates**
  - add explicit gate that no unsupported CoCo/AWS automation is claimed
  - add explicit gate that Nitro regression baselines must remain green before any CoCo merge

- **Additional impacted testing artifact**
  - `docs/aiddev/testing/test-gaps.md` must be patched so the current gaps reflect the approved CoCo CR rather than the old "CoCo out of scope" baseline

---

## 5. What Stays the Same in Testing

- existing Nitro extension unit and integration tests remain the regression baseline, even where some case definitions are broadened to prove unchanged Nitro behavior under the expanded public contract
- unchanged requirement-to-test mappings for `SC002`, `SC004`, `SC006`, `SC009`, and `SC010` remain intact except for clearer automation labeling
- existing Node/Vitest test environment remains the merged automated baseline
- existing smoke API position remains unchanged: useful compatibility coverage, but not equivalent to merged Vitest coverage
- unchanged automation areas:
  - no full AWS end-to-end CI
  - no automated Micrus suite
  - no automated `ztdeploy` UI suite
- unchanged release gates:
  - typecheck passes
  - extension unit/integration tests pass
  - smoke API passes
  - course docs do not claim unsupported automation

---

## 6. Regression-Sensitive Zones

- **Nitro verifier semantics**
  - parser, nonce handling, invalid signature handling, and reason-code shape must remain unchanged
- **Content-script lock behavior**
  - adding common-envelope dispatch must not change current Nitro lock/facts semantics
- **Background bridge contract**
  - expanded verifier payloads must not break current message contract or icon-state behavior
- **Facts semantics**
  - release-centered lookup must not make facts authoritative or break Nitro additive-only behavior
- **Runtime endpoint contract**
  - migration to common envelope must not regress current Nitro public endpoint
- **Operator workflow**
  - CoCo lane must not regress current Nitro deploy/verify/cleanup/listing semantics
- **Branch-adjacent shared surfaces**
  - capacity fallback and instance-type propagation are now merged into `origin/main` and remain regression-sensitive shared operator surfaces
- **False-green risk**
  - documentation-only operator cases must not be mislabeled as merged automated coverage

---

## 7. Test Strategy Patch

### 7.1 Scope Patch

#### 3.1 In Scope
- **Current**: extension verifier logic; extension integration behavior; smoke API path for demo services; release/provenance behavior as documented process; deployment automation behavior as a current merged capability, with mostly manual/process-heavy evidence today
- **Updated**: extension verifier logic; extension integration behavior; release-centered facts behavior; AWS-only experimental CoCo behavior introduced by the approved CR; release/provenance behavior for Nitro + CoCo realization outputs as documented process; deployment automation behavior as a merged Nitro capability plus a planned/manual AWS CoCo operator lane
- **Reason**: AWS-only CoCo is now in scope, but only for the approved change surface

#### 3.2 Out of Scope
- **Current**: full browser automation for every demo; full AWS integration test suite on every CI run; multi-cloud / CoCo paths
- **Updated**: full browser automation for every demo; full AWS integration test suite on every CI run; general multi-cloud support; non-AWS CoCo paths; autonomous CoCo cloud CI; FHE-related future paths
- **Reason**: the approved CR adds AWS-only CoCo, not general multi-cloud or full-cloud CI

### 7.2 Requirements Overview Patch

#### Functional Requirements
- **Requirement IDs**: `FR-004`, `FR-005`, `FR-007`, `FR-010`, `FR-011`, `FR-012`, `FR-016..025`
- **Summary**:
  - broaden browser verification from Nitro-only to common-envelope + platform dispatch
  - move facts from PCR-only lookup to release-centered realization matching
  - broaden canonical release outputs to Nitro + CoCo realization metadata
  - broaden operator workflow from `aws_canonical` only to `aws_coco_snp` plus platform metadata
- **Reason for testing impact**: each of these changes modifies either an existing user-visible contract or introduces a new operator/runtime surface

#### Non-Functional Requirements
- **Requirement IDs**: `NFR-003`, `NFR-005`, `NFR-008..013`
- **Summary**:
  - facts stay metadata only
  - deployment remains cost-aware
  - Nitro behavior stays backward compatible
  - CoCo evidence must be workload-specific
  - common envelope preserves crypto-first ordering
  - AWS CoCo remains explicitly experimental
  - common envelope and normalized verifier output remain versioned/extensible
  - CoCo lane must not silently regress Nitro operator behavior
- **Reason for testing impact**: the change is security- and regression-sensitive even where behavior appears additive

### 7.3 Test Objectives Patch
- **Current**: prove Nitro crypto correctness, facts metadata semantics, provenance auditability, operator workflow clarity, and demo separation
- **Updated**: preserve Nitro crypto correctness while adding platform dispatch, CoCo workload-specific identity verification, release-centered facts matching, and AWS-only experimental CoCo operator behavior without overstating automation
- **Reason**: the updated spec adds a second realization platform without changing the trust model order

### 7.4 Test Levels and Test Types Patch

#### Unit
- **Current**: attestation parsing, signature/path validation, nonce checks, PCR extraction
- **Updated**: keep Nitro parser/nonce/signature/path validation; add common-envelope dispatch helpers, CoCo verifier normalization, and generic-evidence rejection logic
- **Reason**: new verifier logic can be validated cheapest and safest at unit level first

#### Integration
- **Current**: extension background/content/popup interactions; facts lookup behavior; state transitions between crypto result and metadata result
- **Updated**: keep current extension integration suite; add common-envelope content/background integration, normalized realization lookup integration, and platform-visible UI state integration
- **Reason**: changed browser contract and facts model need cross-module validation

#### End-to-End
- **Current**: local demo service + facts integration via `scripts/smoke-api.ts`; manual Nitro operator validation
- **Updated**: keep current smoke path; add manual/process-backed AWS CoCo operator verification and release-output checks as explicit E2E obligations; keep them out of default CI
- **Reason**: approved CR adds operator/runtime behavior that is not safe to represent as merged automation yet

#### Non-Functional
- **Current**: security boundary reasoning, cost-aware deploy cleanup defaults, clarity of error/debug output
- **Updated**: add workload-specific CoCo identity rejection, experimental labeling checks, and no-regression checks for shared Nitro operator surfaces
- **Reason**: the CR's main risk is silent trust/operability regression, not performance

### 7.5 Requirement-to-Test-Level Mapping Patch

| Requirement ID | Requirement Summary | Unit | Integration | E2E | Performance | Security | Monitoring | Reason |
|---|---|---|---|---|---|---|---|---|
| `FR-016` | common envelope | Yes | Yes | No | No | Yes | No | parser and contract correctness |
| `FR-017` | platform dispatch | Yes | Yes | No | No | Yes | No | wrong dispatch breaks trust boundary |
| `FR-018` | normalized verifier result | Yes | Yes | No | No | Yes | No | browser/facts contract depends on one normalized shape |
| `FR-020` | CoCo identity = `image_digest + initdata_hash` | Yes | Yes | No | No | Yes | No | workload-specific identity is security-critical |
| `NFR-008` | Nitro backward compatibility | Yes | Yes | No | No | Yes | No | unchanged Nitro trust path must remain intact |
| `NFR-009` | reject generic CoCo evidence | Yes | Yes | No | No | Yes | No | direct evidence-factory risk |
| `NFR-010` | crypto first, facts second | Yes | Yes | No | No | Yes | No | trust-ordering guarantee |
| `NFR-012` | versioned/extensible envelope/result | Yes | Yes | No | No | Yes | No | contract hardening |
| `FR-004` | lookup by realization with Nitro compatibility | No | Yes | No | No | No | Yes | integration contract plus service observability |
| `FR-005` | release + matched realization response | No | Yes | No | No | No | Yes | facts return shape is service-level behavior |
| `FR-019` | release-centered `accepted_realizations` | No | Yes | No | No | No | Yes | schema/API behavior |
| `FR-025` | Nitro behavior remains backward compatible | No | Yes | No | No | No | Yes | service-level compatibility guarantee |
| `NFR-003` | facts remain metadata only | No | Yes | No | No | No | Yes | additive-only behavior |
| `FR-007` | release outputs broaden to Nitro + CoCo | No | Yes | No | No | No | Yes | release workflow/process-backed integration |
| `FR-021` | canonical release lowers to Nitro + CoCo outputs | No | Yes | No | No | No | Yes | release tooling/process-backed verification |
| `FR-010` | operator deploy/verify broadens to CoCo | No | Yes | Yes | No | No | Yes | workflow contract + manual runtime proof |
| `FR-011` | stage/log + platform kind | No | Yes | Yes | No | No | Yes | operator surface contract |
| `FR-012` | deployment list + lifecycle + platform metadata | No | Yes | Yes | No | No | Yes | operator surface contract |
| `FR-022` | AWS CoCo runtime exposes common envelope | No | Yes | Yes | No | No | Yes | runtime/public contract |
| `FR-023` | `aws_coco_snp` operator method | No | Yes | Yes | No | No | Yes | deploy lifecycle validation |
| `FR-024` | operator surface exposes platform metadata | No | Yes | Yes | No | No | Yes | listing/runtime visibility |
| `NFR-005` | cost-aware cleanup across Nitro/CoCo | No | Yes | Yes | No | No | Yes | operator safety |
| `NFR-011` | AWS CoCo remains experimental | No | Yes | Yes | No | No | Yes | UX/doc/runtime labeling |
| `NFR-013` | CoCo lane must not regress Nitro operator behavior | No | Yes | Yes | No | No | Yes | shared operator surface risk |

### 7.6 Test Priorities Patch
- **Priority**: High
  - **Updated rationale**: Nitro trust semantics, common-envelope/platform dispatch, CoCo generic-evidence rejection, and facts additivity are release-blocking
  - **Reason**: trust errors here produce silent false positives or false negatives
- **Priority**: Medium
  - **Updated rationale**: release-output structure, runtime envelope shape, operator metadata visibility, and manual AWS CoCo workflow checks
  - **Reason**: important for end-to-end coherence, but not all are immediately automatable
- **Priority**: Low
  - **Updated rationale**: operator-hardening cases `T025..T027` remain lower priority than core verifier/facts work, but they are now part of the merged operator baseline
  - **Reason**: they protect deploy UX quality rather than first-line trust semantics

### 7.7 Test Environment Patch
- **Current**: Node.js/Vitest, local demo services, GitHub Actions, AWS account/profile for manual verification
- **Updated**: keep the current environments; add an AWS CoCo experimental environment requirement for manual/process-backed operator validation; include merged capacity-fallback and instance-type behavior in operator-environment expectations
- **Reason**: CoCo operator validation needs a real AWS environment, but this does not become default CI

### 7.8 Test Data Strategy Patch
- **Current**: valid/tampered attestation payloads, matching/mismatching PCR tuples, release tags/provenance manifests, demo trust roots
- **Updated**:
  - valid inputs: valid Nitro envelope, valid CoCo envelope, matching normalized realization identity, valid release-centered facts record
  - invalid inputs: unknown `platform`, envelope version mismatch, malformed CoCo evidence, missing `initdata_hash`, mismatching `image_digest`, mismatching realization facts record
  - empty inputs: missing `platform`, missing `evidence`, empty `accepted_realizations`, missing runtime metadata in listings
  - boundary values: multiple accepted realizations for one release, Nitro compatibility path alongside new normalized path
  - large inputs: longer realization arrays and richer deployment listing metadata
  - malicious/security inputs: generic CoCo guest evidence, forged identity hints, facts hit with mismatched cryptographic identity
  - performance datasets: not required for v1
- **Reason**: the change broadens trust-shape inputs more than volume/performance inputs

### 7.9 Automation Strategy Patch
- **Current**: keep unit/integration tests in mainline CI; keep smoke checks lightweight; avoid brittle full-cloud automation; prefer targeted script/TUI tests later
- **Updated**:
  - automate now:
    - verifier dispatch and normalization logic
    - common-envelope browser integration
    - release-centered facts matching behavior
    - Nitro compatibility path for facts lookup
    - popup/platform rendering where data is present
  - keep manual/process-backed now:
    - AWS CoCo deploy/verify workflow
    - runtime/common-envelope validation on live AWS CoCo service
    - release-output verification for Nitro + CoCo lowering
    - mixed deployment listing in real AWS operator state
  - keep planned/manual until later automation exists:
    - merged capacity fallback and instance-type propagation cases `T025..T027`
- **Reason**: preserve confidence while staying truthful about what the repo automates today

### 7.10 Entry / Exit Criteria Patch
- **Current Entry**: requirement IDs locked; test owners identified; source-of-truth docs aligned
- **Updated Entry**: CR crosswalk accepted; impacted FR/NFR IDs normalized to hyphenated authority; changed use cases localized; automation status assigned per new/updated case
- **Reason**: the CoCo CR adds ID and automation ambiguity that must be resolved before test implementation

- **Current Exit**: all current automated tests mapped; major uncovered scenarios documented; no fake tests claimed
- **Updated Exit**: impacted FR/NFR rows are mapped to concrete new/updated/baseline tests; unchanged Nitro baselines are explicitly preserved; no CoCo/AWS automation is claimed unless the repo actually gains it
- **Reason**: downstream implementation needs exact test obligations, not just general gaps

### 7.11 Quality Gates Patch
- **Current**: `npm ci`, typecheck, extension tests, smoke API, no unsupported automation claims
- **Updated**:
  - existing gates remain
  - add gate: Nitro regression baselines `T001`, `T003`, `T004`, background invalid-doc coverage remain green before merging CoCo changes
  - add gate: no artifact or PR claims automated AWS CoCo CI unless it exists in repo code/workflows
  - add gate: merged operator-baseline cases `T025..T027` remain tracked and must not be silently dropped from shared deploy-surface validation
- **Reason**: the new risk is silent drift between docs, tests, and actual automation

### 7.12 Risks and Limitations Patch
- **Current**: no full AWS Nitro E2E CI, no automated Micrus suite, no automated `ztdeploy` UI tests, hosted facts sleep/staleness partly manual
- **Updated**:
  - still no full AWS Nitro or CoCo E2E CI
  - still no automated CoCo runtime wrapper suite
  - still no automated `ztdeploy` UI suite
  - release-output validation for Nitro + CoCo remains process-backed in v1
  - merged deploy hardening from `dev/nika` still lacks dedicated automated coverage even though it is now part of `origin/main`
- **Reason**: the update broadens runtime/operator obligations without changing current automation maturity

### 7.13 Deliverables Patch
- **Current**: requirements list, `prd.json`, `SPEC.csv`, test strategy, test case catalog, traceability matrix, documented gaps
- **Updated**: existing deliverables plus localized CoCo test-update package, updated traceability rows, updated test-case rows with automation status/ID, and updated test-gap notes for the approved CoCo CR
- **Reason**: downstream engineers need a test patch, not just a strategy note

### 7.14 Test Gaps Patch
- **Current**: CoCo is effectively absent from gap tracking
- **Updated**:
  - add gap: no automated CoCo verifier suite yet
  - add gap: no automated facts-node release-centered lookup suite yet
  - add gap: no automated runtime/common-envelope suite yet
  - add gap: no automated AWS CoCo operator suite yet
  - keep gap: no full AWS end-to-end CI today
  - add gap: merged capacity-fallback and instance-type-propagation behavior has no dedicated automated coverage yet
- **Reason**: test gaps must reflect the approved CR rather than the old scope

---

## 8. Test Case Patch

### 8.1 New Test Cases to Add

- **Test Case ID**: `T011`
  - **Requirement ID**: `FR-016`, `FR-017`
  - **Title**: Common envelope with valid `platform` dispatches to the correct verifier path
  - **Type**: Functional
  - **Level**: Unit / Integration
  - **Priority**: High
  - **Preconditions**: common envelope parser and dispatch entrypoint exist
  - **Test Data**: valid Nitro envelope; valid CoCo envelope; supported `platform` values
  - **Steps**: feed common envelopes through dispatch path; observe selected verifier path
  - **Expected Result**: supported `platform` values route correctly without altering the browser entrypoint contract
  - **Automation Status**: Planned
  - **Automation ID**: `AUT-COCO-UNIT-001`
  - **Notes**: core common-envelope contract

- **Test Case ID**: `T012`
  - **Requirement ID**: `FR-016`, `NFR-012`
  - **Title**: Unknown or malformed envelope platform/version fails cleanly
  - **Type**: Functional
  - **Level**: Unit / Integration
  - **Priority**: High
  - **Preconditions**: common envelope parser exists
  - **Test Data**: unknown `platform`; missing `platform`; wrong envelope version
  - **Steps**: submit malformed envelope variants
  - **Expected Result**: structured failure, no false lock, no verifier ambiguity
  - **Automation Status**: Planned
  - **Automation ID**: `AUT-COCO-UNIT-002`
  - **Notes**: protects future backends from contract ambiguity

- **Test Case ID**: `T013`
  - **Requirement ID**: `FR-018`, `FR-020`, `NFR-009`
  - **Title**: CoCo verifier normalizes valid workload-specific evidence to `image_digest + initdata_hash`
  - **Type**: Functional
  - **Level**: Unit / Integration
  - **Priority**: High
  - **Preconditions**: CoCo verifier path exists
  - **Test Data**: valid CoCo evidence with workload-specific differentiation
  - **Steps**: run CoCo verification path and inspect normalized output
  - **Expected Result**: normalized identity contains `image_digest` and `initdata_hash`; success result stays compatible with common verifier contract
  - **Automation Status**: Planned
  - **Automation ID**: `AUT-COCO-UNIT-003`
  - **Notes**: central CoCo trust identity case

- **Test Case ID**: `T014`
  - **Requirement ID**: `FR-020`, `NFR-009`
  - **Title**: Generic CoCo evidence is rejected as insufficient browser-facing identity
  - **Type**: Functional
  - **Level**: Unit / Integration / Security
  - **Priority**: High
  - **Preconditions**: CoCo verifier path exists
  - **Test Data**: generic guest evidence lacking workload-specific differentiation
  - **Steps**: run CoCo verification against generic evidence
  - **Expected Result**: structured failure; no normalized identity accepted
  - **Automation Status**: Planned
  - **Automation ID**: `AUT-COCO-SEC-001`
  - **Notes**: direct evidence-factory protection

- **Test Case ID**: `T015`
  - **Requirement ID**: `FR-004`, `FR-005`, `FR-019`
  - **Title**: `lookup-by-realization` returns release record plus matched realization
  - **Type**: Functional
  - **Level**: Integration
  - **Priority**: High
  - **Preconditions**: release-centered facts endpoint exists
  - **Test Data**: normalized Nitro identity; normalized CoCo identity; matching `accepted_realizations`
  - **Steps**: query `POST /api/v1/lookup-by-realization`
  - **Expected Result**: response returns `matched`, `release`, and `matched_realization`
  - **Automation Status**: Planned
  - **Automation ID**: `AUT-COCO-INT-001`
  - **Notes**: facts contract anchor

- **Test Case ID**: `T016`
  - **Requirement ID**: `FR-004`, `FR-025`, `NFR-003`, `NFR-010`
  - **Title**: Facts miss on normalized lookup preserves cryptographic success
  - **Type**: Functional
  - **Level**: Integration
  - **Priority**: High
  - **Preconditions**: normalized lookup flow exists
  - **Test Data**: valid cryptographic verdict; no matching realization in facts
  - **Steps**: run browser flow through verification then facts miss
  - **Expected Result**: successful cryptographic verdict remains; facts enrichment remains false/missing only
  - **Automation Status**: Planned
  - **Automation ID**: `AUT-COCO-INT-002`
  - **Notes**: preserves core trust ordering

- **Test Case ID**: `T017`
  - **Requirement ID**: `FR-004`, `FR-025`
  - **Title**: Nitro compatibility path via `lookup-by-pcr` remains valid
  - **Type**: Functional
  - **Level**: Integration
  - **Priority**: High
  - **Preconditions**: compatibility path remains present
  - **Test Data**: valid Nitro PCR tuple
  - **Steps**: run Nitro browser/facts path through compatibility endpoint
  - **Expected Result**: Nitro match continues to work without forcing migration to normalized lookup
  - **Automation Status**: Planned
  - **Automation ID**: `AUT-COCO-INT-003`
  - **Notes**: strongest compatibility guard for facts migration

- **Test Case ID**: `T018`
  - **Requirement ID**: `FR-022`, `FR-016`
  - **Title**: Runtime attestation endpoint exposes the common envelope contract
  - **Type**: Functional
  - **Level**: Integration / E2E
  - **Priority**: Medium
  - **Preconditions**: runtime wrapper exposes `POST /.well-known/attestation`
  - **Test Data**: live runtime attestation response
  - **Steps**: query the public endpoint and inspect shape
  - **Expected Result**: common envelope fields are present; browser does not consume raw CoCo evidence directly
  - **Automation Status**: Planned
  - **Automation ID**: `AUT-COCO-INT-004`
  - **Notes**: likely starts as targeted harness/manual check before automation

- **Test Case ID**: `T019`
  - **Requirement ID**: `FR-024`
  - **Title**: Popup or operator-facing stored state renders platform metadata when present
  - **Type**: Functional
  - **Level**: Integration
  - **Priority**: Medium
  - **Preconditions**: UI state includes platform metadata
  - **Test Data**: locked state with `platform: aws_coco_snp`; locked state with Nitro platform metadata
  - **Steps**: render current UI with platform-tagged stored state
  - **Expected Result**: platform distinction is visible without regressing current locked/unlocked UX
  - **Automation Status**: Planned
  - **Automation ID**: `AUT-COCO-INT-005`
  - **Notes**: exact UI surface depends on implementation scope

- **Test Case ID**: `T020`
  - **Requirement ID**: `FR-007`, `FR-021`
  - **Title**: Canonical release publishes Nitro and CoCo realization outputs
  - **Type**: Functional
  - **Level**: Integration / Other
  - **Priority**: Medium
  - **Preconditions**: canonical HTML release flow exists
  - **Test Data**: release tag; lowered realization outputs
  - **Steps**: inspect release outputs and publication inputs
  - **Expected Result**: Nitro and CoCo realization metadata are both present and structurally complete
  - **Automation Status**: Manual
  - **Automation ID**: `MAN-COCO-REL-001`
  - **Notes**: process-backed until repo gains direct automation

- **Test Case ID**: `T021`
  - **Requirement ID**: `FR-010`, `FR-022`, `FR-023`, `NFR-011`
  - **Title**: AWS CoCo deploy/verify happy path succeeds for the canonical HTML service
  - **Type**: Functional
  - **Level**: E2E
  - **Priority**: High
  - **Preconditions**: AWS CoCo experimental environment exists
  - **Test Data**: release tag; AWS profile; `aws_coco_snp` method; cleanup mode
  - **Steps**: run deploy/verify flow; inspect landing page and attestation endpoint
  - **Expected Result**: landing page and attestation endpoint verify successfully; run is clearly labeled experimental
  - **Automation Status**: Manual
  - **Automation ID**: `MAN-COCO-AWS-001`
  - **Notes**: release-blocking manual proof for first working lane

- **Test Case ID**: `T022`
  - **Requirement ID**: `FR-023`, `NFR-013`
  - **Title**: AWS CoCo deploy can fail verification without masking the error as success
  - **Type**: Functional
  - **Level**: E2E
  - **Priority**: High
  - **Preconditions**: experimental AWS CoCo lane exists
  - **Test Data**: deploy succeeds but attestation endpoint or envelope shape is wrong
  - **Steps**: run verify flow against faulty CoCo runtime
  - **Expected Result**: run fails clearly with actionable stage/log evidence; Nitro semantics remain untouched
  - **Automation Status**: Manual
  - **Automation ID**: `MAN-COCO-AWS-002`
  - **Notes**: protects against false-green operator runs

- **Test Case ID**: `T023`
  - **Requirement ID**: `FR-011`, `FR-012`, `FR-024`
  - **Title**: Mixed Nitro and CoCo deployments show correct platform metadata
  - **Type**: Functional
  - **Level**: E2E
  - **Priority**: Medium
  - **Preconditions**: at least one Nitro and one CoCo managed run exist
  - **Test Data**: mixed deployment records
  - **Steps**: inspect run summary and deployments list
  - **Expected Result**: platform kind and realization metadata are visible and not confused
  - **Automation Status**: Manual
  - **Automation ID**: `MAN-COCO-AWS-003`
  - **Notes**: operator visibility requirement

- **Test Case ID**: `T024`
  - **Requirement ID**: `NFR-005`, `NFR-011`
  - **Title**: AWS CoCo lane is labeled experimental and cleanup remains cost-aware
  - **Type**: Non-Functional
  - **Level**: E2E / Other
  - **Priority**: Medium
  - **Preconditions**: `aws_coco_snp` method exists in operator surface
  - **Test Data**: verify run with cleanup enabled; deploy run with pause/terminate options
  - **Steps**: inspect labels, run summary, and cleanup behavior
  - **Expected Result**: experimental labeling is visible and cleanup defaults remain safe
  - **Automation Status**: Manual
  - **Automation ID**: `MAN-COCO-AWS-004`
  - **Notes**: supports operator honesty and cost discipline

- **Test Case ID**: `T025`
  - **Requirement ID**: `FR-023`, `NFR-013`
  - **Title**: Capacity fallback retries later allowed instance types after `InsufficientInstanceCapacity`
  - **Type**: Functional
  - **Level**: E2E / Other
  - **Priority**: Low
  - **Preconditions**: merged operator baseline from `origin/main` is used
  - **Test Data**: simulated or real capacity failure on first candidate
  - **Steps**: run operator deploy using branch-hardened AWS launcher
  - **Expected Result**: fallback selects later allowed instance type instead of failing immediately
  - **Automation Status**: Planned
  - **Automation ID**: `PLAN-OPS-001`
  - **Notes**: merged operator-baseline regression case

- **Test Case ID**: `T026`
  - **Requirement ID**: `FR-023`, `NFR-013`
  - **Title**: Exhausted instance-type candidates fail clearly
  - **Type**: Functional
  - **Level**: E2E / Other
  - **Priority**: Low
  - **Preconditions**: merged operator baseline from `origin/main` is used
  - **Test Data**: simulated capacity exhaustion across all candidates
  - **Steps**: run operator deploy using branch-hardened launcher
  - **Expected Result**: failure is explicit; no silent waiter errors or missing-instance-id confusion
  - **Automation Status**: Planned
  - **Automation ID**: `PLAN-OPS-002`
  - **Notes**: merged operator-baseline regression case

- **Test Case ID**: `T027`
  - **Requirement ID**: `FR-011`, `FR-012`, `FR-024`
  - **Title**: Resolved instance type persists into run metadata and operator views
  - **Type**: Functional
  - **Level**: Integration / E2E
  - **Priority**: Low
  - **Preconditions**: merged operator baseline from `origin/main` is used
  - **Test Data**: successful deploy run with resolved instance type
  - **Steps**: inspect run metadata and deployments view
  - **Expected Result**: instance type is persisted and visible in operator outputs
  - **Automation Status**: Planned
  - **Automation ID**: `PLAN-OPS-003`
  - **Notes**: merged operator-baseline regression case

### 8.2 Existing Test Cases to Modify

- **Test Case ID**: `T001`
  - **Requirement ID**: `FR-016`, `FR-017`, `NFR-008`
- **Current summary**: valid Nitro attestation -> locked verdict
- **Updated version**: valid Nitro common-envelope-compatible attestation still produces the same successful Nitro verdict and remains the baseline branch under platform dispatch
- **Reason for change**: public contract broadens, but Nitro semantics must remain unchanged

- **Test Case ID**: `T003`
  - **Requirement ID**: `FR-004`, `FR-005`, `FR-025`, `NFR-003`
- **Current summary**: facts match returns workload metadata
- **Updated version**: facts match covers both release-centered lookup and Nitro compatibility path, while keeping Nitro match semantics unchanged
- **Reason for change**: lookup shape and response shape broaden

- **Test Case ID**: `T004`
  - **Requirement ID**: `FR-004`, `FR-025`, `NFR-003`, `NFR-010`
- **Current summary**: facts miss preserves cryptographic success
- **Updated version**: facts miss preserves cryptographic success for both normalized lookup and Nitro compatibility path
- **Reason for change**: additive-only rule must survive the schema/lookup transition

- **Test Case ID**: `T007`
  - **Requirement ID**: `FR-010`, `FR-023`, `NFR-005`, `NFR-011`
- **Current summary**: verify action deploys, checks, cleans up for Nitro
- **Updated version**: verify action remains unchanged for Nitro and becomes the manual baseline against which the new AWS CoCo operator lane is compared
- **Reason for change**: operator flow now branches by platform

- **Test Case ID**: `T008`
  - **Requirement ID**: `FR-011`, `FR-012`, `FR-024`, `NFR-013`
- **Current summary**: deployments view lists and manages instances
- **Updated version**: deployments view remains correct for Nitro and becomes the baseline for later CoCo platform-visible listing behavior
- **Reason for change**: deployment view requirements broaden

### 8.3 Existing Test Cases That Remain Regression Baseline

- **Test Case ID**: `T001`
  - **Requirement ID**: `NFR-008`
  - **Why it must remain unchanged**: strongest automated Nitro crypto baseline
  - **What unchanged behavior it protects**: nonce/signature/path validation and successful Nitro verdict shape

- **Test Case ID**: `T002`
  - **Requirement ID**: `FR-003`, `NFR-002`
  - **Why it must remain unchanged**: invalid payload and verifier failure semantics must not drift while CoCo is added
  - **What unchanged behavior it protects**: unlocked state with visible failure reason

- **Test Case ID**: `T003`
  - **Requirement ID**: `NFR-003`
  - **Why it must remain unchanged**: baseline for facts-enriched success path
  - **What unchanged behavior it protects**: current Nitro happy path remains facts-enriched without regressions

- **Test Case ID**: `T004`
  - **Requirement ID**: `NFR-003`, `NFR-010`
  - **Why it must remain unchanged**: core proof that facts do not override cryptographic truth
  - **What unchanged behavior it protects**: locked Nitro state remains locked when facts miss

- **Test Case ID**: `T007`
  - **Requirement ID**: `NFR-005`
  - **Why it must remain unchanged**: current Nitro operator behavior is the working baseline
  - **What unchanged behavior it protects**: deploy/verify/cleanup success rule for Nitro

- **Test Case ID**: `T008`
  - **Requirement ID**: `NFR-013`
  - **Why it must remain unchanged**: current deployment listing/lifecycle semantics are the baseline for the broadened operator surface
  - **What unchanged behavior it protects**: Nitro deployment list/manage workflow

---

## 9. Traceability Matrix Patch

| Requirement ID | Requirement Summary | Test Case ID | Test Level | Automation ID | Status | Change Type |
|---|---|---|---|---|---|---|
| `FR-016` | common envelope | `T011`, `T012`, `T018` | unit / integration / e2e | `AUT-COCO-UNIT-001`, `AUT-COCO-UNIT-002`, `AUT-COCO-INT-004` | planned | New |
| `FR-017` | platform dispatch | `T011`, `T001` | unit / integration | `AUT-COCO-UNIT-001`, existing Vitest file | mixed | Updated |
| `FR-018` | normalized verifier result | `T013` | unit / integration | `AUT-COCO-UNIT-003` | planned | New |
| `FR-020` | CoCo workload identity | `T013`, `T014` | unit / integration / security | `AUT-COCO-UNIT-003`, `AUT-COCO-SEC-001` | planned | New |
| `FR-004` | normalized facts lookup + Nitro compatibility | `T015`, `T016`, `T017`, `T003`, `T004` | integration | `AUT-COCO-INT-001`, `AUT-COCO-INT-002`, `AUT-COCO-INT-003`, existing Vitest file | mixed | Updated |
| `FR-005` | release + matched realization response | `T015`, `T003` | integration | `AUT-COCO-INT-001`, existing Vitest file | mixed | Updated |
| `FR-019` | `accepted_realizations` facts model | `T015`, `T016` | integration | `AUT-COCO-INT-001`, `AUT-COCO-INT-002` | planned | New |
| `FR-025` | Nitro backward-compatible lookup/behavior | `T001`, `T003`, `T004`, `T017` | unit / integration | existing Vitest files + `AUT-COCO-INT-003` | mixed | Updated |
| `NFR-003` | facts remain metadata only | `T004`, `T016` | integration | existing Vitest file + `AUT-COCO-INT-002` | mixed | Updated |
| `NFR-008` | Nitro backward compatibility | `T001`, `T003`, `T004` | unit / integration | existing Vitest files | implemented | Updated baseline |
| `NFR-009` | reject generic CoCo evidence | `T014` | unit / integration / security | `AUT-COCO-SEC-001` | planned | New |
| `NFR-010` | crypto first, facts second | `T004`, `T016` | integration | existing Vitest file + `AUT-COCO-INT-002` | mixed | Updated |
| `NFR-012` | versioned/extensible envelope/result | `T011`, `T012` | unit / integration | `AUT-COCO-UNIT-001`, `AUT-COCO-UNIT-002` | planned | New |
| `FR-007` | release outputs include Nitro + CoCo | `T020` | integration / workflow | `MAN-COCO-REL-001` | manual | Updated |
| `FR-021` | canonical lowering outputs | `T020` | integration / workflow | `MAN-COCO-REL-001` | manual | New |
| `FR-010` | operator deploy/verify broadens to CoCo | `T007`, `T021`, `T022` | integration / e2e | existing manual evidence + `MAN-COCO-AWS-001`, `MAN-COCO-AWS-002` | mixed | Updated |
| `FR-011` | stage/log + platform kind | `T008`, `T023`, `T027` | integration / e2e | existing manual evidence + `MAN-COCO-AWS-003`, `PLAN-OPS-003` | mixed | Updated |
| `FR-012` | deployment list + lifecycle + metadata | `T008`, `T023`, `T027` | integration / e2e | existing manual evidence + `MAN-COCO-AWS-003`, `PLAN-OPS-003` | mixed | Updated |
| `FR-022` | CoCo runtime exposes common envelope | `T018`, `T021` | integration / e2e | `AUT-COCO-INT-004`, `MAN-COCO-AWS-001` | mixed | New |
| `FR-023` | `aws_coco_snp` operator method | `T021`, `T022`, `T025`, `T026` | e2e | `MAN-COCO-AWS-001`, `MAN-COCO-AWS-002`, `PLAN-OPS-001`, `PLAN-OPS-002` | mixed | New |
| `FR-024` | platform-visible operator metadata | `T019`, `T023`, `T027` | integration / e2e | `AUT-COCO-INT-005`, `MAN-COCO-AWS-003`, `PLAN-OPS-003` | mixed | New |
| `NFR-005` | cost-aware cleanup | `T007`, `T024` | e2e | existing manual evidence + `MAN-COCO-AWS-004` | mixed | Updated |
| `NFR-011` | CoCo lane explicitly experimental | `T021`, `T024` | e2e / other | `MAN-COCO-AWS-001`, `MAN-COCO-AWS-004` | manual | New |
| `NFR-013` | no silent Nitro operator regression | `T007`, `T008`, `T022`, `T025`, `T026`, `T027` | integration / e2e | existing manual evidence + planned/manual IDs | mixed | New |

### Explicit traceability gaps
- No implemented automated rows yet for `FR-016..020`, `NFR-009`, or `NFR-012`; they are planned test additions.
- No merged automated operator rows yet for `FR-022..024`, `NFR-011`, or `NFR-013`; they remain manual/process-backed or planned.
- `T025..T027` are now merged-baseline operator regression cases, but still lack dedicated automated coverage.

---

## 10. Test Implementation Guidance

- **Implement first**
  1. `T011`, `T012`, `T013`, `T014`
  2. `T015`, `T016`, `T017`
  3. `T019`
- **Release-blocking before merge of CoCo code**
  - existing Nitro baselines `T001`, `T003`, `T004`
  - new common-envelope/platform-dispatch tests `T011`, `T012`
  - CoCo identity/rejection tests `T013`, `T014`
  - facts migration guards `T015`, `T016`, `T017`
- **Regression-protection tests**
  - `T001`, `T002`, `T003`, `T004`, background invalid-doc coverage, `T007`, `T008`
- **Lower priority / later manual proof**
  - `T020` through `T024`
  - lower-priority merged operator-baseline cases `T025` through `T027`
- **Fixture/data/environment implications**
  - add CoCo envelope fixtures separate from Nitro fixtures
  - add normalized realization fixtures for Nitro and CoCo
  - add release-centered facts fixture shapes with multiple `accepted_realizations`
  - do not require real AWS CoCo environments for the first unit/integration pass
  - include capacity-fallback and instance-type metadata expectations from the merged operator baseline

---

## 11. Open Questions / Uncertainty Log

- **Exact raw CoCo evidence payload shape**
  - the CR fixes the public envelope and normalized identity, but not the browser-stable raw CoCo payload fields
- **Final UI location of platform metadata**
  - popup vs richer operator-only rendering may differ by implementation
- **Exact release-output artifact names for Nitro + CoCo lowering**
  - the CR fixes the required data, but not every file name or packaging detail
- **AWS CoCo substrate details**
  - the CR fixes ownership boundaries and local evidence source, but the exact substrate under the wrapper may still vary
- **Merged operator-hardening rows**
  - `T025..T027` are now part of the shared operator baseline because `origin/main` includes the former `dev/nika` hardening

---

## 12. Handoff to Development Stage

- **Exact changed requirements that implementation must satisfy**
  - `FR-004`, `FR-005`, `FR-007`, `FR-010`, `FR-011`, `FR-012`, `FR-016..025`, `NFR-003`, `NFR-005`, `NFR-008..013`
- **Exact unchanged behavior that must remain protected**
  - Nitro verifier semantics and reason codes
  - facts additivity
  - existing Nitro browser entrypoint
  - current Nitro deploy/verify/cleanup/listing semantics
- **Exact tests that must be added**
  - `T011` through `T024`
  - `T025` through `T027`
- **Exact tests that must be updated**
  - `T001`, `T003`, `T004`, `T007`, `T008`
  - these map back to current executable baselines in:
    - `tests/unit/extension/attestationVerifier.test.mjs`
    - `tests/integration/extension/content.test.mjs`
    - `tests/integration/extension/background.test.mjs`
- **Exact tests that remain regression baseline**
  - `T001`, `T002`, `T003`, `T004`, background invalid-doc and fetch bridge coverage, `T007`, `T008`
  - current executable file anchors:
    - `tests/unit/extension/attestationVerifier.test.mjs`
    - `tests/integration/extension/content.test.mjs`
    - `tests/integration/extension/background.test.mjs`
    - `tests/integration/extension/popup.test.mjs`
- **Release-blocking quality gates**
  - existing Nitro baselines remain green
  - no unsupported AWS/CoCo automation claims
  - changed requirement rows are mapped to concrete tests before code is declared complete
- **Environment or fixture requirements that implementation must respect**
  - keep Nitro fixtures intact
  - add separate CoCo envelope/evidence fixtures
  - add release-centered facts fixtures
  - keep AWS CoCo validation manual/process-backed unless the repo actually gains real operator automation

---

## Appendix A. Branch-State Considerations

- **`origin/main`**
  - authoritative merged testing truth
- **`origin/dev/nika`**
  - historical merged branch
  - its former deploy-hardening delta is now part of `origin/main`
- **`origin/dev/dastankevych`**
  - no remaining branch-only testing implication
- **`origin/dev/tatiosen`**
  - no remaining branch-only testing implication
- **`origin/feature/enclave-repo-split`**
  - historical only; already absorbed into merged truth
- **dirty root worktree `/home/gleb/zt-tech/ztbrowser`**
  - excluded from current-state testing truth because it is behind `origin/main` and contains only uncommitted drafts
