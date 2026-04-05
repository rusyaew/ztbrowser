# CoCo Development Experiments v1

## Purpose

This note records the evidence-gathering and decision-tightening work used to produce `development-plan-v1-coco-integration.md`.

It exists for one reason: the final development plan must be grounded in the actual current repository state, the approved CoCo change request, the approved test-update package, and the course evaluation criteria. It must not inherit stale assumptions from earlier AIDev drafts or from the dirty local root worktree.

Authoritative sources used here:

- merged implementation truth: `origin/main`
- merged operator hardening now present in `origin/main`
- approved CR: `docs/aiddev/change-requests/changerequest-v1-coco-integration.md`
- approved test update: `docs/aiddev/test-updates/test-update-after-changerequest-v1-coco-integration.md`
- repository analysis baseline: `docs/aiddev/evidence/analysed-v1.md`
- CoCo context: `docs/CoCo-integration-context.md`
- canonical release repo: `/home/gleb/zt-tech/ztinfra-enclaveproducedhtml`
- official CoCo references used to confirm policy/init-data grounding:
  - `https://confidentialcontainers.org/docs/features/initdata/`
  - `https://confidentialcontainers.org/docs/attestation/policies/`

Scratch worktree used for this planning phase:

- `/home/gleb/zt-tech/ztbrowser-coco-devplan-lab`

## Experiment 1 - Baseline implementation reality

### Goal

Confirm the current implementation surfaces that the CoCo change must actually modify.

### Findings

- Browser verification in `origin/main` is Nitro-only.
- The browser entrypoint remains `POST /.well-known/attestation`.
- The extension currently expects:
  - `platform: aws_nitro_eif`
  - `evidence.nitro_attestation_doc_b64`
- The background layer is already thin and mostly transport-only.
- Facts lookup is currently PCR-row-based via `POST /api/v1/lookup-by-pcr`.
- The popup currently renders only:
  - lock state
  - reason
  - facts match
  - repo/image fields
  - PCRs
  - debug trace
- `verifiedRoot` and trust-root keychain UI are not part of merged truth. They exist only in the dirty local worktree and must be excluded from the plan baseline.

### Evidence

- `origin/main:ztbrowser-chrome-extension/content.js`
- `origin/main:ztbrowser-chrome-extension/background.js`
- `origin/main:ztbrowser-chrome-extension/verifier/attestationVerifier.mjs`
- `origin/main:ztbrowser-chrome-extension/verifier/attestation.mjs`
- `origin/main:facts-node/server.ts`
- `origin/main:ztbrowser-chrome-extension/popup.js`
- `origin/main:ztbrowser-chrome-extension/popup.html`
- local dirty draft only:
  - `/home/gleb/zt-tech/ztbrowser/ztbrowser-chrome-extension/content.js`
  - `/home/gleb/zt-tech/ztbrowser/ztbrowser-chrome-extension/popup.js`
  - `/home/gleb/zt-tech/ztbrowser/ztbrowser-chrome-extension/popup.html`
  - `/home/gleb/zt-tech/ztbrowser/ztbrowser-chrome-extension/verifier/attestationVerifier.mjs`

### Decision

The development plan must treat browser changes as a local refactor of the existing Nitro-only flow, not as a greenfield verifier rewrite.

## Experiment 2 - Runtime and operator ownership

### Goal

Localize where Nitro runtime behavior ends and where the new AWS CoCo lane should begin.

### Findings

- The checked-out dirty root worktree does not currently contain `scripts/aws-cli/*` or `src/ztdeploy/*` as files on disk, but those paths do exist in `origin/main` and are therefore merged truth.
- The Nitro parent proxy is a runtime-specific public wrapper. It exposes:
  - `GET /`
  - `POST /.well-known/attestation`
- The parent proxy currently returns a Nitro-only public response shape.
- `origin/main` already contains a typed operator surface:
  - `deploy/catalog.yml`
  - `src/ztdeploy/types.ts`
  - `src/ztdeploy/catalog.ts`
  - `src/ztdeploy/runner.ts`
  - `src/ztdeploy/deployments.ts`
  - `src/ztdeploy/adapters/awsCanonical.ts`
  - `scripts/aws-cli/*`
- `ztdeploy` is structurally ready for a second method, but today it still hardcodes a single adapter path: `aws_canonical`.

### Evidence

- `origin/main:aws-deploy/parent-proxy/src/main.rs`
- `origin/main:deploy/catalog.yml`
- `origin/main:src/ztdeploy/types.ts`
- `origin/main:src/ztdeploy/catalog.ts`
- `origin/main:src/ztdeploy/app.tsx`
- `origin/main:src/ztdeploy/cli.tsx`
- `origin/main:src/ztdeploy/runner.ts`
- `origin/main:src/ztdeploy/deployments.ts`
- `origin/main:src/ztdeploy/adapters/awsCanonical.ts`
- `origin/main:scripts/aws-cli/_common.sh`
- `origin/main:scripts/aws-cli/deploy-release.sh`
- `origin/main:scripts/aws-cli/list-managed-instances.sh`

### Decision

The plan must not bolt CoCo into the Nitro parent proxy. It must instead add:

- one CoCo runtime-side public wrapper for `/.well-known/attestation`
- one second operator method `aws_coco_snp`
- one adapter dispatch refactor in `ztdeploy`

This is the smallest architecture-conformant change.

## Experiment 3 - Branch-state and prep baseline

### Goal

Determine which branches materially affect the implementation plan.

### Findings

- the former `origin/dev/nika` delta is now merged into `origin/main` via `bec324d`
- the relevant merged operator improvements are:
  - `2cd14e4` retry Nitro parent launch across EC2 capacity fallbacks
  - `419bfd6` show resolved EC2 instance type in `ztdeploy`
- those changes affect deploy/operator quality only, not trust semantics
- Historical branches with no remaining implementation delta:
  - `origin/dev/dastankevych`
  - `origin/dev/tatiosen`
  - `origin/feature/enclave-repo-split`
- The `dev/nika` hardening is now merged into `origin/main`, so it becomes part of the required operator baseline for CoCo work.

### Evidence

- `git log --graph --oneline --decorate -n 12 origin/main`
- merged files under:
  - `origin/main:scripts/aws-cli/_common.sh`
  - `origin/main:scripts/aws-cli/list-managed-instances.sh`
  - `origin/main:src/ztdeploy/types.ts`
  - `origin/main:src/ztdeploy/runner.ts`
  - `origin/main:src/ztdeploy/deployments.ts`
  - `origin/main:src/ztdeploy/adapters/awsCanonical.ts`
  - `origin/main:src/ztdeploy/app.tsx`
- `git cherry -v origin/main origin/dev/dastankevych`
- `git cherry -v origin/main origin/dev/tatiosen`
- `git cherry -v origin/main origin/feature/enclave-repo-split`

### Decision

The development plan must keep branch truth explicit:

1. `origin/main` remains the only merged implementation baseline
2. the former `dev/nika` hardening is now part of that merged baseline
3. `T025`, `T026`, and `T027` are required shared-operator regression cases

## Experiment 4 - Cross-repo release and facts migration

### Goal

Resolve whether the CoCo change can be implemented only in `ztbrowser`, or whether it requires coordinated release-tooling changes in `ztinfra-enclaveproducedhtml`.

### Findings

- The canonical release repo currently publishes only Nitro assets:
  - `ztbrowser-enclave.eif`
  - `describe-eif.json`
  - `provenance.json`
  - `SHA256SUMS`
- The current canonical facts tooling is row-centric and Nitro-centric:
  - `tools/render_facts_row.py`
  - `tools/upsert_facts_db.py`
- The current `facts-node/facts-db.json` in `ztbrowser` is a flat array of Nitro-style rows.
- The approved CR requires a release-centered facts model with `accepted_realizations`.
- The user explicitly chose a two-repo development plan.

### Evidence

- `/home/gleb/zt-tech/ztinfra-enclaveproducedhtml/README.md`
- `/home/gleb/zt-tech/ztinfra-enclaveproducedhtml/.github/workflows/release-enclave.yml`
- `/home/gleb/zt-tech/ztinfra-enclaveproducedhtml/tools/generate_provenance.py`
- `/home/gleb/zt-tech/ztinfra-enclaveproducedhtml/tools/render_facts_row.py`
- `/home/gleb/zt-tech/ztinfra-enclaveproducedhtml/tools/upsert_facts_db.py`
- `/home/gleb/zt-tech/ztbrowser/facts-node/facts-db.json`
- `/home/gleb/zt-tech/ztbrowser/scripts/fetch-enclave-release.sh`

### Decision

The development plan must cover both repos and must make the release-output migration explicit. Otherwise the implementer would be forced to invent an external dependency boundary mid-stream.

## Experiment 5 - CoCo technical grounding

### Goal

Resolve the minimal v1 CoCo technical choices that the development plan must lock so the implementer does not have to invent them.

### Findings

- The already-approved CR is authoritative for browser-facing public contracts:
  - use `platform`, not `backend`, as the public routing field
  - keep one common public outer envelope
  - use `image_digest + initdata_hash` as the CoCo canonical identity
- The CoCo context note and official docs support these choices:
  - Init-Data is measured
  - policy and init-data claims are central to workload differentiation
  - generic guest evidence is insufficient
- The least-confusing v1 path remains:
  - fetch raw AA evidence locally from `http://127.0.0.1:8006/aa/evidence`
  - wrap it in the common public envelope
  - make the verifier plugin own interpretation of the raw CoCo evidence

### Evidence

- `docs/CoCo-integration-context.md`
- `docs/aiddev/change-requests/changerequest-v1-coco-integration.md`
- `https://confidentialcontainers.org/docs/features/initdata/`
- `https://confidentialcontainers.org/docs/attestation/policies/`

### Decision

The development plan must lock the following as v1 decisions:

- raw CoCo evidence remains opaque at the public envelope boundary
- the CoCo wrapper passes through the raw AA evidence JSON in `evidence.payload`
- the CoCo verifier plugin is responsible for interpretation and normalization
- no second raw-evidence wrapper schema is invented for v1
- `facts_url` remains optional and informational only; browser trust decisions continue to use the pinned/configured facts origin

## Experiment 6 - Test and acceptance obligations

### Goal

Make sure the development plan is implementable against the approved test-update package without leaving test ordering or release blocking ambiguous.

### Findings

- The approved test update already defines the release-blocking test set for CoCo code.
- The development plan must preserve the Nitro baselines first:
  - `T001`
  - `T003`
  - `T004`
  - background invalid-doc bridge coverage
- The first new automated tranche must cover:
  - `T011` through `T019`
- Manual/process-backed CoCo operator proof remains required:
  - `T020` through `T024`
- `T025`, `T026`, and `T027` are now required because the deploy hardening is part of merged truth.

### Evidence

- `docs/aiddev/test-updates/test-update-after-changerequest-v1-coco-integration.md`

### Decision

The development plan must hard-code test sequencing and release-blocking gates. It is not enough to say "follow the test package."

## Experiment 8 - Adversarial review loop against the rubric

### Goal

Use hostile reviewers to find methodological, architectural, and repo-truth defects before accepting the development plan.

### Findings

- The first draft correctly identified the importance of the deploy hardening, but it had to be updated once that hardening actually merged into `origin/main`.
- The first draft did not provide requirement-level traceability from implementation steps to `SC` / `FR` / `NFR` / tests.
- The first draft left CoCo runtime ownership too loose across `ztbrowser` and `ztinfra-enclaveproducedhtml`.
- The first draft treated `facts_url` too loosely for a trust-sensitive boundary.
- The first draft relied too heavily on extension tests and did not call out the need for new facts/runtime/release-tooling harnesses.

### Decision

The final development plan must therefore:

- keep `origin/main` as the only merged truth
- treat the merged operator hardening as part of current `origin/main` truth
- make `ztinfra-enclaveproducedhtml` the owner of workload-side CoCo wrapper artifacts and release identity binding
- keep `ztbrowser` as the browser/facts/operator/orchestration repo
- add step-level traceability to use cases, requirements, and tests
- move release-blocking tests into the actual implementation order rather than leaving them as an end-of-plan afterthought

## Experiment 7 - Evaluation-criteria pass

### Goal

Judge whether the intended development artifact is strong enough to support a 9-10 quality chain under the course rubric.

### Findings

The artifact will miss the quality bar if it does any of the following:

- treats the dirty root worktree as implementation truth
- ignores the now-merged operator hardening in `origin/main`
- treats `ztbrowser` as the only implementation surface despite the canonical release dependency
- leaves facts migration and release outputs underspecified
- claims unsupported AWS CoCo automation
- leaves popup metadata placement ambiguous

### Decision

The final development plan must explicitly close those gaps. In particular, it must lock:

- both-repo scope
- exact branch-truth handling now that the former `dev/nika` delta is merged
- exact release asset additions
- exact popup metadata choice for v1
- exact facts migration strategy and compatibility rule

## Final experimental conclusion

The final development artifact should implement these decisions exactly:

- `origin/main` is the only merged implementation truth
- dirty local root changes are excluded draft state
- the former `dev/nika` hardening is part of `origin/main` and no longer optional prep work
- implementation scope is split across:
  - `ztbrowser`
  - `ztinfra-enclaveproducedhtml`
- browser contract remains one entrypoint and one public routing field: `platform`
- facts migrate from row-centric Nitro records to release-centered v2 records with `accepted_realizations`
- canonical release outputs must expand to include release-centered manifest data for CoCo
- workload-side CoCo wrapper ownership stays with the canonical release repo, separate from the Nitro parent proxy and from `ztbrowser` orchestration code
- test sequencing and release-blocking obligations must be explicit inside the plan, not deferred
