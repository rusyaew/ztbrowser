# AIDev Course Artifact Index

This subtree packages ZTBrowser into the artifact chain expected by the AI-Driven Product Development course.

## Scope and rules

- This is a course-facing artifact layer, not a replacement architecture.
- `origin/main` is the merged baseline for implementation truth.
- `origin/main` already includes the AWS CLI deployment automation under `scripts/aws-cli/` and the `ztdeploy` operator TUI under `src/ztdeploy/`.
- `rusyaew/ztinfra-enclaveproducedhtml` is the canonical measured enclave source and release authority.
- CoCo, multi-cloud support, and FHE-oriented trust/compute integration are roadmap topics, not present features.

## Suggested reading order

1. [evidence/repo-baseline.md](evidence/repo-baseline.md)
2. [product/positioning.md](product/positioning.md)
3. [spec/spec.md](spec/spec.md)
4. [testing/test-strategy.md](testing/test-strategy.md)
5. [ops/ci-cd.md](ops/ci-cd.md)
6. [business/governance-and-product-boundary.md](business/governance-and-product-boundary.md)
7. [business/pitch-outline.md](business/pitch-outline.md)

## Directory map

- `evidence/`: what already exists and how the course maps onto the repo
- `product/`: framing, users, market, validation story
- `spec/`: PRD, user stories, requirements, analytics events
- `testing/`: strategy, test catalog, traceability, gaps
- `ops/`: deployment, CI/CD, monitoring, dashboard spec, PMF metrics
- `plan/`: work plan and task breakdown
- `business/`: governance, monetization, pricing, pitch, roadmap

## Important labels

- **Merged truth**: already in `origin/main`
- **External canonical**: lives in `ztinfra-enclaveproducedhtml` and defines the measured workload release boundary
- **Local draft**: useful evidence in a dirty or unmerged worktree, but not part of the current merged baseline
