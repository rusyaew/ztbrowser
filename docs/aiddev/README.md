# AIDev Course Artifact Index

This subtree packages ZTBrowser into the artifact chain expected by the AI-Driven Product Development course.

## Scope and rules

- This is a course-facing artifact layer, not a replacement architecture.
- `origin/main` is the merged baseline for implementation truth.
- `origin/main` already includes the AWS CLI deployment automation under `scripts/aws-cli/` and the `ztdeploy` operator TUI under `src/ztdeploy/`.
- `rusyaew/ztinfra-enclaveproducedhtml` is the canonical measured enclave source and release authority.
- AWS-only CoCo v1 is present in merged mainline; multi-cloud support and FHE-oriented trust/compute integration remain roadmap topics.

## Artifact production rule

- Every artifact must be judged against [evaluation_criteria.md](evaluation_criteria.md) before finalization.
- Weak, shallow, or inconsistent drafts should be regenerated before they are accepted into the package.
- Prompt artifacts under `prompts/` are expected to enforce this rule explicitly.
- The shared preflight gate lives in [prompts/artifact-quality-gate.md](prompts/artifact-quality-gate.md).

## Suggested reading order

0. [evaluation_criteria.md](evaluation_criteria.md)
1. [evidence/repo-baseline.md](evidence/repo-baseline.md)
2. [evidence/analysed-v1.md](evidence/analysed-v1.md)
3. [evidence/current-validation.md](evidence/current-validation.md)
4. [product/positioning.md](product/positioning.md)
5. [spec/spec.md](spec/spec.md)
6. [testing/test-strategy.md](testing/test-strategy.md)
7. [ops/ci-cd.md](ops/ci-cd.md)
8. [business/governance-and-product-boundary.md](business/governance-and-product-boundary.md)
9. [business/pitch-outline.md](business/pitch-outline.md)
10. [prompts/artifact-quality-gate.md](prompts/artifact-quality-gate.md)
11. [prompts/repository-analyser-prompt.md](prompts/repository-analyser-prompt.md)
12. [prompts/change-request-prompt.md](prompts/change-request-prompt.md)
13. [prompts/test-update-prompt.md](prompts/test-update-prompt.md)
14. [prompts/development-prompt.md](prompts/development-prompt.md)
15. [change-requests/changerequest-v1-coco-integration.md](change-requests/changerequest-v1-coco-integration.md)
16. [evidence/coco-testupdate-experiments-v1.md](evidence/coco-testupdate-experiments-v1.md)
17. [test-updates/test-update-after-changerequest-v1-coco-integration.md](test-updates/test-update-after-changerequest-v1-coco-integration.md)
18. [evidence/coco-development-experiments-v1.md](evidence/coco-development-experiments-v1.md)
19. [development-plans/development-plan-v1-coco-integration.md](development-plans/development-plan-v1-coco-integration.md)

## Directory map

- `evidence/`: baseline, branch-aware repository analysis, and course-to-repo mapping
- `product/`: framing, users, market, validation story
- `spec/`: PRD, user stories, requirements, analytics events
- `testing/`: strategy, test catalog, traceability, gaps
- `ops/`: deployment, CI/CD, monitoring, dashboard spec, PMF metrics
- `plan/`: work plan and task breakdown
- `prompts/`: reusable prompt templates for repository analysis and later CR/test/code/development stages
- `business/`: governance, monetization, pricing, pitch, roadmap
- `change-requests/`: localized brownfield CR patches for approved product changes
- `test-updates/`: localized brownfield testing patches derived from approved CRs
- `development-plans/`: implementation-ready packages derived from approved CRs and test updates

## Important labels

- **Merged truth**: already in `origin/main`
- **External canonical**: lives in `ztinfra-enclaveproducedhtml` and defines the measured workload release boundary
- **Local draft**: useful evidence in a dirty or unmerged worktree, but not part of the current merged baseline
