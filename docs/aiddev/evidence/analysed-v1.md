# REPOSITORY ANALYSIS ARTIFACT

## 1. Executive Summary

- **System type**: ZTBrowser is a multi-component trust and provenance system centered on a Chrome extension that verifies attestation in the browser, enriches the result with public facts metadata, and supports deployment and demonstration flows for enclave-backed web services.
- **Main applications/components**:
  - browser extension in `origin/main:ztbrowser-chrome-extension/*`
  - facts metadata service in `origin/main:facts-node/server.ts`
  - standalone checker compatibility service in `origin/main:clientsidechecker.ts`
  - demo attestation service in `origin/main:demo-service-repo/exampleserver.ts`
  - Micrus demo app in `origin/main:micrus/*`
  - Rust parent proxy for AWS Nitro in `origin/main:aws-deploy/parent-proxy/src/main.rs`
  - AWS CLI deployment tooling in `origin/main:scripts/aws-cli/*`
  - operator TUI in `origin/main:src/ztdeploy/*`
  - course artifact layer in `origin/main:docs/aiddev/*`
- **Overall architecture health**: structurally usable and clearer than earlier repo states, but still mixed-style. The extension verifier path, facts node, and AWS operator tooling are coherent enough for controlled change. Deployment automation and demo roots still rely on a combination of code, workflow conventions, and manual evidence rather than fully automated end-to-end enforcement.
- **Readiness for controlled change**: `READY_FOR_CHANGE`. The merged system is stable enough to support CR-driven work, and the remaining work is mostly docs/test synchronization plus normal regression-protected feature evolution.

### Methodology-fit assessment

- This artifact is strong enough to support later CR, test-update, and code-generation stages because it separates merged truth, branch-only delta, and local draft state rather than flattening them into one view.
- Its strongest evidence base is:
  - merged code in `origin/main`
  - executable tests in `origin/main:tests/*`
  - CI and runtime workflow evidence in `origin/main:.github/workflows/ci.yml`, `origin/main:scripts/aws-cli/*`, and `origin/main:src/ztdeploy/*`
- Its main methodological limitation is that some deployment/runtime truths are still process-backed rather than fully executable in CI. Later CR and test stages must preserve that distinction instead of pretending stronger automation already exists.

## 2. As-Is Product Behavior

### Main flows

1. **Browser verification flow really present today**
   - The extension content script calls `POST /.well-known/attestation` on the current origin via the background bridge in `origin/main:ztbrowser-chrome-extension/content.js`.
   - The background script performs the network request and verifier call in `origin/main:ztbrowser-chrome-extension/background.js`.
   - The verifier checks AWS Nitro-style attestation, nonce matching, and trusted roots in `origin/main:ztbrowser-chrome-extension/verifier/attestationVerifier.mjs` and `origin/main:src/shared/nitroAttestation.ts`.
   - If verification succeeds, the content script looks up the verified realization against the facts node at `https://facts-db.onrender.com` and stores state in `chrome.storage.local`.
   - Observable output: popup and icon show locked/unlocked state, reason, facts match, workload metadata, and either legacy PCR details or realization identity depending on the backend path.

2. **Facts lookup flow**
   - The extension posts verified realizations to `/api/v1/lookup-by-realization`, while `/api/v1/lookup-by-pcr` remains the Nitro compatibility path.
   - The facts node matches either `(pcr0,pcr1,pcr2,pcr8)` or release-centered accepted realizations against `facts-db.json` in `origin/main:facts-node/server.ts`.
   - Observable output: workload metadata is attached when matched; a miss does not negate cryptographic success.

3. **Local demo flow**
   - `npm run dev:facts` starts the facts node.
   - `npm run dev:example` starts a demo attestation service.
   - The unpacked extension verifies the demo page against configured trusted roots.
   - Observable output: locked or unlocked demo behavior, plus smoke-api validation via `origin/main:scripts/smoke-api.ts`.

4. **Standalone checker compatibility flow**
   - `npm run dev:checker` runs `clientsidechecker.ts`.
   - `origin/main:scripts/smoke-api.ts` still uses the checker’s `/verify` API as a compatibility/testing path.
   - Product implication: the extension verifier is current truth, but the standalone checker remains part of testing and compatibility behavior.

5. **Canonical AWS Nitro deploy flow**
   - Operators fetch and deploy tagged releases from the external canonical repo described in `origin/main:AWS-DEPLOY.md`.
   - Parent instance scripts and the Rust parent proxy expose `GET /` and `POST /.well-known/attestation` on port `9999`.
   - Observable output: a live workload page plus an attestation endpoint carrying `nitro_attestation_doc_b64`.

6. **Operator deployment workflow**
   - `origin/main:scripts/aws-cli/*` provides lifecycle automation: prerequisites, keypair, SG, launch template, instance lifecycle, deploy, verify, and cleanup.
   - `origin/main:src/ztdeploy/*` exposes the same flow through an Ink TUI with stage progress, logs, managed deployments, and cleanup controls.
   - Observable output: staged run logs, deploy/verify result, managed instance list, and terminate/stop actions.

7. **Micrus demo flow**
   - `origin/main:micrus/demo.py` and `origin/main:micrus/README.md` define a demo password flow that emits Nitro-shaped attestation but uses demo PKI by default.
   - Observable output: verified/unverified demo page modes and password-hash storage behavior.

### Entry points

- Browser page load on an origin exposing `/.well-known/attestation`
- Extension popup UI
- `npm run dev:*` scripts from `origin/main:package.json`
- facts node HTTP endpoints
- demo service HTTP endpoints
- Micrus HTTP service
- `scripts/aws-cli/*.sh`
- `npm run dev:deploy-tui` or `./scripts/run-ztdeploy.sh`
- GitHub Actions CI in `origin/main:.github/workflows/ci.yml`

### Observable outcomes

- locked/unlocked browser state
- verification reasons such as `ok`, `nonce_mismatch`, `invalid_doc`, `unsupported_platform`
- facts match and workload metadata
- HTML service response from local demo or deployed proxy
- canonical release provenance and facts update workflows
- AWS managed instance lifecycle state

### State transitions

- extension state transitions from unknown to locked/unlocked and stores debug steps
- deploy tooling transitions instances through pending/running/stopping/stopped/terminated states
- facts lookup transitions from cryptographic-only verdict to enriched metadata verdict
- operator TUI stages transition through queued/running/succeeded/failed/skipped

### Conflicts between docs and implementation

- `origin/main:README.md` correctly states the extension verifier is current and the standalone checker is legacy/compatibility, and `origin/main:scripts/smoke-api.ts` now exercises both realization lookup and Nitro compatibility.
- The local dirty root worktree still contains unmerged extension changes, but the merged popup now keeps platform/reason/facts labeling aligned with current mainline truth.
- Local untracked docs under `/home/gleb/zt-tech/ztbrowser/docs/` include presentation notes and CoCo context that are not part of `origin/main`.

## 3. As-Is Architecture

### 3.1 Client Side

- **Chrome extension**
  - `content.js` is the runtime entrypoint on visited pages.
  - `background.js` owns privileged fetch and verification bridging.
  - `popup.html` and `popup.js` render verification state from `chrome.storage.local`.
  - Input format: page origin, attestation JSON, verifier response, facts JSON.
  - Output format: icon state, popup text, stored verification/facts/debug metadata.

- **Operator TUI**
  - `src/ztdeploy/app.tsx` is the interactive client for deployment operations.
  - Inputs: repo selection, method, AWS profile, release tag, CIDRs, cleanup mode.
  - Outputs: stage state, logs, deployment listings, run metadata.

- **No Telegram bot client is present**
  - The prompt’s aiogram conventions do not map directly to this repo.

### 3.2 Backend Services

- **Facts node**
  - `origin/main:facts-node/server.ts`
  - Responsibility: expose facts/workload lookup APIs and a human-readable table view.
  - Business logic placement: lightweight matching and normalization live directly in the Express server file.
  - API contracts visible:
    - `GET /api/v1/workloads/:workload_id`
    - `GET /api/v1/workloads`
    - `POST /api/v1/lookup-by-pcr`
    - `POST /api/v1/lookup-by-realization`
  - Error handling: explicit `400` on invalid payload, `404` on missing workload, otherwise JSON success/miss.

- **Standalone checker**
  - `origin/main:clientsidechecker.ts`
  - Responsibility: direct verification API for compatibility/smoke scenarios.
  - Business logic delegates to shared attestation verifier logic.

- **Demo service**
  - `origin/main:demo-service-repo/exampleserver.ts`
  - Responsibility: emit Nitro-shaped attestation responses and a simple HTML page for testing.

- **Micrus**
  - `origin/main:micrus/demo.py`
  - Responsibility: serve a simple password demo with attestation support and demo trust roots.

- **Parent proxy**
  - `origin/main:aws-deploy/parent-proxy/src/main.rs`
  - Responsibility: expose HTTP endpoints on the parent instance and bridge requests to the enclave over vsock.
  - API contracts visible:
    - `GET /`
    - `POST /.well-known/attestation`
  - Error handling: Axum responses with `BAD_GATEWAY` JSON errors for enclave communication failures.

### 3.3 Data Architecture and Flows

- **Main entities**
  - attestation request / attestation verdict
  - PCR tuple (`pcr0`, `pcr1`, `pcr2`, `pcr8`)
  - facts row (`workload_id`, repo URLs, digests, PCRs, release/provenance fields)
  - canonical release artifact set (EIF, measurements, provenance, checksums)
  - deployment instance metadata (instance id, IP/DNS, lifecycle state)

- **Likely source-of-truth candidates**
  - merged code in `origin/main`
  - tests for extension behavior
  - `facts-node/facts-db.json` for current facts data
  - external canonical repo for measured enclave release provenance

- **Key data flows**
  1. page -> extension content -> background -> verifier -> storage/popup
  2. verifier PCRs -> facts node lookup -> workload enrichment
  3. GitHub release artifacts -> parent proxy / AWS deploy tooling -> live attestation endpoint
  4. deploy catalog -> `ztdeploy` stage runner -> AWS shell scripts -> managed instance metadata

- **Persistence/storage patterns**
  - extension state in `chrome.storage.local`
  - facts in local JSON file served by Express
  - run logs and run metadata in `~/.local/state/ztdeploy/runs/`
  - Micrus password hashes in a local JSON file in the app directory
  - no database-backed persistence layer is present in merged truth

### 3.4 Infrastructure

- **Runtime assumptions**
  - Node/TypeScript runtime for most services and tools
  - Rust toolchain for the parent proxy
  - Python runtime for Micrus
  - AWS Nitro-capable EC2 for real enclave deployment

- **Environment/config usage**
  - shell env for AWS scripts and demo services
  - facts DB path and port env in facts node
  - trust-root and mode env in Micrus and checker flows
  - local config under `~/.config/ztdeploy/config.yml`

- **Background jobs / workflows**
  - GitHub Actions CI validates typecheck, tests, and smoke API
  - Render deploy hooks run on `main`
  - canonical enclave repo owns release and rebuild workflows
  - no queue or worker subsystem is present

- **External integrations**
  - GitHub releases and Actions
  - AWS EC2 / Nitro Enclaves
  - Render deploy hooks
  - hosted facts node endpoint `https://facts-db.onrender.com`

## 4. Architecture Conformance Review

### Browser verifier boundary
- **Finding**: verification and privileged fetch are kept out of the untrusted page context via background messaging.
- **Classification**: OK
- **Evidence**: `origin/main:ztbrowser-chrome-extension/content.js`, `origin/main:ztbrowser-chrome-extension/background.js`
- **Impact**: this preserves the intended security boundary for the extension.

### Facts metadata vs cryptographic truth
- **Finding**: facts lookup is additive; a facts miss does not negate a successful cryptographic result.
- **Classification**: OK
- **Evidence**: `origin/main:ztbrowser-chrome-extension/content.js`, `origin/main:tests/integration/extension/content.test.mjs`
- **Impact**: aligns the repo with its intended trust model and reduces false negatives from metadata outages.

### Service layering inside Node services
- **Finding**: the repo does not follow a formal `model/schema/repository/service/api` backend split; Express services keep routing, validation, and small pieces of business logic in single files.
- **Classification**: PARTIAL
- **Evidence**: `origin/main:facts-node/server.ts`, `origin/main:demo-service-repo/exampleserver.ts`
- **Impact**: acceptable at current size, but additional release-realization matching can make service files denser and harder to test in isolation.

### Telegram/aiogram conventions
- **Finding**: no Telegram bot or aiogram widget architecture exists in the repository.
- **Classification**: UNCLEAR
- **Evidence**: `origin/main` tree contains no bot subsystem.
- **Impact**: the prompt’s bot conventions are not applicable and should not be used to score the repo negatively.

### Deployment tooling separation
- **Finding**: deployment behavior is split between shell scripts, TUI orchestration, and host-side clone/update logic; ownership boundaries are real but not fully formalized.
- **Classification**: PARTIAL
- **Evidence**: `origin/main:scripts/aws-cli/*`, `origin/main:src/ztdeploy/*`, `origin/main:AWS-DEPLOY.md`
- **Impact**: deploy flows are usable, but CR work touching deployment will cross TypeScript, shell, and documentation at once.

### Test-to-behavior traceability
- **Finding**: tests align strongly with extension behavior and the course docs provide explicit traceability, but runtime deploy evidence is still partly manual.
- **Classification**: PARTIAL
- **Evidence**: `origin/main:tests/*`, `origin/main:docs/aiddev/testing/traceability-matrix.md`
- **Impact**: good regression baseline for browser behavior, weaker automation for runtime deployment and Micrus flows.

### Cross-layer leaks
- **Finding**: facts node and some demo services combine transport, validation, and data access in one file, but no major forbidden direct DB access pattern exists because no DB layer exists.
- **Classification**: PARTIAL
- **Evidence**: `origin/main:facts-node/server.ts`
- **Impact**: manageable now, but this is one of the easiest places for future coupling to grow.

## 5. Existing Spec / Documentation Reality

- **Existing artifacts**:
  - root README and AWS deploy docs
  - AIDev artifact set in `origin/main:docs/aiddev/*`
  - `origin/main:prd.json`
  - `origin/main:docs/aiddev/spec/prd.json`
  - `origin/main:docs/aiddev/spec/SPEC.csv`
  - architecture and demo decks under `docs/`
- **Reliability assessment**:
  - `docs/aiddev/*` is current enough to describe merged truth through PR `#14`.
  - README is mostly aligned with merged code.
  - the dirty root worktree contains newer local-only extension/UI and CoCo-context notes that are not yet trustworthy as project truth.
- **Repo vs spec balance**:
  - implementation and tests are stronger than narrative docs for the extension verifier behavior.
  - AIDev docs are strong for product/spec/test framing but still secondary to code and tests for runtime truth.
- **Undocumented or weakly documented areas**:
  - recently merged deploy-tooling improvements now in `origin/main`
  - local draft trust-root/keychain popup behavior
  - AWS CoCo substrate proof outside the repo-only pass
- **Mapping quality**:
  - user stories, BDD, FR/NFR, and traceability can be mapped to current implementation for extension and deploy tooling.
  - AWS runtime/deploy behavior is documented honestly as partly manual/operator-driven rather than fully automated CI.

## 6. Test Reality

### Test levels found
- **Unit**
  - verifier tests in `origin/main:tests/unit/extension/attestationVerifier.test.mjs`
- **Integration**
  - extension content/background/popup tests in `origin/main:tests/integration/extension/*`
- **Smoke / lightweight E2E**
  - `origin/main:scripts/smoke-api.ts`
- **Performance**
  - none automated in merged truth
- **Security**
  - no standalone security suite; some security behavior is covered through verifier unit/integration tests
- **Monitoring-related checks**
  - none as automated monitoring tests; CI and smoke API provide basic operational confidence only

### Well-covered areas
- verifier acceptance/rejection behavior
- nonce mismatch behavior
- unsupported platform and invalid payload handling
- extension content/background messaging contracts
- popup rendering for basic locked/unlocked states
- facts-match and facts-miss semantics

### Weakly covered or uncovered areas
- AWS end-to-end deployment automation
- `ztdeploy` UI behavior and managed deployment UX
- Micrus automated tests
- hosted facts availability/staleness behavior
- Render deploy hooks and deployment monitoring
- local draft trust-root/keychain labeling behavior

### Executable-spec value
- high for extension verification semantics
- medium for facts lookup behavior
- low-to-medium for runtime deploy and Micrus flows because those remain partly manual/process-backed

### High-value regression baseline candidates
- `tests/unit/extension/attestationVerifier.test.mjs`
- `tests/integration/extension/content.test.mjs`
- `tests/integration/extension/background.test.mjs`
- `tests/integration/extension/popup.test.mjs`
- `scripts/smoke-api.ts`

### Fragile or missing coverage
- no dedicated automated contract yet around the recently merged deployment metadata improvements now present in `origin/main`
- no automated proof that operator deploy success still yields extension-verifiable behavior on a real AWS host
- no automated guardrail for local trust-root/keychain popup additions

### Sufficiency for downstream stages

- **For CR localization**: sufficient, because major ownership boundaries and hotspots are explicit.
- **For test-update work**: sufficient, because strong regression baselines and weakly covered zones are both identified.
- **For code generation**: sufficient only if future prompts continue to distinguish:
  - merged behavior
  - branch-only deployment deltas
  - local draft extension changes
  Ignoring those distinctions would reintroduce ambiguity the analysis already removed.

## 7. Likely Change Surfaces

- **UI / flow changes**
  - extension content/popup/background files
  - `src/ztdeploy/app.tsx` for operator UX
- **Validation rule changes**
  - `src/shared/nitroAttestation.ts`
  - `ztbrowser-chrome-extension/verifier/*`
  - possibly `clientsidechecker.ts` for compatibility behavior
- **Business logic changes**
  - facts matching in `facts-node/server.ts`
  - deploy orchestration in `src/ztdeploy/adapters/awsCanonical.ts` and `scripts/aws-cli/*`
  - parent proxy attestation wiring in `aws-deploy/parent-proxy/src/main.rs`
- **API contract changes**
  - `/.well-known/attestation` payloads in demo service, Micrus, and parent proxy
  - facts-node HTTP endpoints
- **State transition changes**
  - extension storage and popup state
  - deploy stage state and managed instance lifecycle
- **Data model changes**
  - facts row schema in `facts-db.json`
  - run metadata in `src/ztdeploy/types.ts`
  - provenance and release metadata interfaces
- **AI / prompt / orchestration changes**
  - course prompt artifacts under `docs/aiddev/prompts/`
  - AWS CoCo runtime/context docs and course stage prompts
- **Test additions/updates**
  - extension tests under `tests/`
  - smoke/API coverage in `scripts/smoke-api.ts`
  - future deployment-tooling tests around `src/ztdeploy/*` and `scripts/aws-cli/*`

## 8. Hotspots and Risk Zones

- **Extension verifier boundary**
  - Why risky: small changes in content/background/verifier contracts can silently break lock decisions.
  - Probable side effects: popup regressions, facts lookup breakage, false lock/unlock states.

- **Facts row and PCR normalization**
  - Why risky: matching depends on normalization semantics, especially `pcr8` handling and zero/null equivalence.
  - Probable side effects: silent facts misses or incorrect workload enrichment.

- **Deployment orchestration split across TS and shell**
  - Why risky: the deploy path spans `src/ztdeploy/*`, `scripts/aws-cli/*`, and host-side clone/update logic.
  - Probable side effects: mismatched run metadata, broken previews, lifecycle regressions, false deploy success messaging.

- **Parent proxy <-> enclave contract**
  - Why risky: HTTP-to-vsock bridging is a critical runtime path with custom Rust code.
  - Probable side effects: attestation endpoint failure, landing page failure, hard-to-debug AWS regressions.

- **Local draft extension trust-root UI changes**
  - Why risky: they change user-visible trust semantics but are not merged or tested.
  - Probable side effects: analysis confusion, incorrect CR assumptions, accidental mixing of local draft and merged truth.

- **Micrus demo path**
  - Why risky: it uses a different stack and demo trust model, but shares protocol expectations.
  - Probable side effects: inconsistent trust-root handling, divergence from extension expectations, weak regression protection.

## 9. Change Readiness Assessment

- **Classification**: `READY_FOR_CHANGE`
- **Rationale**:
  - The merged baseline is coherent enough for controlled CR-driven work.
  - Browser verification behavior is well enough tested to act as a stable contract.
  - Deployment and runtime behavior are real but still partially process-backed, not fully automated.
  - The repo contains nearby unmerged branch/local-draft state that can distort change analysis if not separated explicitly.

### Minimal local refactor signals

1. **Extract small reusable service logic from single-file Node services where future complexity will land first**
   - Reason: facts matching and release-realization matching can outgrow a single Express route file.
   - Likely affected modules: `facts-node/server.ts`, possibly demo-service logic.

2. **Treat the newly merged deploy-tooling metadata contracts as fixed baseline before larger backend additions**
   - Reason: `origin/main` now includes instance type and richer run metadata from the former `dev/nika` delta, so future CRs should treat them as existing baseline rather than optional enhancements.
   - Likely affected modules: `src/ztdeploy/types.ts`, `src/ztdeploy/runner.ts`, `scripts/aws-cli/_common.sh`, `scripts/aws-cli/list-managed-instances.sh`.

3. **Merge or discard local trust-root UI draft before CR work that touches verifier semantics**
   - Reason: current root worktree drafts change popup trust-root presentation without being part of merged truth.
   - Likely affected modules: `ztbrowser-chrome-extension/content.js`, `popup.js`, `popup.html`, `verifier/attestationVerifier.mjs`.

### Why this is not lower confidence

- The repo is not blocked, but it still has three sources of change ambiguity:
  - recently merged deployment metadata improvements that the stale local root worktree does not show
  - local draft extension trust-root UI changes
  - runtime/deploy flows that are real but not yet fully CI-enforced
- Those do not justify a redesign. They do justify disciplined CR scoping and regression planning before larger integration work such as live AWS CoCo substrate validation.

## 10. Uncertainty Log

- **Unknown**: exact current behavior of the local dirty trust-root/keychain popup draft under real extension usage.
  - Why uncertain: only local diff evidence exists; no merged test or committed doc.
  - Missing evidence: merged code or explicit local run validation.

- **Unknown**: how strictly future CRs should treat the newly merged deployment metadata improvements as regression-blocking baseline versus quality-of-life operator behavior.
  - Why uncertain: the code is now merged, but the automated test layer around it is still thin.
  - Missing evidence: stronger merged test coverage or maintainer policy on operator-surface regressions.

- **Unknown**: whether Micrus is meant to stay a demo-only branch of the protocol or become a more productized application path.
  - Why uncertain: README suggests future direction but merged tests and architecture remain minimal.
  - Missing evidence: CR/spec-level product decision.

- **Unknown**: how live AWS CoCo substrate verification should coexist with the current Nitro-first verifier contract outside the repo-only pass.
  - Why uncertain: the repo now has the merged contract, but runtime substrate evidence is still absent here.
  - Missing evidence: live AWS CoCo host validation and real operator-run proof.

- **Unknown**: how much of the AIDev prompt set beyond repository analysis should become merged repo artifacts.
  - Why uncertain: `evaluation_criteria.md` and `prompts/` exist only in the course worktree, not in merged `origin/main` yet.
  - Missing evidence: merge decision for current AIDev follow-up docs.

## 11. Recommended Handoff to CR Stage

- **Impacted product areas likely to need CR localization**
  - browser verifier and attestation envelope
  - facts-node workload-realization mapping
  - canonical release identity and provenance matching
  - deploy tooling/runtime metadata contracts
  - demo-root vs canonical-root presentation

- **Areas where current behavior must be verified carefully**
  - extension lock/unlock semantics and failure reasons
  - facts miss vs cryptographic success behavior
  - AWS deploy verification path and cleanup defaults
  - parent proxy attestation endpoint contract
  - Micrus protocol compatibility with the extension verifier

- **Areas where unchanged behavior will likely need regression protection**
  - verifier unit and integration tests
  - facts lookup semantics
  - popup rendering for locked/unlocked states
  - smoke API flow
  - deployment stage/log lifecycle contracts if CR touches runtime or backend realization logic

## Appendix A. Branch State Matrix

| Branch / state | Status vs `origin/main` | Changes actual project state? | Why it matters |
|---|---|---:|---|
| `origin/main` | baseline | Yes | authoritative merged truth for implementation, tests, CI, deploy tooling, and current course artifacts |
| `origin/dev/nika` | fully merged via `bec324d` | No | historical merged branch only; its former deployment-tooling delta is now part of `origin/main` |
| `origin/dev/dastankevych` | fully merged | No | historical branch only; its meaningful changes are already in `origin/main` |
| `origin/dev/tatiosen` | fully merged | No | historical branch only; no remaining divergence from `origin/main` |
| `origin/feature/enclave-repo-split` | fully merged | No | historical branch only; the canonical enclave repo split is already reflected in merged README/docs |
| local dirty root worktree `/home/gleb/zt-tech/ztbrowser` | uncommitted draft state | No | contains draft trust-root/keychain popup changes and untracked docs including CoCo context; useful for future planning, not valid for current-state judgment |
