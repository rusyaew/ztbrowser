# CHANGE REQUEST SPEC PATCH

## 1. CR Summary

- **CR Title**: Add AWS CoCo Integration for the Canonical HTML Service Using a Multi-Backend Release Model
- **Business Goal**: Extend ZTBrowser from a Nitro-only trust path to a release-centered trust model that can verify the same canonical service release on either AWS Nitro or AWS CoCo, while preserving the current Nitro product behavior.
- **Requested Change Summary**: Introduce a versioned common attestation envelope that keeps `platform` as the public routing field, backend-specific verifier plugins, release-centered facts records with `accepted_realizations`, first service declaration/lowering outputs for `ztinfra-enclaveproducedhtml`, and an AWS-only experimental CoCo deploy/verify operator lane exposed in `ztdeploy` as a second method.
- **Change Type**: Add + Modify
- **Impacted Scope**:
  - browser verification contract
  - facts/provenance lookup model
  - canonical release outputs for the canonical HTML service
  - AWS operator deployment workflow
  - spec/work-plan/task package for those areas
- **Primary Impacted User Story IDs**: `US-1`, `US-3`, `US-5`, `US-7`, `US-8`, new `US-11`, `US-12`, `US-13`, `US-14`, `US-15`, `US-16`
- **Primary Impacted Use Case IDs**: `SC001`, `SC003`, `SC005`, `SC007`, `SC008`, new `SC011`, `SC012`, `SC013`, `SC014`, `SC015`, `SC016`

---

## 2. Current Behavior (As-Is)

### Current actor / role
- Browser user or security reviewer using the extension
- Operator using AWS scripts or `ztdeploy`
- Canonical release maintainer for `ztinfra-enclaveproducedhtml`

### Current flow
- The browser requests `POST /.well-known/attestation`.
- The content script expects `platform: aws_nitro_eif` and `evidence.nitro_attestation_doc_b64`.
- The background verifier validates only Nitro evidence.
- The extension uses verified Nitro PCRs to call `POST /api/v1/lookup-by-pcr` on the facts node.
- Operators deploy the canonical Nitro release via AWS CLI scripts or `ztdeploy` and verify the landing page plus the attestation endpoint.

### Current Given / When / Then
- **Given** a site exposes a Nitro-shaped attestation endpoint and the extension trusts the relevant root
- **When** the extension fetches attestation and verifies the COSE document with a matching nonce
- **Then** the extension may show a lock and optionally enrich the result with facts metadata

- **Given** the canonical HTML release is published from `ztinfra-enclaveproducedhtml`
- **When** an operator runs the AWS Nitro deploy/verify flow
- **Then** the service is exposed through the parent proxy and can be verified through the current browser path

### Current Input / Output / State
- **Input**:
  - `platform`
  - `nonce_sent`
  - `attestation_doc_b64`
  - verified PCR tuple for facts lookup
- **Output**:
  - `workingEnv`
  - `codeValidated`
  - `reason`
  - `verified.pcrs`
  - optional workload metadata from facts
- **State**:
  - locked or unlocked browser state
  - Nitro-only facts match/miss outcome
  - Nitro-only deploy stage/run lifecycle

### Current business rules / constraints
- Facts are metadata and never override cryptographic truth.
- Nitro is the only production-shaped backend today.
- The canonical release authority is the dedicated enclave repo.
- The operator workflow is human-triggered automation, not autonomous CI-to-AWS CD.

### Current architecture placement
- Browser flow: `ztbrowser-chrome-extension/content.js`, `background.js`, `verifier/attestationVerifier.mjs`
- Shared attestation logic: `src/shared/nitroAttestation.ts`
- Facts: `facts-node/server.ts`
- Nitro runtime endpoint: `aws-deploy/parent-proxy/src/main.rs`
- Operator flow: `src/ztdeploy/*`, `scripts/aws-cli/*`

### Mismatches between SPEC and repo analysis
- Current AIDev spec marks CoCo as out of scope, which is accurate for `origin/main`, but this CR intentionally changes that scope.
- The course package is not fully aligned on requirement/NFR ID notation between `requirements.md`, `prd.json`, and `SPEC.csv`; this CR resolves the canonical downstream authority through the ID crosswalk in section `4`, but mirror artifacts still need later cleanup.
- `origin/main` now includes the deploy hardening that previously lived only on `origin/dev/nika`; that hardening strengthens the operator baseline but does not change current merged trust semantics.

---

## 3. Desired Behavior (To-Be)

### Updated actor / role
- Browser user or reviewer verifies one canonical service release across two AWS backend realizations.
- Operator can choose Nitro or AWS CoCo for the canonical HTML service while using the same deploy/verify product surface.
- Canonical release maintainer publishes one release that can describe more than one accepted backend realization.

### Updated flow
- The browser still calls `POST /.well-known/attestation`, but the response uses a versioned common outer envelope.
- The public routing field remains `platform` for brownfield compatibility, with `aws_nitro_eif` and `aws_coco_snp` as the first supported values.
- The verifier dispatches by `platform` instead of assuming Nitro only.
- Nitro evidence continues to normalize to a release realization identity based on PCRs.
- CoCo evidence normalizes to a release realization identity based on immutable container image digest plus measured Init-Data hash.
- Facts lookup matches the normalized identity against a release-centered record with `accepted_realizations`.
- Facts transition keeps `POST /api/v1/lookup-by-pcr` as a compatibility path and adds a normalized identity endpoint for the new browser/runtime path.
- Operators can run an AWS-only experimental CoCo deploy/verify flow for the canonical HTML service through the same operator surface by adding a second `ztdeploy` method rather than rewriting the existing Nitro method.

### Updated Given / When / Then
- **Given** the canonical HTML service release defines both Nitro and AWS CoCo realizations
- **When** the browser verifies an attestation envelope from either backend and facts resolve a matching accepted realization
- **Then** the browser shows a successful trust result for that release without caring which backend realization produced it

- **Given** an operator chooses the AWS CoCo realization for the canonical HTML service
- **When** the deploy/verify flow completes successfully
- **Then** the landing page and attestation endpoint are both live, browser-verifiable, and lifecycle-managed through the operator workflow

### Updated Input / Output / State
- **Input**:
  - versioned common attestation envelope:
    - `version`
    - `service`
    - `release_id`
    - `platform`
    - `nonce`
    - `claims`
    - `evidence`
    - `facts_url`
  - platform-specific evidence payload
  - normalized realization identity
  - release-centered facts record
- **Output**:
  - platform-agnostic verifier success/failure contract
  - normalized release identity match result
  - platform kind visible in operator/runtime metadata
- **State**:
  - Nitro and CoCo become parallel accepted realizations of the same release
  - operator deployment state includes platform kind and realization metadata

### Updated business rules / constraints
- Nitro behavior remains backward compatible and valid throughout rollout.
- CoCo evidence must include workload-specific differentiation and must not rely on generic guest evidence.
- The first CoCo scope is AWS only and experimental.
- The first CoCo-integrated service is `ztinfra-enclaveproducedhtml`, not arbitrary services.
- Facts remain transparency metadata; cryptographic verification still precedes facts enrichment.

### Addition / modification / removal
- **Addition**: CoCo backend realization, common envelope, normalized verifier output, release-centered facts, canonical service declaration/lowering, AWS CoCo operator lane
- **Modification**: affected existing feature descriptions and requirements in verification, facts, release packaging, and operator workflow
- **Removal**: none

---

## 4. What Changes

- **Changed Feature Context fields**
  - `spec.md` in-scope/out-of-scope statements for CoCo
  - `F001` description/scope/problem/solution/metrics
  - `F002` description/scope/problem/solution/metrics
  - `F003` description/scope/problem/solution/metrics
  - `F004` description/scope/problem/solution/metrics
  - add new `F006`
- **Changed User Stories**
  - modify `US-1`, `US-3`, `US-5`, `US-7`, `US-8`
  - add `US-11` through `US-16`
- **Changed Use Cases**
  - patch `SC001`, `SC003`, `SC005`, `SC007`, `SC008`
  - add `SC011` through `SC016`
- **Changed FRs**
  - patch `FR-004`, `FR-005`, `FR-007`, `FR-010`, `FR-011`, `FR-012`
  - add `FR-016` through `FR-025`
- **Changed NFRs**
  - patch `NFR-003`, `NFR-005`
  - add `NFR-008` through `NFR-013`
- **Changed Architecture sections**
  - `3.1 Client Side`
  - `3.2 Backend Services`
  - `3.3 Data Architecture and Flows`
  - `3.4 Infrastructure`
- **Changed Work Plan items**
  - add `T-7` through `T-10`
- **Changed Task Breakdown items**
  - add `T-7` through `T-10` and new subtasks `ST-13` through `ST-24`

### Canonical ID Crosswalk For This CR

- **Canonical User Story / Use Case authority**
  - `docs/aiddev/spec/user-stories-and-bdd.md`
  - `docs/aiddev/spec/prd.json`
- **Canonical FR / NFR authority**
  - `docs/aiddev/spec/requirements.md`
- **Canonical Work Plan / Task authority**
  - `docs/aiddev/plan/work-plan.md`
  - `docs/aiddev/plan/task-breakdown.md`
- **Submission mirror only**
  - `docs/artifacts/SPEC.csv`
  - `docs/artifacts/SPEC.xlsx`
- **ID normalization rule for this CR**
  - existing functional requirement IDs remain `FR-001` through `FR-015`
  - existing non-functional requirement IDs remain `NFR-001` through `NFR-007`
  - this CR extends FRs as `FR-016` through `FR-025`
  - this CR extends NFRs as `NFR-008` through `NFR-013`
  - `prd.json` shorthand variants such as `NFR001` are descriptive mirrors only; downstream test and implementation work must use the hyphenated IDs above as authoritative

---

## 5. What Stays the Same

- `SC002` invalid/malformed attestation remains an unlocked flow with visible failure reason.
- `SC004` facts miss remains a metadata issue rather than a cryptographic failure.
- `SC006` rebuild verification remains part of the canonical release provenance path.
- `SC009` and `SC010` remain demo/noncanonical flows and are not promoted into the CoCo canonical release path.
- Existing Nitro browser entrypoint remains `POST /.well-known/attestation`.
- Existing Nitro cryptographic rules and nonce checks remain unchanged.
- Existing rule that facts do not override cryptographic truth remains unchanged.
- Existing canonical release authority remains `ztinfra-enclaveproducedhtml`.
- Existing AWS Nitro deploy/verify semantics remain unchanged:
  - `verify` checks landing page plus attestation endpoint before success
  - cleanup defaults remain cost-aware
  - `ztdeploy` stage/log model remains the operator UX baseline
- No Alibaba, GCP, Azure, or general multi-cloud implementation is included in this CR.
- No production commercial control plane is added in this CR.

---

## 6. Regression-Sensitive Zones

- **Browser verifier contract**
  - `content.js` currently assumes Nitro-only `platform` and evidence shape.
  - Risk: a weak common-envelope patch could break existing Nitro lock decisions.

- **Background bridge contract**
  - `background.js` currently forwards one verifier payload shape and one verdict shape.
  - Risk: changing the contract without a normalized shape will break popup/content behavior.

- **Nitro parser and reason codes**
  - `src/shared/nitroAttestation.ts` and the current verifier are stable baseline logic.
  - Risk: backend abstraction work could silently change current reason-code behavior.

- **Facts semantics**
  - facts are currently keyed by PCR tuple and additive only.
  - Risk: a release-centered migration could accidentally make metadata authoritative or break Nitro matching.

- **Runtime endpoint contract**
  - the current parent proxy exposes the working public contract.
  - Risk: a new common envelope could regress the current Nitro service.

- **Operator workflow**
  - `ztdeploy` and `scripts/aws-cli/*` already carry significant orchestration complexity.
  - Risk: adding CoCo runtime support could break current Nitro deploy/verify, cleanup, or deployment listing semantics.

- **Deployment-sensitive operator surfaces**
  - `origin/main` now includes merged deployment hardening for instance-type visibility and capacity fallback.
  - Risk: implementation that ignores those merged operator-baseline realities will produce a weaker CoCo lane than the current mainline deploy surface.

---

## 7. SPEC Patch

### 7.1 Feature Context Patch

#### Feature `F001` — Browser-visible attestation verification
- **Description (Goal / Scope)**
  - **Current**: Browser-visible verification of Nitro attestation from the current origin.
  - **Updated**: Browser-visible verification of a versioned common attestation envelope that supports the canonical service release on either AWS Nitro or AWS CoCo.
  - **Reason**: Verification must become backend-aware without changing the user entrypoint.
- **Problem**
  - **Current**: Browser-visible attestation is hard to verify because the flow is backend-oriented and Nitro-specific.
  - **Updated**: Browser-visible attestation must remain simple even when the same service release can be realized by more than one backend.
  - **Reason**: The product goal becomes release verification, not Nitro-only verification.
- **Solution**
  - **Current**: Verify Nitro evidence and expose a lock/failure reason.
  - **Updated**: Keep one browser entrypoint, preserve `platform` as the public routing field, dispatch to backend-specific verifier plugins, and normalize the result before facts comparison.
  - **Reason**: This is the minimum additive change that keeps Nitro working and makes CoCo possible.
- **Metrics**
  - **Current**: successful verification rate and facts-match rate for the current Nitro path.
  - **Updated**: successful verification rate by backend, normalized identity match rate, and Nitro backward-compatibility pass rate.
  - **Reason**: Multi-backend support requires backend-aware quality signals.

#### Feature `F002` — Facts and provenance lookup
- **Description (Goal / Scope)**
  - **Current**: Facts lookup maps verified PCR tuples to workload metadata.
  - **Updated**: Facts lookup maps a normalized verified realization identity to a release-centered record containing one or more accepted backend realizations.
  - **Reason**: One release must be able to describe Nitro and CoCo without duplicating the product model.
  - **Problem**
    - **Current**: PCR facts explain Nitro identity only.
    - **Updated**: The same service release needs a facts model that survives realization-platform choice.
  - **Reason**: A CoCo path cannot fit a PCR-only model without fragmentation.
- **Solution**
  - **Current**: Query by verified PCR tuple.
  - **Updated**: Query by normalized identity through a new release-realization lookup while preserving Nitro PCR realization matching as one accepted realization type and keeping `/api/v1/lookup-by-pcr` as a compatibility endpoint.
  - **Reason**: Preserves the current Nitro semantics while adding CoCo identity.
- **Metrics**
  - **Current**: facts match rate for verified PCR tuples.
  - **Updated**: release-match rate across accepted realizations and Nitro-vs-CoCo facts resolution success.
  - **Reason**: The facts layer becomes release-centered.

#### Feature `F003` — Canonical enclave release provenance
- **Description (Goal / Scope)**
  - **Current**: Canonical release publishes Nitro artifacts and provenance.
  - **Updated**: Canonical release for `ztinfra-enclaveproducedhtml` publishes one release identity plus backend-specific lowering outputs for Nitro and AWS CoCo.
  - **Reason**: The release authority must stay singular while realizations multiply.
- **Solution**
  - **Current**: Publish EIF, measurements, checksums, provenance, and facts update.
  - **Updated**: Publish service/release declaration plus realization outputs, including Nitro PCR identity and CoCo `image_digest + initdata_hash` identity.
  - **Reason**: Engineers need a release artifact model that drives both verification and deploy/runtime.
- **Metrics**
  - **Current**: release artifacts and rebuild verification exist.
  - **Updated**: release completeness across both backend realizations and successful realization-to-facts publication.
  - **Reason**: Multi-backend release discipline must be measurable.

#### Feature `F004` — Operator deployment workflow
- **Description (Goal / Scope)**
  - **Current**: Operators deploy and verify the canonical Nitro release via AWS automation and `ztdeploy`.
  - **Updated**: Operators deploy and verify either the Nitro or AWS CoCo realization of the canonical HTML service through the same operator-oriented product surface.
  - **Reason**: The first CoCo product feature must be usable, not only verifiable in theory.
- **Solution**
  - **Current**: Scripted Nitro deploy/verify plus TUI stage/log visibility.
  - **Updated**: Keep the existing Nitro method `aws_canonical`, add a second experimental method `aws_coco_snp`, and require the same landing-page and attestation verification rule before success.
  - **Reason**: Full-stack v1 means a real operator flow, not just parser code.
- **Metrics**
  - **Current**: Nitro deploy success and operator-run visibility.
  - **Updated**: per-platform deploy success, verify success, cleanup correctness, and platform-visible deployment listing.
  - **Reason**: The operator product now spans two platform realizations.

#### Feature `F006` — Multi-backend service realizations and AWS CoCo integration
- **Feature**
  - **Current**: No current feature.
  - **Updated**: Introduce one release/many-realizations support for the canonical HTML service, with AWS CoCo as the first non-Nitro backend.
  - **Reason**: CoCo scope should be explicit rather than hidden inside several unrelated patches.
- **Description (Goal / Scope)**
  - **Current**: CoCo is out of scope.
  - **Updated**: Support the canonical HTML service on AWS CoCo through a versioned common envelope, normalized verifier output, release-centered facts, service declaration/lowering outputs, and AWS-only operator deployment support, while leaving non-AWS CoCo and multi-cloud portability out of scope.
  - **Reason**: This captures the additive scope cleanly.
- **Client**
  - **Current**: None.
  - **Updated**: Platform/security engineer, operator, and reviewer consuming one canonical release across multiple backend realizations.
  - **Reason**: Defines the concrete actor set for the new feature.
- **Problem**
  - **Current**: None.
  - **Updated**: The current system proves only the Nitro realization of the canonical service and cannot represent the same release on CoCo.
  - **Reason**: States the actual product gap.
- **Solution**
  - **Current**: None.
  - **Updated**: Add backend-aware verification and release-centered realization matching, with AWS CoCo using `image_digest + initdata_hash` as its canonical realization identity.
  - **Reason**: Keeps the scope narrow, explicit, and testable.
- **Metrics**
  - **Current**: None.
  - **Updated**: successful AWS CoCo verify runs, CoCo realization match rate, Nitro backward-compatibility pass rate.
  - **Reason**: Makes the new feature measurable.

### 7.2 User Stories and Use Cases Patch

#### Impacted existing User Stories

- **User Story ID**: `US-1`
  - **Role**: user / reviewer
  - **User Story**
    - **Current**: See a lock only when a Nitro attestation is valid.
    - **Updated**: See a lock only when the canonical service release is valid for the reported backend realization.
    - **Reason**: Release identity replaces backend-specific product framing.
  - **UX / User Flow**
    - **Current**: fetch Nitro attestation -> verify -> facts lookup -> lock/unlock
    - **Updated**: fetch common envelope -> backend dispatch -> normalize -> facts compare -> lock/unlock
    - **Reason**: Same user entrypoint, broader backend support.

- **User Story ID**: `US-3`
  - **Role**: reviewer / auditor
  - **User Story**
    - **Current**: Verified PCRs resolve to workload metadata.
    - **Updated**: A verified release realization resolves to one canonical release record even when the backend differs.
    - **Reason**: Facts model changes from PCR-only to release-centered.

- **User Story ID**: `US-5`
  - **Role**: operator / release maintainer
  - **User Story**
    - **Current**: Tagged CI publishes Nitro artifacts and facts updates.
    - **Updated**: Tagged CI publishes one release identity plus the realization artifacts/metadata required for Nitro and AWS CoCo.
    - **Reason**: Canonical release outputs expand.

- **User Story ID**: `US-7`
  - **Role**: operator
  - **User Story**
    - **Current**: Verify flow deploys, checks, and cleans up automatically for Nitro.
    - **Updated**: Verify flow deploys, checks, and cleans up automatically for the chosen backend realization, including AWS CoCo.
    - **Reason**: Full-stack CoCo scope touches the operator lane.

- **User Story ID**: `US-8`
  - **Role**: operator
  - **User Story**
    - **Current**: Inspect and manage live Nitro deployments from the TUI.
    - **Updated**: Inspect and manage live deployments with platform kind and realization metadata visible.
    - **Reason**: Operators must know which realization platform is running.

#### New User Stories

- **User Story ID**: `US-11`
  - **Role**: browser user / reviewer
  - **User Story**: As a reviewer, I want one attestation endpoint contract for Nitro and CoCo, so that browser entrypoints do not depend on backend-specific UX.
  - **UX / User Flow**: page load -> common attestation fetch -> backend-aware verification -> normalized result -> facts comparison

- **User Story ID**: `US-12`
  - **Role**: security engineer
  - **User Story**: As a security engineer, I want CoCo evidence to prove a workload-specific identity rather than a generic guest, so that browser-visible trust is not vulnerable to interchangeable evidence.
  - **UX / User Flow**: CoCo evidence fetch -> verifier plugin -> normalized `image_digest + initdata_hash` identity -> realization match

- **User Story ID**: `US-13`
  - **Role**: release maintainer
  - **User Story**: As a maintainer, I want one canonical release record to list multiple accepted backend realizations, so that the same service release remains auditable across backends.
  - **UX / User Flow**: release packaging -> realization outputs -> facts publication -> browser/operator consumption

- **User Story ID**: `US-14`
  - **Role**: operator
  - **User Story**: As an operator, I want the canonical HTML service to lower into Nitro and AWS CoCo deployment inputs, so that I can deploy either realization from one release.
  - **UX / User Flow**: choose backend -> fetch release outputs -> deploy selected realization -> verify

- **User Story ID**: `US-15`
  - **Role**: operator
  - **User Story**: As an operator, I want an AWS-only experimental CoCo deploy/verify path, so that I can prove the backend actually works rather than only generating code or docs.
  - **UX / User Flow**: choose `aws_coco_snp` -> deploy -> verify landing page and attestation endpoint -> cleanup/listing

- **User Story ID**: `US-16`
  - **Role**: operator / reviewer
  - **User Story**: As an operator, I want the runtime and operator UI to reveal the backend realization in use, so that Nitro and CoCo runs are not confused.
  - **UX / User Flow**: open run summary or deployments view -> inspect platform kind and realization metadata

#### Impacted existing Use Cases

- **Use Case ID**: `SC001`
  - **Given**
    - **Current**: A page origin exposes a valid Nitro attestation endpoint.
    - **Updated**: A page origin exposes a valid versioned attestation envelope for a supported backend realization.
  - **When**
    - **Current**: The extension validates the Nitro attestation document for the generated nonce.
    - **Updated**: The extension validates the backend-specific evidence for the generated nonce and normalizes the result.
  - **Then**
    - **Current**: The extension stores a successful Nitro verdict and may proceed to facts lookup.
    - **Updated**: The extension stores a successful normalized verdict and may proceed to release-centered facts lookup.
  - **Input**
    - **Current**: Nitro attestation doc.
    - **Updated**: common envelope plus backend-specific evidence.
  - **Output**
    - **Current**: Nitro-verified PCRs and verdict.
    - **Updated**: normalized release realization identity and verdict.
  - **State**
    - **Current**: locked on successful Nitro verification.
    - **Updated**: locked on successful supported-backend verification.

- **Use Case ID**: `SC003`
  - **Given**
    - **Current**: The verifier has already produced PCR values.
    - **Updated**: The verifier has produced a normalized realization identity for a release.
  - **When**
    - **Current**: The extension queries lookup-by-pcr.
    - **Updated**: The extension queries `POST /api/v1/lookup-by-realization` using the normalized realization identity, while `POST /api/v1/lookup-by-pcr` remains available for compatibility.
  - **Then**
    - **Current**: The extension stores factsMatched=true and workload metadata.
    - **Updated**: The extension stores factsMatched=true and the canonical release/workload metadata for the matching accepted realization.
  - **Input**
    - **Current**: PCR tuple.
    - **Updated**: normalized realization identity.
  - **Output**
    - **Current**: workload row.
    - **Updated**: release record plus matched realization.
  - **State**
    - **Current**: facts-enriched Nitro result.
    - **Updated**: facts-enriched multi-backend release result.

- **Use Case ID**: `SC005`
  - **Given**
    - **Current**: A release tag is pushed in the canonical enclave repo.
    - **Updated**: A release tag is pushed for the canonical HTML service and both backend realizations are enabled for that release.
  - **When**
    - **Current**: Release CI runs successfully.
    - **Updated**: Release CI generates release declaration and realization outputs for Nitro and AWS CoCo.
  - **Then**
    - **Current**: EIF, measurements, provenance, and facts-row update are produced.
    - **Updated**: Nitro PCR identity, CoCo `image_digest + initdata_hash` identity, and release-centered facts publication inputs are produced.
  - **Input**
    - **Current**: release tag.
    - **Updated**: release tag plus canonical service definition.
  - **Output**
    - **Current**: Nitro release artifacts.
    - **Updated**: release identity plus backend realization artifacts/metadata.
  - **State**
    - **Current**: canonical Nitro release ready.
    - **Updated**: canonical multi-backend release ready.

- **Use Case ID**: `SC007`
  - **Given**
    - **Current**: AWS profile and release tag are configured.
    - **Updated**: AWS profile, release tag, and platform choice are configured.
  - **When**
    - **Current**: The operator runs the verify flow.
    - **Updated**: The operator runs the verify flow for Nitro via `aws_canonical` or AWS CoCo via `aws_coco_snp`.
  - **Then**
    - **Current**: The workload is deployed, verified, and cleaned up according to settings.
    - **Updated**: The chosen backend realization is deployed, verified via landing page and attestation endpoint, and cleaned up according to settings.
  - **Input**
    - **Current**: release tag, AWS profile, cleanup mode.
    - **Updated**: release tag, AWS profile, platform selection, cleanup mode.
  - **Output**
    - **Current**: stage logs, HTTP verification, attestation verification.
    - **Updated**: same outputs plus platform-visible run metadata.
  - **State**
    - **Current**: verified Nitro deployment run.
    - **Updated**: verified platform-specific deployment run.

- **Use Case ID**: `SC008`
  - **Given**
    - **Current**: Managed instances exist in AWS.
    - **Updated**: Managed backend runs exist in AWS.
  - **When**
    - **Current**: The deployments view is opened.
    - **Updated**: The deployments view is opened after Nitro or CoCo runs.
  - **Then**
    - **Current**: The UI lists instances, states, instance types, and IPs.
    - **Updated**: The UI lists platform kind plus runtime-specific metadata alongside state and access information.
  - **Input**
    - **Current**: AWS profile.
    - **Updated**: AWS profile and runtime backend metadata.
  - **Output**
    - **Current**: lifecycle-manageable Nitro deployments.
    - **Updated**: lifecycle-manageable multi-backend deployments.
  - **State**
    - **Current**: deployment list for Nitro-managed instances.
    - **Updated**: deployment list for Nitro and AWS CoCo managed runs.

#### New Use Cases

- **Use Case ID**: `SC011`
  - **Given**: The canonical HTML service exposes a versioned common attestation envelope.
  - **When**: The browser fetches the envelope and inspects the `platform` field.
  - **Then**: The browser routes verification to the correct backend plugin without changing the page-facing entrypoint.
  - **Input**: common envelope
  - **Output**: backend-selected verifier request
  - **State**: backend-aware verification in progress

- **Use Case ID**: `SC012`
  - **Given**: The attestation envelope reports `platform: aws_coco_snp`.
  - **When**: The CoCo verifier validates the evidence and extracts a workload-specific identity.
  - **Then**: The verifier normalizes the result to `image_digest + initdata_hash` and rejects generic or insufficiently differentiated CoCo evidence.
  - **Input**: CoCo evidence payload
  - **Output**: normalized CoCo realization identity or structured failure
  - **State**: verified or rejected CoCo realization

- **Use Case ID**: `SC013`
  - **Given**: Facts node stores one release record with many accepted realizations.
  - **When**: The extension submits a normalized realization identity.
  - **Then**: Facts node returns the release record and the matched realization if any accepted realization matches.
  - **Input**: normalized realization identity
  - **Output**: release record plus matched realization
  - **State**: facts-enriched release verdict

- **Use Case ID**: `SC014`
  - **Given**: The canonical HTML service release is prepared for publication.
  - **When**: Release tooling lowers the service into Nitro and AWS CoCo realization outputs.
  - **Then**: The release produces the metadata required for both verification and deployment of each backend realization.
  - **Input**: canonical HTML service release inputs
  - **Output**: Nitro realization outputs and CoCo realization outputs
  - **State**: release ready for multi-backend deployment/verification

- **Use Case ID**: `SC015`
  - **Given**: The operator selects `aws_coco_snp` for the canonical HTML service.
  - **When**: The operator runs the deploy or verify flow.
  - **Then**: The service is deployed to the AWS CoCo lane, the landing page and attestation endpoint are verified, and cleanup behavior follows the selected mode.
  - **Input**: AWS profile, release tag, platform kind, cleanup mode
  - **Output**: stage logs, endpoint verification result, deployment metadata
  - **State**: successful or failed CoCo deployment run

- **Use Case ID**: `SC016`
  - **Given**: Nitro and CoCo runs may both exist for the canonical service.
  - **When**: The operator inspects run output or managed deployments.
  - **Then**: The UI and metadata show which backend realization is active.
  - **Input**: deployment records
  - **Output**: backend-labeled deployment view
  - **State**: operator-visible runtime distinction

#### Functional Requirements Patch

- **Req ID**: `FR-004`
  - **Current**: The extension shall query facts by verified PCR tuple.
  - **Updated**: The extension shall query a normalized realization lookup endpoint using the verified realization identity, while preserving `/api/v1/lookup-by-pcr` and Nitro PCR realization matching for backward compatibility.
  - **Reason**: Facts become release-centered.

- **Req ID**: `FR-005`
  - **Current**: Facts lookup shall expose workload metadata when a matching row exists.
  - **Updated**: Facts lookup shall expose the canonical release record and matched realization metadata when a matching accepted realization exists, using a release-centered lookup contract rather than a row-only PCR response.
  - **Reason**: Facts return shape changes.

- **Req ID**: `FR-007`
  - **Current**: Canonical enclave releases shall publish EIF, measurements, provenance manifest, and checksums.
  - **Updated**: Canonical HTML releases shall publish release identity plus backend realization outputs, including Nitro PCR identity and CoCo `image_digest + initdata_hash` identity.
  - **Reason**: Multi-backend release packaging.

- **Req ID**: `FR-010`
  - **Current**: Operators shall be able to deploy and verify a canonical release via scriptable AWS automation.
  - **Updated**: Operators shall be able to deploy and verify either the Nitro or AWS CoCo realization of the canonical HTML release via scriptable AWS automation.
  - **Reason**: Operator lane extends to CoCo.

- **Req ID**: `FR-011`
  - **Current**: The operator UI shall show stage-level progress and live logs.
  - **Updated**: The operator UI shall show stage-level progress, live logs, and platform kind for Nitro and CoCo runs.
  - **Reason**: Backend-visible operator UX.

- **Req ID**: `FR-012`
  - **Current**: The operator UI shall expose deployment list and lifecycle actions.
  - **Updated**: The operator UI shall expose deployment list, lifecycle actions, and backend/runtime metadata for Nitro and CoCo runs.
  - **Reason**: Multi-backend deployment management.

- **Req ID**: `FR-016`
  - **Current**: none
  - **Updated**: The service attestation endpoint shall use one versioned outer envelope with public fields `version`, `service`, `release_id`, `platform`, `nonce`, `claims`, `evidence`, and optional `facts_url` for Nitro and CoCo realizations.
  - **Reason**: Preserve one browser entrypoint while supporting multiple backends.

- **Req ID**: `FR-017`
  - **Current**: none
  - **Updated**: The verifier shall dispatch to backend-specific verification logic based on the attestation envelope `platform` field.
  - **Reason**: Current verifier is monolithic Nitro-only.

- **Req ID**: `FR-018`
  - **Current**: none
  - **Updated**: The verifier shall normalize successful Nitro and CoCo verification into one backend-independent release realization contract.
  - **Reason**: Facts comparison and UX need one internal target shape.

- **Req ID**: `FR-019`
  - **Current**: none
  - **Updated**: Facts node shall store one release record with one or more accepted backend realizations.
  - **Reason**: Same release must support many valid backends.

- **Req ID**: `FR-020`
  - **Current**: none
  - **Updated**: The canonical CoCo realization identity shall be matched by immutable container image digest plus measured Init-Data hash.
  - **Reason**: Workload-specific CoCo differentiation is required for browser trust.

- **Req ID**: `FR-021`
  - **Current**: none
  - **Updated**: The canonical HTML service release shall produce backend lowering outputs for `aws_nitro` and `aws_coco_snp`.
  - **Reason**: Engineers need one release authority for both paths.

- **Req ID**: `FR-022`
  - **Current**: none
  - **Updated**: The AWS CoCo runtime lane shall expose the same `/.well-known/attestation` browser entrypoint through the common outer envelope.
  - **Reason**: Browser-facing contract stays stable.

- **Req ID**: `FR-023`
  - **Current**: none
  - **Updated**: The AWS operator workflow shall support deploy and verify actions for the CoCo realization of the canonical HTML service through a new `ztdeploy`/catalog method `aws_coco_snp`, while retaining `aws_canonical` as the Nitro method.
  - **Reason**: Full-stack v1 must be operable, not only theoretically verifiable.

- **Req ID**: `FR-024`
  - **Current**: none
  - **Updated**: The operator surface shall expose platform kind and runtime metadata for each managed run.
  - **Reason**: Nitro and CoCo runs must remain distinguishable.

- **Req ID**: `FR-025`
  - **Current**: none
  - **Updated**: Nitro verification, facts enrichment, and operator deployment behavior shall remain backward compatible during CoCo rollout.
  - **Reason**: Current Nitro path is the working baseline.

#### Non-Functional Requirements Patch

- **Req ID**: `NFR-003`
  - **Current**: Facts shall be treated as metadata, not root-of-trust material.
  - **Updated**: Facts shall remain metadata, not root-of-trust material, even when records contain multiple accepted backend realizations.
  - **Reason**: Facts semantics must survive the schema change.

- **Req ID**: `NFR-005`
  - **Current**: Deployment automation shall minimize accidental cloud cost.
  - **Updated**: Deployment automation shall minimize accidental cloud cost across Nitro and CoCo runs, including verify-by-default cleanup behavior.
  - **Reason**: CoCo lane must inherit the same cost discipline.

- **Req ID**: `NFR-008`
  - **Current**: none
  - **Updated**: Existing Nitro browser and operator behavior shall remain backward compatible throughout the multi-backend transition.
  - **Reason**: Prevent regressions in the current working product.

- **Req ID**: `NFR-009`
  - **Current**: none
  - **Updated**: CoCo verification shall require workload-specific differentiation and must not accept generic guest evidence as sufficient browser-facing identity.
  - **Reason**: Addresses evidence-factory risk.

- **Req ID**: `NFR-010`
  - **Current**: none
  - **Updated**: The common envelope and normalized verifier result shall preserve the current ordering: cryptographic verification first, facts enrichment second.
  - **Reason**: Preserve trust semantics across backends.

- **Req ID**: `NFR-011`
  - **Current**: none
  - **Updated**: The first AWS CoCo lane shall be explicitly labeled experimental and AWS-only in docs and operator UX.
  - **Reason**: CoCo-on-AWS is less mature than the Nitro baseline.

- **Req ID**: `NFR-012`
  - **Current**: none
  - **Updated**: The common envelope and normalized verifier result shall be versioned so future backends can be added without breaking the browser entrypoint.
  - **Reason**: Avoid another hard-wired backend contract.

- **Req ID**: `NFR-013`
  - **Current**: none
  - **Updated**: Changes to the CoCo deploy/runtime lane shall not silently regress existing Nitro deployment behavior, logs, or lifecycle actions.
  - **Reason**: Shared operator surfaces are regression-sensitive.

### 7.3 Architecture / Solution Patch

#### 3.1 Client Side
- **Current**: Browser extension assumes Nitro-only attestation and verifier output.
- **Updated**: Browser extension continues to fetch one attestation endpoint, but now consumes a versioned common envelope whose public routing field remains `platform`, dispatches to backend-specific verifier logic, and compares a normalized realization identity to facts. Operator UI adds platform-visible method/run/deployment metadata for Nitro vs CoCo.
  - Common envelope for v1:
    - `version: "ztinfra-attestation/v1"`
    - `service: string`
    - `release_id: string`
    - `platform: "aws_nitro_eif" | "aws_coco_snp"`
    - `nonce: string`
    - `claims: { workload_pubkey?: string | null, identity_hint?: string | null }`
    - `evidence: { type: "aws_nitro_attestation_doc" | "coco_trustee_evidence", payload: object }`
    - `facts_url: string`
  - Normalized verifier result for v1:
    - preserve top-level `workingEnv`, `codeValidated`, `reason`
    - `verified.service`
    - `verified.release_id`
    - `verified.platform`
    - `verified.identity`
    - `verified.workload_pubkey`
    - existing trust-root metadata remains present
- **Reason**: Client behavior must remain stable for users while supporting a second backend.
- **Change Type**: Local update

#### 3.2 Backend Services
- **Current**: Facts node is PCR-row-based; Nitro runtime exposes Nitro-shaped evidence; no backend plugin boundary exists.
- **Updated**: Facts node becomes release-centered with `accepted_realizations` and a new normalized lookup endpoint, while `lookup-by-pcr` remains as a compatibility path. Runtime attestation services expose a versioned common envelope. Verification logic is split into backend-specific plugins behind one normalized verifier boundary. The canonical HTML service release packaging produces both Nitro and CoCo realization outputs.
  - Facts API transition rule for v1:
    - add `POST /api/v1/lookup-by-realization` as the primary new lookup contract
    - keep `POST /api/v1/lookup-by-pcr` for Nitro backward compatibility during migration
  - `lookup-by-realization` request shape:
    - `platform`
    - `identity`
  - `lookup-by-realization` response shape:
    - `matched`
    - `release`
    - `matched_realization`
  - Release record shape for v1:
    - `service`
    - `release_id`
    - `repo`
    - `source_image_digest`
    - `accepted_realizations`
  - Accepted realization shapes for v1:
    - Nitro: `platform: "aws_nitro_eif"`, `identity.type: "eif_pcr_set"`
    - CoCo: `platform: "aws_coco_snp"`, `identity.type: "coco_image_initdata"`
- **Reason**: CoCo support cannot fit the current single-backend service contracts.
- **Change Type**: Local update + New component boundary

#### 3.3 Data Architecture and Flows
- **Current**: Verified PCR tuple -> facts row -> workload metadata.
- **Updated**: Common envelope -> backend-specific verifier -> normalized realization identity -> release-centered facts record -> matched realization -> workload/release metadata. Nitro realization identity remains PCR-set-based. CoCo realization identity becomes `image_digest + initdata_hash`.
  - Nitro normalized identity for v1:
    - `identity.type: "eif_pcr_set"`
    - `identity.value: { pcr0, pcr1, pcr2, pcr8 }`
  - CoCo normalized identity for v1:
    - `identity.type: "coco_image_initdata"`
    - `identity.value: { image_digest, initdata_hash }`
  - Facts matching rule for v1:
    - compare normalized `platform + identity`
    - use `service` and `release_id` from the envelope only as advisory claims unless facts return the same release
- **Reason**: One release must support more than one backend realization.
- **Change Type**: Flow update

#### 3.4 Infrastructure
- **Current**: AWS Nitro deploy/runtime is the only production-shaped path. Operator automation is AWS Nitro only.
- **Updated**: Add an AWS-only experimental CoCo runtime/deploy lane for the canonical HTML service, exposed through the same operator product surface by adding method `aws_coco_snp` alongside the existing Nitro method `aws_canonical`. For v1, runtime ownership is fixed as follows: the canonical release pipeline owns lowering outputs for the HTML service; an AWS CoCo integration wrapper owned in this repo consumes those outputs during deployment; the public attestation wrapper runs inside the CoCo workload/PodVM, fetches raw evidence from the local Attestation Agent endpoint, and serves the versioned common envelope at `POST /.well-known/attestation`; `scripts/aws-cli/*` and `src/ztdeploy/*` own lifecycle, verify, cleanup, and listing behavior for the new method.
  - Operator contract for v1:
    - add method id `aws_coco_snp`
    - keep current Nitro method unchanged
    - surface the CoCo lane in `ztdeploy` as active but explicitly labeled experimental
  - Release/lowering contract for v1:
    - canonical repo adds `ztinfra-service.yaml` for the canonical HTML service
    - release tooling lowers it into Nitro outputs and AWS CoCo outputs
    - AWS CoCo lowering outputs include at minimum: `service`, `release_id`, `image_digest`, `initdata_hash`, optional `workload_pubkey`, and runtime wrapper inputs needed to construct the common envelope
  - Runtime wrapper ownership for v1:
    - the CoCo wrapper is the component that translates raw CoCo evidence into the public envelope contract
    - raw evidence is fetched locally from `http://127.0.0.1:8006/aa/evidence`
    - browser clients do not consume raw CoCo evidence directly
- **Reason**: Full-stack v1 requires a real backend lane without committing the project to a broad multi-cloud redesign.
- **Change Type**: New component + Constraint update

### 7.4 Work Plan Patch

- **Use Case ID**: `SC011`, `SC012`
  - **Current tasks**: none
  - **Updated tasks**: `T-7`
  - **Reason**: The common envelope and verifier plugin boundary are a distinct execution stream.

- **Use Case ID**: `SC013`
  - **Current tasks**: none
  - **Updated tasks**: `T-8`
  - **Reason**: Release-centered facts and accepted realizations require a dedicated schema/API workstream.

- **Use Case ID**: `SC014`
  - **Current tasks**: none
  - **Updated tasks**: `T-9`
  - **Reason**: Canonical service declaration and lowering are release-packaging changes, not merely facts changes.

- **Use Case ID**: `SC015`, `SC016`
  - **Current tasks**: none
  - **Updated tasks**: `T-10`
  - **Reason**: AWS CoCo runtime/operator work is a separate high-risk stream.

### 7.5 Detailed Task Breakdown Patch

#### Task `T-7`
- **Related Use Case**: `SC011`, `SC012`
- **Current Task Description**: none
- **Updated Task Description**: Add a versioned common attestation envelope and backend-specific verifier dispatch with a normalized verification result for Nitro and AWS CoCo.
- **Dependencies**: current Nitro verifier baseline; trusted-root handling; common browser entrypoint remains stable
- **DoD**: Browser and background flows can process Nitro and CoCo envelopes through one normalized verifier contract while preserving current Nitro behavior.
- **Updated/New Subtasks**:
  - `ST-13` Define the common outer envelope fields and versioning rule.
  - `ST-14` Split verifier logic into backend dispatch plus Nitro and CoCo verifier modules.
  - `ST-15` Define normalized verifier output, including failure compatibility and backend identity output.
- **Acceptance Criteria**:
  - Nitro happy-path browser behavior remains unchanged.
  - CoCo verification path has a stable normalized success/failure contract.
  - Generic CoCo guest evidence without workload differentiation is rejected.

#### Task `T-8`
- **Related Use Case**: `SC013`
- **Current Task Description**: none
- **Updated Task Description**: Convert facts from a Nitro-PCR row model to a release-centered record with `accepted_realizations` while preserving Nitro facts semantics.
- **Dependencies**: `T-7`
- **DoD**: Facts lookup can resolve either Nitro or CoCo realization identities to one canonical release record.
- **Updated/New Subtasks**:
  - `ST-16` Define release-centered facts schema with matched-realization semantics.
  - `ST-17` Add `POST /api/v1/lookup-by-realization` while preserving `POST /api/v1/lookup-by-pcr` and Nitro additive-only trust semantics.
  - `ST-18` Define migration/backward-compatibility behavior for existing Nitro facts rows.
- **Acceptance Criteria**:
  - Nitro realization matching still works.
  - CoCo realization matching uses `image_digest + initdata_hash`.
  - Facts miss still does not negate cryptographic success.

#### Task `T-9`
- **Related Use Case**: `SC014`
- **Current Task Description**: none
- **Updated Task Description**: Add canonical HTML service release declaration/lowering outputs for Nitro and AWS CoCo realizations.
- **Dependencies**: `T-8`
- **DoD**: One canonical release can publish the realization metadata required for both verification and deployment of Nitro and AWS CoCo.
- **Updated/New Subtasks**:
  - `ST-19` Define the service/release declaration fields needed for the canonical HTML service only.
  - `ST-20` Define Nitro lowering output fields in relation to the new release model.
  - `ST-21` Define AWS CoCo lowering output fields, including image digest and Init-Data hash.
- **Acceptance Criteria**:
  - The release authority remains `ztinfra-enclaveproducedhtml`.
  - Nitro realization outputs remain available.
  - CoCo realization outputs are specific enough for facts matching and runtime deployment.

#### Task `T-10`
- **Related Use Case**: `SC015`, `SC016`
- **Current Task Description**: none
- **Updated Task Description**: Add an AWS-only experimental CoCo deploy/verify/operator lane for the canonical HTML service.
- **Dependencies**: `T-7`, `T-8`, `T-9`; existing AWS operator workflow baseline including merged capacity-fallback and instance-type metadata handling in `origin/main`
- **DoD**: Operators can choose AWS CoCo for the canonical HTML service, deploy it, verify landing page plus attestation endpoint, and inspect backend-labeled runtime state from the operator surface.
- **Updated/New Subtasks**:
  - `ST-22` Keep `aws_canonical` for Nitro and add `aws_coco_snp` with platform selection and runtime metadata handling.
  - `ST-23` Implement the AWS-only CoCo runtime ownership split: lowered release outputs, in-workload attestation wrapper, and operator lifecycle/cleanup semantics.
  - `ST-24` Extend deployment listings/log summaries to surface platform kind and realization metadata.
- **Acceptance Criteria**:
  - CoCo runs satisfy the same deploy/verify success rule as Nitro: landing page + attestation endpoint verified.
  - Operator cleanup behavior remains cost-aware.
  - Nitro operator behavior is not regressed.

---

## 8. BDD Delta

- **Use Case ID**: `SC001`
  - **Current Given / When / Then**: valid Nitro endpoint -> validate Nitro doc -> locked Nitro verdict
  - **Updated Given / When / Then**: valid versioned envelope with `platform` for a supported backend -> backend-specific verification and normalization -> locked supported-backend verdict
  - **Delta Summary**: broaden successful verification from Nitro-only to backend-aware without changing the browser entrypoint
  - **Key edge cases**: unknown backend, unsupported evidence type, Nitro backward-compatibility

- **Use Case ID**: `SC003`
  - **Current Given / When / Then**: verified PCRs -> lookup-by-pcr -> workload metadata
  - **Updated Given / When / Then**: normalized realization identity -> `POST /api/v1/lookup-by-realization` -> release record plus matched realization, with `POST /api/v1/lookup-by-pcr` kept for compatibility
  - **Delta Summary**: move from backend-specific PCR lookup to release-centered realization matching
  - **Key edge cases**: Nitro row migration, CoCo identity mismatch, facts miss preserving lock state

- **Use Case ID**: `SC005`
  - **Current Given / When / Then**: tagged release -> CI -> Nitro artifacts and facts update
  - **Updated Given / When / Then**: tagged release -> CI/lowering -> Nitro and CoCo realization outputs for one release
  - **Delta Summary**: release packaging expands from one backend realization to two
  - **Key edge cases**: one realization generated, the other missing; mismatch between lowered realization and facts publication

- **Use Case ID**: `SC007`
  - **Current Given / When / Then**: AWS Nitro inputs configured -> verify flow -> deploy, verify, cleanup
  - **Updated Given / When / Then**: AWS backend chosen -> verify flow -> deploy chosen realization, verify landing page and attestation endpoint, cleanup
  - **Delta Summary**: platform selection becomes part of the operator flow
  - **Key edge cases**: CoCo runtime comes up but attestation endpoint shape is wrong; deploy succeeds but verify fails; cleanup regressions

- **Use Case ID**: `SC008`
  - **Current Given / When / Then**: managed Nitro instances exist -> open deployments view -> see and manage instances
  - **Updated Given / When / Then**: managed Nitro or CoCo runs exist -> open deployments view -> see and manage runs with backend metadata
  - **Delta Summary**: deployment listing becomes backend-aware
  - **Key edge cases**: mixed Nitro and CoCo runs; missing backend metadata; stale lifecycle data

- **Use Case ID**: `SC011`
  - **Current Given / When / Then**: no current use case
  - **Updated Given / When / Then**: common envelope exposed -> browser inspects `platform` -> correct verifier plugin selected
  - **Delta Summary**: new multi-backend browser contract
  - **Key edge cases**: envelope version mismatch, missing platform field

- **Use Case ID**: `SC012`
  - **Current Given / When / Then**: no current use case
  - **Updated Given / When / Then**: CoCo evidence received -> verifier validates and extracts workload-specific identity -> normalized CoCo realization returned or rejected
  - **Delta Summary**: new CoCo verification flow
  - **Key edge cases**: generic evidence-factory-style evidence, missing Init-Data hash, image digest mismatch

- **Use Case ID**: `SC013`
  - **Current Given / When / Then**: no current use case
  - **Updated Given / When / Then**: release-centered facts record exists -> normalized identity submitted -> matched realization returned
  - **Delta Summary**: new facts comparison model
  - **Key edge cases**: many accepted realizations, no match, Nitro-only historical record

- **Use Case ID**: `SC014`
  - **Current Given / When / Then**: no current use case
  - **Updated Given / When / Then**: canonical service release prepared -> lowered for Nitro and CoCo -> both realization outputs generated
  - **Delta Summary**: new release declaration/lowering path
  - **Key edge cases**: one lowering output missing or inconsistent with release identity

- **Use Case ID**: `SC015`
  - **Current Given / When / Then**: no current use case
  - **Updated Given / When / Then**: operator chooses AWS CoCo -> deploy/verify flow runs -> landing page and attestation endpoint verified
  - **Delta Summary**: new full-stack AWS CoCo operator lane
  - **Key edge cases**: runtime deploys but browser verification fails; CoCo lane starts but generic evidence prevents match

- **Use Case ID**: `SC016`
  - **Current Given / When / Then**: no current use case
  - **Updated Given / When / Then**: mixed platform runs exist -> operator inspects run/deployment metadata -> platform realization is visible
  - **Delta Summary**: new platform-visible operator UX
  - **Key edge cases**: missing platform labels, stale listing metadata, mixed deployment confusion

---

## 9. Open Questions / Uncertainty Log

- **Legacy mirror drift**
  - `requirements.md`, `prd.json`, and `SPEC.csv` are not perfectly aligned today.
  - This CR resolves the canonical authority for downstream work, but mirror artifacts should still be updated later so reviewers do not see conflicting copies.

- **AWS substrate implementation choice**
  - The CR fixes ownership of the public runtime contract, the local evidence source, and operator responsibilities.
  - It still leaves room for the exact AWS substrate implementation underneath that wrapper, as long as it can run the canonical HTML service, reach the local Attestation Agent endpoint, and remain scriptable from the operator surface.

- **Raw CoCo evidence payload shape**
  - The CR fixes the browser-facing common envelope and the normalized verifier output.
  - It does not require the raw `evidence.payload` to expose a browser-stable field schema beyond what the backend verifier plugin needs.

- **Optional workload public key claim**
  - The CR allows `workload_pubkey` as an optional claim in the common envelope.
  - It is not the required v1 CoCo matching key; v1 matching is `image_digest + initdata_hash`.

- **Stale local-root checkout**
  - The dirty local root worktree is still behind `origin/main` and therefore does not reflect the merged deploy hardening.
  - Implementation should use current `origin/main` truth for shared deploy surfaces, not the stale local root checkout.

---

## 10. Handoff to Next Stage

- **Exact changed SPEC fragments**
  - `spec.md` scope patch: add AWS-only CoCo support for the canonical HTML service to in-scope and keep non-AWS CoCo/multi-cloud out of scope
  - Feature patches: `F001`, `F002`, `F003`, `F004`, new `F006`
  - Existing use-case patches: `SC001`, `SC003`, `SC005`, `SC007`, `SC008`
  - New use cases: `SC011` to `SC016`
  - FR patches: `FR-004`, `FR-005`, `FR-007`, `FR-010`, `FR-011`, `FR-012`, new `FR-016` to `FR-025`
  - NFR patches: `NFR-003`, `NFR-005`, new `NFR-008` to `NFR-013`
  - New tasks: `T-7` to `T-10`

- **Exact unchanged behavior that must be protected**
  - Nitro browser verification semantics
  - Nitro facts-miss behavior
  - current `/.well-known/attestation` entrypoint
  - current canonical release authority
  - current Nitro operator deploy/verify/cleanup semantics
  - current demo/self-signed noncanonical separation

- **Likely requirements to propagate into test updates**
  - platform dispatch correctness
  - normalized result contract
  - release-centered facts matching
  - CoCo workload differentiation rejection cases
  - Nitro backward-compatibility tests
  - AWS CoCo deploy/verify lifecycle tests and operator metadata visibility

- **Likely architecture areas that implementation will touch**
  - extension content/background/verifier flow
  - shared attestation/verifier boundary
  - facts node schema and lookup API
  - canonical release packaging for the HTML service
  - runtime attestation endpoint wrapper for CoCo
  - `ztdeploy` and AWS automation surfaces

- **Whether a minimal refactor may be needed before implementation**
  - Yes. A small local refactor is likely needed to split the current Nitro-only verifier into backend plugins and to isolate facts matching logic from the current single-file facts route. This is a localized enabling refactor, not a redesign.
