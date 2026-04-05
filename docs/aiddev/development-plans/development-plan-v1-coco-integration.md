# IMPLEMENTATION PACKAGE

## 1. Implementation Summary

- **Change Title**: Development plan for `changerequest-v1-coco-integration`
- **Scope Summary**: Implement AWS-only experimental CoCo support for the canonical HTML service across both `ztbrowser` and `ztinfra-enclaveproducedhtml`, while preserving Nitro as the working baseline and using a release-centered trust model.
- **Changed behavior**:
  - browser verifier moves from Nitro-only payload assumptions to a common attestation envelope with `platform` dispatch
  - facts move from PCR-row lookup to release-centered realization lookup while preserving Nitro compatibility
  - canonical release outputs expand from Nitro-only assets to Nitro + CoCo release metadata
  - operator surface expands from `aws_canonical` only to `aws_canonical` plus `aws_coco_snp`
- **Unchanged behavior to preserve**:
  - browser entrypoint remains `POST /.well-known/attestation`
  - Nitro verification semantics and reason codes remain unchanged
  - facts remain additive metadata only
  - existing Nitro deploy/verify success rule remains `landing page + attestation endpoint`
  - existing popup locked/unlocked model remains intact

### Branch and repo baseline

- **Merged implementation truth**: `origin/main`
- **Merged operator baseline already included in `origin/main`**:
  - merge commit `bec324d` brought in the remaining `dev/nika` deploy hardening
  - this includes:
    - `2cd14e4` EC2 capacity fallback retry behavior
    - `419bfd6` resolved `instance_type` propagation in `ztdeploy`
  - `T025`, `T026`, and `T027` are now required shared operator regression obligations, even though they still need explicit implementation or manual validation
- **Already merged historical branches, not separate baselines**:
  - `origin/dev/nika`
  - `origin/dev/dastankevych`
  - `origin/dev/tatiosen`
  - `origin/feature/enclave-repo-split`
  - their effects are already part of `origin/main`, including the external canonical workload repo split
- **Excluded draft state**:
  - dirty `/home/gleb/zt-tech/ztbrowser` browser verifier and popup changes
  - local untracked docs under `/home/gleb/zt-tech/ztbrowser/docs/`
- **Repos in scope**:
  - `ztbrowser`
  - `ztinfra-enclaveproducedhtml`

## 2. Architecture Placement

### Client side

- **Ownership**: `ztbrowser-chrome-extension/content.js`, `background.js`, `popup.js`, `popup.html`
- **Why**: browser fetch/orchestration, popup state rendering, and background transport already live there and should remain there.
- **Conformance note**: the background script remains the current verifier bridge/entrypoint; platform-specific verification logic must not move into `content.js`.

### Verifier layer

- **Ownership**: `ztbrowser-chrome-extension/verifier/*`
- **Why**: current browser verifier dispatch and Nitro validation already live here. CoCo plugin dispatch belongs beside the Nitro plugin, not in content or facts code.
- **Conformance note**: retain one normalized verifier boundary with backend-specific plugins underneath.

### Browser-safe DTO/schema modules

- **Ownership**: browser-safe schema modules under `ztbrowser-chrome-extension/verifier/*` or a neutral JSON-only module
- **Why**: the browser verifier needs common envelope/result DTOs, but browser code must not import Node-only attestation helpers.
- **Conformance note**: only pure data-shape modules may be shared across browser and Node. Do not treat `src/shared/nitroAttestation.ts` as browser-safe shared code.

### Node-side attestation helpers

- **Ownership**: `src/shared/nitroAttestation.ts` and `clientsidechecker.ts`
- **Why**: Node-side compatibility paths and checker flows already live here.
- **Conformance note**: keep Nitro CBOR/crypto verification helpers Node-only unless a separate browser-safe implementation is intentionally created.

### Facts service

- **Ownership**: `facts-node/server.ts` and `facts-node/facts-db.json`
- **Why**: the facts API and current flat facts store already live here.
- **Conformance note**: implement the release-centered model in the facts service; do not push facts matching into the browser.

### Runtime surfaces

- **Nitro runtime**: `aws-deploy/parent-proxy/src/main.rs`
- **CoCo runtime wrapper**: workload artifact owned by `ztinfra-enclaveproducedhtml`, separate from the Nitro parent proxy
- **AWS CoCo deployment integration**: orchestration/adapter code in `ztbrowser`
- **Why**: current repo truth already places workload/release ownership in the canonical workload repo and orchestration in `ztbrowser`; v1 should preserve that split rather than invent a new executable-owner boundary.

### Operator surfaces

- **Ownership**:
  - `deploy/catalog.yml`
  - `src/ztdeploy/*`
  - `scripts/aws-cli/*`
- **Why**: repo and method catalog, stage execution, lifecycle metadata, and AWS orchestration already belong here.
- **Conformance note**: add a second method and adapter path; do not invent a second deployment system.

### Canonical release repo

- **Ownership**: `/home/gleb/zt-tech/ztinfra-enclaveproducedhtml`
- **Why**: canonical release outputs, provenance generation, and facts-generation tooling already live there and are the source of truth for measured release identity.
- **Conformance note**: keep release authority in the canonical repo; `ztbrowser` consumes its outputs.

## 3. Minimal Refactor Decision

- **Decision**: Minimal local refactor required in multiple bounded subsystems
- **Rationale**:
  - `content.js` currently embeds Nitro-specific envelope assumptions
  - `attestationVerifier.mjs` currently combines dispatch, Nitro verification, nonce logic, and verdict shaping in one function
  - `facts-node/server.ts` is row-centric and PCR-centric
  - `ztdeploy` already has a catalog/method boundary, but preview/run dispatch remains hardcoded to `aws_canonical`
- **Impacted areas**:
  - extension browser flow
  - verifier dispatch
  - facts service schema and lookup path
  - release metadata authority and lowering outputs
  - runtime public envelope shape
  - operator adapter dispatch
- **Explicit non-refactors**:
  - no repo-wide cleanup
  - no replacement of AWS shell automation
  - no redesign of the popup beyond one added metadata row
  - no rewrite of Nitro parent proxy internals beyond its public response shape

## 4. Implementation Plan

### Step 0 - Use the merged operator baseline already in `origin/main`

- **Scope**: treat the merged `dev/nika` deploy hardening as the starting operator baseline for CoCo work
- **Included merged baseline**:
  - EC2 capacity fallback in `scripts/aws-cli/_common.sh`
  - `instance_type` propagation through:
    - `scripts/aws-cli/list-managed-instances.sh`
    - `src/ztdeploy/types.ts`
    - `src/ztdeploy/runner.ts`
    - `src/ztdeploy/deployments.ts`
    - `src/ztdeploy/adapters/awsCanonical.ts`
    - `src/ztdeploy/app.tsx`
- **Implementation rule**:
  - do not regress these merged operator improvements while adding CoCo support
- **Operator regression cases to add or validate against this baseline**:
  - `T025`
  - `T026`
  - `T027`

### Step 1 - Lock release authority and CoCo identity generation in `ztinfra-enclaveproducedhtml`

- **Files/modules to create or update**:
  - `.github/workflows/release-enclave.yml`
  - `tools/generate_provenance.py`
  - `ztinfra-service.yaml`
  - new release-manifest generation logic
  - new CoCo runtime-config generation logic
  - replace row-centric facts tooling:
    - `tools/render_facts_row.py`
    - `tools/upsert_facts_db.py`
- **Authoritative release rule**:
  - `release-manifest.json` becomes the single authoritative cross-platform release binding artifact for v1
  - it binds:
    - `service`
    - `release_id`
    - Nitro realization identity
    - CoCo realization identity `{ image_digest, initdata_hash }`
    - references to supporting assets such as `provenance.json` and `describe-eif.json`
  - `provenance.json` remains supporting Nitro evidence, but not a competing cross-platform release authority
- **CoCo identity generation rule**:
  - the canonical release workflow builds or resolves the immutable CoCo image digest
  - the canonical release workflow computes `initdata_hash` from the exact init-data/runtime inputs used for the CoCo realization
  - both values are published in `release-manifest.json` and propagated into facts v2 output
- **Ownership rule**:
  - executable workload-side CoCo wrapper artifacts belong to the canonical workload repo
  - `ztbrowser` consumes the release outputs and orchestrates AWS deployment; it does not become the canonical source of workload bits

### Step 2 - Add shared common-envelope and normalized-result contracts in `ztbrowser`

- **Files/modules to create or update**:
  - new browser-safe schema module for the public envelope and normalized verifier result
  - `ztbrowser-chrome-extension/verifier/attestationVerifier.mjs`
  - optional neutral JSON-only schema module for Node parity
- **Public contract to implement**:
  - `version: "ztinfra-attestation/v1"`
  - `service: string`
  - `release_id: string`
  - `platform: "aws_nitro_eif" | "aws_coco_snp"`
  - `nonce: string`
  - `claims: { workload_pubkey?: string | null, identity_hint?: string | null }`
  - `evidence: { type: "aws_nitro_attestation_doc" | "coco_trustee_evidence", payload: object }`
  - `facts_url?: string`
- **Normalized verifier result to implement**:
  - preserve top-level `workingEnv`, `codeValidated`, `reason`
  - `verified.service`
  - `verified.release_id`
  - `verified.platform`
  - `verified.identity`
  - `verified.workload_pubkey`
  - keep `verified.pcrs` for Nitro compatibility
- **Architecture placement**: verifier schema and normalization belong in verifier/shared modules, not in content script code.
- **Facts URL trust rule**:
  - `facts_url` is informational only in v1
  - browser facts enrichment must continue to use the configured/pinned facts service origin
  - if a runtime supplies `facts_url`, the browser ignores it unless a later approved change adds explicit allowlist validation

### Step 3 - Refactor the browser verifier path with minimal scope

- **Files/modules to update**:
  - `ztbrowser-chrome-extension/content.js`
  - `ztbrowser-chrome-extension/background.js`
  - `ztbrowser-chrome-extension/verifier/attestationVerifier.mjs`
  - new CoCo plugin module under `ztbrowser-chrome-extension/verifier/`
- **Exact changes**:
  - change browser-side background payload from `{ platform, nonce_sent, attestation_doc_b64 }` to `{ nonce_sent, envelope }`
  - `content.js` stops reading `evidence.nitro_attestation_doc_b64` directly
  - `content.js` fetches the full envelope and passes it unchanged to the verifier bridge
  - `background.js` remains the verifier bridge and request handler, while staying thinner than `content.js`
  - `attestationVerifier.mjs` becomes:
    - common request validation
    - `platform` dispatch
    - Nitro plugin
    - CoCo plugin
    - normalized result shaping
- **Nitro implementation rule**:
  - preserve current Nitro plugin semantics and reason codes exactly
- **CoCo implementation rule**:
  - `evidence.type` must be `coco_trustee_evidence`
  - `evidence.payload` is the raw JSON fetched by the runtime wrapper from `http://127.0.0.1:8006/aa/evidence`
  - do not invent a second raw CoCo wrapper schema in v1
  - normalized CoCo identity is:
    - `identity.type = "coco_image_initdata"`
    - `identity.value = { image_digest, initdata_hash }`
  - generic CoCo evidence without workload differentiation must be rejected

### Step 4 - Migrate facts service to release-centered matching

- **Files/modules to update**:
  - `facts-node/server.ts`
  - `facts-node/facts-db.json`
- **Schema migration rule**:
  - migrate toward v2 facts shape:
    - `{ "schema_version": 2, "releases": [...] }`
  - each release record contains:
    - `service`
    - `release_id`
    - `repo`
    - `source_image_digest`
    - `accepted_realizations`
  - each accepted realization contains:
    - `platform`
    - `identity`
- **Compatibility rule**:
  - server loader must accept both:
    - current array-of-Nitro-rows format
    - new release-centered v2 format
  - `POST /api/v1/lookup-by-pcr` remains available for Nitro compatibility
  - add `POST /api/v1/lookup-by-realization` as the primary new lookup path
- **Matching rule**:
  - compare normalized `platform + identity`
- **Trust rule**:
  - facts remain additive metadata only
  - facts miss must not override cryptographic success

### Step 5 - Change runtime surfaces without merging Nitro and CoCo internals

- **Nitro runtime**:
  - update `aws-deploy/parent-proxy/src/main.rs` to emit the common public envelope
  - keep its internal Nitro-specific vsock protocol unchanged
- **CoCo runtime**:
  - add a separate CoCo workload-side wrapper service in `ztinfra-enclaveproducedhtml`
  - wrapper responsibilities:
    - fetch raw AA evidence from `http://127.0.0.1:8006/aa/evidence`
    - wrap it into `ztinfra-attestation/v1`
    - expose `POST /.well-known/attestation`
    - expose the workload landing page for deploy verification
- **AWS integration rule**:
  - `ztbrowser` owns the AWS deploy glue, catalog entry, adapter code, and verification orchestration for the CoCo realization
  - `ztinfra-enclaveproducedhtml` owns the workload wrapper image, release metadata, and lowering outputs consumed by that orchestration
- **Do not do**:
  - do not make the Nitro parent proxy own CoCo behavior
  - do not force Nitro and CoCo into one internal runtime implementation
  - do not split executable CoCo wrapper ownership across both repos

### Step 6 - Add `aws_coco_snp` to the operator surface

- **Files/modules to update**:
  - `deploy/catalog.yml`
  - `src/ztdeploy/cli.tsx`
  - `src/ztdeploy/app.tsx`
  - `src/ztdeploy/types.ts`
  - `src/ztdeploy/runner.ts`
  - `src/ztdeploy/deployments.ts`
  - existing adapter plus one new CoCo adapter, or a clean adapter-dispatch refactor
  - relevant `scripts/aws-cli/*`
- **Exact operator changes**:
  - keep `aws_canonical`
  - add `aws_coco_snp`
  - remove preview/run hardcoding to `aws_canonical` in `app.tsx`
  - make stage execution dispatch by adapter/method
  - keep shared AWS plumbing in `_common.sh`
  - keep deploy success rule identical across methods:
    - landing page responds
    - attestation endpoint responds
- **Operator metadata to expose**:
  - `platform`
  - method id
  - `release_tag`
  - realization summary sufficient to distinguish Nitro PCR realization from CoCo image+initdata realization
  - `instance_type`
- **UX rule**:
  - `aws_coco_snp` is active but explicitly labeled experimental

### Step 7 - Minimal popup update only

- **Files/modules to update**:
  - `ztbrowser-chrome-extension/popup.js`
  - `ztbrowser-chrome-extension/popup.html`
- **Exact UI decision for v1**:
  - add one `platform` row
  - place it between `reason` and `facts`
  - do not redesign the popup otherwise
- **State rule**:
  - store `verified.service` and `verified.release_id` in browser state alongside `verifiedPlatform` and normalized identity
  - popup exposes only the new `platform` row in v1, while service/release metadata remains available to logs/state consumers without broad UI redesign
- **Reason**:
  - the test-update package requires platform visibility when present
  - the release-centered model still needs stored release metadata even if the popup stays minimal
  - the course artifact cannot leave popup placement ambiguous

### Order of execution

1. Use the merged operator baseline already in `origin/main`
2. Canonical release authority and CoCo identity binding
3. Shared envelope/result contracts
4. Browser verifier dispatch and normalized storage state
5. Facts v2 schema + lookup-by-realization + compatibility loader
6. Nitro runtime public envelope update
7. CoCo runtime wrapper in canonical workload repo
8. `aws_coco_snp` operator lane and adapter dispatch
9. Popup platform row and stored release metadata
10. Finish remaining automated gates and manual/process-backed proofs

### Step-to-requirement-and-test traceability

| Step | Primary use cases | Primary requirements | Required tests/gates |
| --- | --- | --- | --- |
| Step 0 merged operator baseline | `SC007`, `SC008`, `SC015`, `SC016` | `FR-010`, `FR-011`, `FR-012`, `FR-023`, `FR-024`, `NFR-005`, `NFR-013` | `T007` and `T008` remain green; `T025`, `T026`, `T027` must be implemented or manually validated as shared operator regression coverage |
| Step 1 release authority | `SC005`, `SC013`, `SC014` | `FR-007`, `FR-019`, `FR-020`, `FR-021`, `NFR-010` | `T020` release artifacts remain coherent; facts output fixtures derived from authoritative manifest |
| Step 2 shared contracts | `SC011`, `SC012` | `FR-016`, `FR-017`, `FR-018`, `NFR-008`, `NFR-012` | `T011`, `T012` must pass before browser flow patch is considered complete |
| Step 3 browser verifier | `SC001`, `SC011`, `SC012` | `FR-016`, `FR-017`, `FR-018`, `FR-020`, `FR-025`, `NFR-008`, `NFR-009` | `T001`, `T003`, `T011`, `T012`, `T013`, `T014` must stay green |
| Step 4 facts migration | `SC003`, `SC013` | `FR-004`, `FR-005`, `FR-019`, `FR-020`, `FR-025`, `NFR-003`, `NFR-010` | `T004`, `T015`, `T016`, `T017` must pass; facts remain additive only |
| Step 5 runtime envelopes | `SC001`, `SC015` | `FR-016`, `FR-022`, `NFR-008`, `NFR-011` | `T018` must be validated as targeted harness/manual runtime-contract coverage before signoff; Nitro attestation endpoint behavior remains unchanged |
| Step 6 operator lane | `SC007`, `SC008`, `SC015`, `SC016` | `FR-010`, `FR-011`, `FR-012`, `FR-023`, `FR-024`, `NFR-005`, `NFR-011`, `NFR-013` | `T007`, `T008`, `T021`, `T022`, `T023`, `T024`, `T025`, `T026`, `T027` |
| Step 7 popup/state | `SC016` | `FR-024`, `FR-025` | `T019` plus the current popup rendering baseline in `tests/integration/extension/popup.test.mjs` |

### Canonical CR task crosswalk

| Development step | Canonical CR task(s) | Canonical CR subtasks |
| --- | --- | --- |
| Step 0 merged operator baseline | merged precondition before `T-10` | none; preserves merged operator baseline used by `T-10` |
| Step 1 release authority | `T-8`, `T-9` | `ST-16`, `ST-18`, `ST-19`, `ST-20`, `ST-21` |
| Step 2 shared contracts | `T-7` | `ST-13`, `ST-15` |
| Step 3 browser verifier | `T-7` | `ST-14`, `ST-15` |
| Step 4 facts migration | `T-8` | `ST-16`, `ST-17`, `ST-18` |
| Step 5 runtime envelopes | `T-7`, `T-10` | `ST-13`, `ST-23` |
| Step 6 operator lane | `T-10` | `ST-22`, `ST-23`, `ST-24` |
| Step 7 popup/state | `T-10` | `ST-24` plus UI projection of platform metadata |

## 5. Code Changes

This artifact is a development plan, not code output. The later implementation stage should use this section as the exact patch map.

### Planned file groups in `ztbrowser`

- **Browser flow**
  - `ztbrowser-chrome-extension/content.js`
  - `ztbrowser-chrome-extension/background.js`
  - `ztbrowser-chrome-extension/popup.js`
  - `ztbrowser-chrome-extension/popup.html`
- **Verifier**
  - `ztbrowser-chrome-extension/verifier/attestationVerifier.mjs`
  - new CoCo verifier plugin module
  - optional browser-safe DTO/schema module under `ztbrowser-chrome-extension/verifier/`
- **Facts service**
  - `facts-node/server.ts`
  - `facts-node/facts-db.json`
  - new integration test harness for facts lookup behavior
- **Nitro runtime public contract**
  - `aws-deploy/parent-proxy/src/main.rs`
- **CoCo runtime wrapper**
  - AWS CoCo deploy glue and adapter code in `ztbrowser`
- **Operator and deploy**
  - `deploy/catalog.yml`
  - `src/ztdeploy/types.ts`
  - `src/ztdeploy/cli.tsx`
  - `src/ztdeploy/app.tsx`
  - `src/ztdeploy/runner.ts`
  - `src/ztdeploy/deployments.ts`
  - `src/ztdeploy/adapters/*`
  - `scripts/aws-cli/*`

### Planned file groups in `ztinfra-enclaveproducedhtml`

- `.github/workflows/release-enclave.yml`
- `tools/generate_provenance.py`
- replacement or extension of:
  - `tools/render_facts_row.py`
  - `tools/upsert_facts_db.py`
- new:
  - `ztinfra-service.yaml`
  - release manifest generation logic
  - CoCo runtime-config generation logic
  - workload-side CoCo wrapper module(s)
  - release-tooling validation for manifest/runtime-config/facts outputs

### Reviewability rule

- implement in small patches by subsystem:
  1. confirm merged operator baseline
  2. canonical release authority
  3. browser/verifier contracts
  4. facts migration
  5. runtime envelopes
  6. operator lane
  7. popup metadata row
- no subsystem patch should mix unrelated cleanup

## 6. Test Changes

### Release-blocking implementation/test gates by step

- **After Step 2 shared contracts**
  - `T011`
  - `T012`
- **After Step 3 browser verifier**
  - `T013`
  - `T014`
  - updated `T001`
  - updated `T003`
- **After Step 4 facts migration**
  - `T015`
  - `T016`
  - `T017`
  - updated `T004`
- **After Step 5 runtime envelopes**
  - `T018` targeted harness/manual runtime-contract validation before signoff
- **After Step 7 popup/state**
  - `T019`
  - popup regression baseline in `tests/integration/extension/popup.test.mjs`

### Tests that must be updated

- `T001`
- `T003`
- `T004`
- `T007`
- `T008`

### Existing regression baselines that must remain green

- `T001`
- `T002`
- `T003`
- `T004`
- background invalid-doc bridge coverage
- `T007`
- `T008`

### Manual/process-backed proofs required before signoff

- `T020`
- `T021`
- `T022`
- `T023`
- `T024`

### Merged operator-baseline cases that must be implemented or validated

- `T025`
- `T026`
- `T027`
- **Traceability note**:
  - these IDs are introduced by the approved CoCo test-update package and are not part of the pre-change baseline catalog yet
  - the implementation stage must add them to the maintained testing artifacts while preserving `T007` and `T008` as the current merged operator regression baseline

### File anchors for the merged automated baseline

- `tests/unit/extension/attestationVerifier.test.mjs`
- `tests/integration/extension/content.test.mjs`
- `tests/integration/extension/background.test.mjs`
- `tests/integration/extension/popup.test.mjs`

### New harnesses or test files expected during implementation

- `tests/integration/facts-node/*` for `lookup-by-realization` and compatibility loader behavior
- `tests/integration/runtime/*` or equivalent contract harness for parent-proxy/common-envelope output
- release-tooling validation in `ztinfra-enclaveproducedhtml` for:
  - `release-manifest.json`
  - `coco-runtime-config.json`
  - facts v2 generation from the authoritative manifest

### Fixture and environment rules

- keep Nitro fixtures intact
- add CoCo envelope fixtures separate from Nitro fixtures
- add normalized realization fixtures for both platforms
- add release-centered facts fixtures with multiple `accepted_realizations`
- do not require a real AWS CoCo environment for the first unit/integration tranche
- do not claim automated AWS CoCo CI

## 7. Final Safety Check

- **Scope creep check**:
  - limited to the approved CoCo CR on top of the merged `origin/main` operator baseline
  - excludes the dirty root extension UI draft and unrelated repo cleanup
- **Unchanged behavior protection check**:
  - Nitro entrypoint stays the same
  - Nitro reason codes stay the same
  - facts additivity stays the same
  - Nitro deploy/verify rule stays the same
- **Architecture boundary check**:
  - browser transport remains in background
  - verifier plugins remain in verifier layer
  - facts logic remains in facts service
  - canonical release authority remains in `ztinfra-enclaveproducedhtml`
  - Nitro runtime and CoCo runtime wrappers remain separate internals
  - browser ignores runtime-supplied `facts_url` for trust decisions in v1
- **Test obligation check**:
  - release-blocking automated tranche is explicit
  - manual/process-backed proofs are explicit
  - merged operator-baseline tests `T025`, `T026`, `T027` remain explicit and cannot be dropped from the shared deploy surface
- **Remaining risks**:
  - exact CoCo raw AA evidence fields may still need small implementation-time adaptation inside the verifier plugin
  - AWS CoCo substrate details remain experimental even though the public contract is locked
  - facts migration must preserve backward compatibility for existing flat-row data during rollout
  - canonical release workflow must prove that `image_digest` and `initdata_hash` are derived from the exact shipped CoCo realization inputs

## 8. Reviewer Notes

- **Inspect carefully**:
  - browser verifier contract changes in `content.js`, `background.js`, and `attestationVerifier.mjs`
  - facts migration compatibility in `facts-node/server.ts`
  - parent proxy public response change in `aws-deploy/parent-proxy/src/main.rs`
  - operator dispatch changes in `src/ztdeploy/app.tsx` and adapter code
  - release output changes in `ztinfra-enclaveproducedhtml` workflow, CoCo wrapper, and facts tooling
- **Most regression-sensitive files**:
  - `ztbrowser-chrome-extension/verifier/attestationVerifier.mjs`
  - `ztbrowser-chrome-extension/content.js`
  - `facts-node/server.ts`
  - `aws-deploy/parent-proxy/src/main.rs`
  - `src/ztdeploy/adapters/awsCanonical.ts`
  - canonical release workflow and manifest-generation code in `ztinfra-enclaveproducedhtml`
- **Human validation still needed**:
  - final AWS CoCo environment substrate choice under the wrapper
  - operational labeling text for the experimental CoCo lane

## Appendix A. Branch-State Considerations

- **`origin/main`**: only merged implementation truth
- **`origin/dev/nika`**: historical merged branch
  - its remaining deploy hardening is now included in `origin/main` via `bec324d`
- **`origin/dev/dastankevych`**: no remaining branch-only implementation implications
- **`origin/dev/tatiosen`**: no remaining branch-only implementation implications
- **`origin/feature/enclave-repo-split`**: historical only, already absorbed
- **dirty local root worktree**: excluded draft state and must not drive implementation decisions
