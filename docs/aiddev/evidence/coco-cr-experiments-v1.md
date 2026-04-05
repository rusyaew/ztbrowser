# CoCo CR Experiments v1

## Purpose

This note records the evidence-gathering and feasibility checks used to produce `changerequest-v1-coco-integration.md`.

Experiment workspace:
- `/home/gleb/zt-tech/ztbrowser-coco-cr-lab`
- based on `origin/main` at `6bf23b7`

## Experiment 1 — Current attestation contract localization

### Goal
Confirm whether CoCo can be added as a narrow patch or whether current browser/runtime contracts are structurally Nitro-only.

### Evidence
- `ztbrowser-chrome-extension/content.js`
- `ztbrowser-chrome-extension/background.js`
- `ztbrowser-chrome-extension/verifier/attestationVerifier.mjs`
- `src/shared/nitroAttestation.ts`
- `aws-deploy/parent-proxy/src/main.rs`

### Findings
- Browser flow is hard-wired to `platform === aws_nitro_eif`.
- Runtime attestation expects `evidence.nitro_attestation_doc_b64`.
- Shared verifier logic is Nitro-specific and produces Nitro-specific verified output.
- The outer browser entrypoint `POST /.well-known/attestation` already exists and is the right stability boundary to preserve.

### Decision impact
- The CR must add a versioned common outer envelope and backend-specific verifier plugins.
- CoCo cannot be added as a facts-only or deploy-only patch.

## Experiment 2 — Facts-node model viability

### Goal
Determine whether CoCo can fit the current facts model or whether the facts layer must change shape.

### Evidence
- `facts-node/server.ts`
- `facts-node/facts-db.json`
- `docs/CoCo-integration-context.md`

### Findings
- Current facts lookup is PCR-tuple-only and assumes one Nitro realization per row.
- The CoCo context requires one release with many accepted backend realizations.
- A side-by-side CoCo-only lookup path would preserve old schema locally but would weaken release-centered traceability and duplicate logic.

### Decision impact
- The CR must move facts from a Nitro-PCR row model toward a release-centered record with `accepted_realizations`.
- Nitro PCR identity remains a supported realization inside the new model.

## Experiment 3 — Operator workflow feasibility

### Goal
Check whether full-stack v1 CoCo scope can be localized into existing deployment/operator surfaces or would force a redesign.

### Evidence
- `src/ztdeploy/types.ts`
- `src/ztdeploy/adapters/awsCanonical.ts`
- `src/ztdeploy/app.tsx`
- `deploy/catalog.yml`
- `scripts/aws-cli/*`
- recently merged operator hardening now in `origin/main`

### Findings
- `ztdeploy` already has repo/method/action abstractions and is structurally capable of a second backend method.
- the former `origin/dev/nika` delta only added deployment hardening, not a different trust model, and is now part of `origin/main`.
- Current workflow semantics already distinguish `verify` and `deploy`, show stage logs, and manage deployments.
- Therefore AWS CoCo runtime/operator work can be modeled as a second method/backend lane rather than a separate product.

### Decision impact
- Full-stack v1 can stay localized if it targets only:
  - AWS
  - the canonical HTML service
  - one experimental CoCo backend lane
- The CR should not require generic multi-cloud control-plane design.

## Experiment 4 — CoCo identity and security boundary

### Goal
Choose a workload identity that is specific enough for browser-facing trust and consistent with CoCo guidance.

### Evidence
- `docs/CoCo-integration-context.md`
- official CoCo docs referenced there:
  - overview
  - Init-Data
  - attestation
  - policies
  - get-attestation
  - AWS Peer Pods example

### Findings
- Generic guest evidence is insufficient because different CoCo workloads may share the same TCB.
- The context explicitly warns about evidence-factory risk.
- The smallest workable v1 identity is:
  - immutable container image digest
  - measured Init-Data hash
- This is strong enough to differentiate the workload while avoiding over-coupling the CR to a large Trustee claims schema.

### Decision impact
- The CR locks CoCo realization identity to `image_digest + initdata_hash`.
- `workload_pubkey` may be carried as an optional claim, but it is not the required v1 matching key.

## Experiment 5 — Course-quality review

### Goal
Check whether the future CR artifact can satisfy the course methodology rather than becoming an isolated design memo.

### Evidence
- `docs/aiddev/evaluation_criteria.md`
- `docs/aiddev/prompts/artifact-quality-gate.md`
- `docs/aiddev/spec/*`
- `docs/aiddev/testing/*`

### Findings
- The current package has a real consistency problem: requirement/scenario/NFR notation is not perfectly aligned between `requirements.md`, `prd.json`, and `SPEC.csv`.
- That mismatch should not block the CR, but the CR must explicitly note the crosswalk so later test-update work does not guess.
- A CoCo CR that only talks about architecture would score poorly. The artifact must include:
  - affected feature/story/use-case IDs
  - new FR/NFR IDs
  - work plan changes
  - task breakdown changes
  - regression-sensitive zones
  - test handoff

### Decision impact
- The CR includes explicit ID additions and a handoff note requiring ID reconciliation before the test-update stage.

## Experiment 6 — Contract and ownership tightening pass

### Goal
Eliminate the remaining ambiguity that would make downstream test and implementation work rediscover or reinterpret the CR.

### Evidence
- `docs/aiddev/change-requests/changerequest-v1-coco-integration.md`
- `docs/aiddev/prompts/change-request-prompt.md`
- `docs/aiddev/prompts/artifact-quality-gate.md`

### Findings
- The first CR draft still had exact-contract naming drift:
  - `platform` vs `backend`
  - `lookup-realization` vs `POST /api/v1/lookup-by-realization`
- AWS CoCo runtime ownership was too loose; it was clear that an operator lane existed, but not clear which layer owned:
  - release lowering outputs
  - the public attestation wrapper
  - the local raw evidence fetch
  - deploy/verify lifecycle orchestration
- The crosswalk problem was acknowledged, but not resolved strongly enough inside the CR itself.

### Decision impact
- The final CR uses `platform` as the exact public contract field and realization discriminator.
- The final CR uses `POST /api/v1/lookup-by-realization` as the exact new lookup contract name.
- The final CR fixes the v1 AWS CoCo ownership split:
  - canonical release pipeline owns lowering outputs
  - the CoCo runtime wrapper owns translation from raw local CoCo evidence to the public common envelope
  - `scripts/aws-cli/*` and `src/ztdeploy/*` own lifecycle, verify, cleanup, and listing
- The final CR fixes the requirement-ID crosswalk inside the document:
  - canonical authority is declared
  - new NFRs are normalized to `NFR-008` through `NFR-013`
  - `SPEC.csv`/`SPEC.xlsx` are treated as mirrors, not downstream ID authorities

## Final experimental conclusion

The mature first CoCo CR is:
- additive, not a redesign
- AWS-only
- for the canonical HTML service
- release-centered in the facts layer
- based on one common outer attestation envelope
- implemented through backend-specific verifier plugins
- matched by `image_digest + initdata_hash` on the CoCo side
- wired into the existing operator workflow as an experimental AWS CoCo lane
- explicitly backward-compatible with the current Nitro baseline
