# CoCo Test-Update Experiments v1

## Purpose

This note records the evidence-gathering and review passes used to produce `test-update-after-changerequest-v1-coco-integration.md`.

Experiment workspace:
- `/home/gleb/zt-tech/ztbrowser-coco-testupdate-lab`
- based on `origin/main` at `6bf23b7`

Authoritative artifact inputs:
- `docs/aiddev/change-requests/changerequest-v1-coco-integration.md`
- `docs/aiddev/evidence/analysed-v1.md`
- `docs/aiddev/testing/test-strategy.md`
- `docs/aiddev/testing/traceability-matrix.md`
- `docs/aiddev/testing/test-case-catalog.md`
- `docs/aiddev/testing/test-gaps.md`
- `/home/gleb/zt-tech/ztbrowser/docs/CoCo-integration-context.md`

## Experiment 1 - Current automated baseline inventory

### Goal
Confirm what automated tests actually exist today and which unchanged Nitro behaviors already have real regression protection.

### Evidence
- `package.json`
- `vitest.config.mjs`
- `tests/unit/extension/attestationVerifier.test.mjs`
- `tests/integration/extension/background.test.mjs`
- `tests/integration/extension/content.test.mjs`
- `tests/integration/extension/popup.test.mjs`

### Findings
- Current wired automation is Vitest only.
- Current automated coverage is extension-only.
- Highest-value unchanged Nitro regression baselines are:
  - `tests/unit/extension/attestationVerifier.test.mjs`
  - `tests/integration/extension/content.test.mjs`
  - `tests/integration/extension/background.test.mjs`
- `tests/integration/extension/popup.test.mjs` is useful UI smoke coverage, but lower-value than the trust-semantics baselines above.
- There is no automated current-state regression baseline for:
  - facts-node HTTP contracts
  - parent proxy runtime envelope
  - Nitro deploy/verify/operator flow

### Decision impact
- The test-update artifact must preserve the existing extension baselines explicitly.
- It must not claim broader automation than the repo really has.

## Experiment 2 - Branch-state and operator-surface audit

### Goal
Determine whether any branch other than `origin/main` changes the testing obligations for the CoCo CR.

### Evidence
- `origin/main`
- merged operator hardening now present in `origin/main`
- `origin/dev/dastankevych`
- `origin/dev/tatiosen`
- `origin/feature/enclave-repo-split`
- local root worktree `/home/gleb/zt-tech/ztbrowser`

### Findings
- The former `origin/dev/nika` hardening is now merged and creates live mainline testing implications for the shared operator surface.
- Its relevant deltas are deploy/operator-only:
  - EC2 capacity fallback retry behavior in `scripts/aws-cli/_common.sh`
  - resolved instance-type propagation in `scripts/aws-cli/list-managed-instances.sh`, `src/ztdeploy/types.ts`, `src/ztdeploy/app.tsx`, `src/ztdeploy/deployments.ts`, and `src/ztdeploy/runner.ts`
- `origin/dev/dastankevych`, `origin/dev/tatiosen`, and `origin/feature/enclave-repo-split` are already absorbed into `origin/main` and add no remaining branch-only test implications.
- The dirty root worktree is behind `origin/main` and contains only uncommitted extension/doc drafts. It is not current-state testing truth.

### Decision impact
- The final artifact must include a branch-state appendix.
- operator-hardening cases should now appear as merged-baseline shared deploy-surface coverage, not branch-adjacent planned-only coverage.

## Experiment 3 - CoCo contract-derived test obligations

### Goal
Translate the approved CR and CoCo context into concrete testing obligations without designing implementation.

### Evidence
- `docs/aiddev/change-requests/changerequest-v1-coco-integration.md`
- `/home/gleb/zt-tech/ztbrowser/docs/CoCo-integration-context.md`

### Findings
- New or changed behavior that must be tested:
  - common attestation envelope with `platform`
  - platform dispatch across `aws_nitro_eif` and `aws_coco_snp`
  - CoCo verifier success path with normalized `image_digest + initdata_hash`
  - CoCo verifier rejection for generic/non-workload-specific evidence
  - release-centered facts with `accepted_realizations`
  - `POST /api/v1/lookup-by-realization`
  - `POST /api/v1/lookup-by-pcr` retained only as Nitro compatibility
  - common runtime envelope at `POST /.well-known/attestation`
  - AWS-only experimental `aws_coco_snp` operator lane
  - platform-visible operator metadata
- Unchanged neighboring behavior that must remain protected:
  - Nitro cryptographic rules and reason codes
  - facts remain additive only
  - existing browser entrypoint remains `POST /.well-known/attestation`
  - current Nitro deploy/verify semantics remain unchanged

### Decision impact
- The final artifact must clearly separate:
  - modified Nitro baselines
  - new CoCo coverage
  - manual/process-backed CoCo operator work

## Experiment 4 - AIDev testing-doc gap analysis

### Goal
Determine what the current testing documents fail to provide for a mature brownfield test patch.

### Evidence
- `docs/aiddev/testing/test-strategy.md`
- `docs/aiddev/testing/traceability-matrix.md`
- `docs/aiddev/testing/test-case-catalog.md`
- `docs/aiddev/testing/test-gaps.md`
- `docs/aiddev/prompts/test-update-prompt.md`
- `docs/aiddev/change-requests/changerequest-v1-coco-integration.md`

### Findings
- ID authority is ambiguous in the current testing docs; the CR resolves it, but the testing layer does not yet carry that crosswalk.
- Requirement-to-test mapping is too coarse today; it is feature-level, not requirement-level.
- The current test catalog has no requirement IDs, automation status, or automation IDs.
- The current traceability matrix mixes automated, manual, workflow, and local-draft evidence in one column without status typing.
- `test-gaps.md` will become stale if the CoCo CR is approved and the test-update artifact does not patch it.

### Decision impact
- The final artifact must lock the CR's canonical ID authority into the testing layer.
- It must patch not only strategy, cases, and traceability, but also the impacted test-gaps sections.

## Experiment 5 - Quality-gate review

### Goal
Check whether the planned artifact is strong enough to support downstream implementation and course grading.

### Evidence
- `docs/aiddev/evaluation_criteria.md`
- `docs/aiddev/prompts/artifact-quality-gate.md`
- `docs/aiddev/prompts/test-update-prompt.md`

### Findings
- A weak artifact here would drag the package below a strong `9` even if the CR is good, because the methodology requires spec -> tests -> code consistency.
- The main failure modes to avoid are:
  - ambiguous requirement IDs
  - overclaiming AWS/CoCo automation
  - failing to protect unchanged Nitro behavior
  - failing to distinguish merged operator baseline from stale local-root state
- The mature artifact must be consumable by:
  - the later test implementation stage
  - engineers writing code against the approved CR

### Decision impact
- The final artifact must include explicit unchanged baselines, exact changed requirement IDs, automation truth, and branch-state notes.

## Final experimental conclusion

The mature CoCo test-update artifact should be:
- a localized brownfield patch, not a rewritten strategy
- based on `origin/main` as merged truth
- explicit that wired automation is still extension-first
- explicit that AWS CoCo operator coverage is manual/process-backed in v1
- explicit that the former `dev/nika` hardening now contributes merged operator regression cases
- explicit that hyphenated FR/NFR IDs from `requirements.md` are the canonical downstream identifiers
