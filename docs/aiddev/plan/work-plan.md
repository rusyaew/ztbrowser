# Work Plan

## Purpose

This work plan converts the current ZTBrowser course package into concrete execution streams without redesigning the product.

## Workstream 1 — Core spec and traceability

- lock the course-compatible `prd.json` and `SPEC.csv`
- keep `requirements.md`, `user-stories-and-bdd.md`, and `traceability-matrix.md` aligned
- avoid duplicate truth sources

Definition of done:
- canonical IDs are stable
- `SPEC.csv` and `prd.json` describe the same product behaviors

## Workstream 2 — Verification and provenance

- package browser verification and facts semantics cleanly
- package canonical enclave release, provenance, and rebuild verification
- keep facts as transparency metadata rather than root-of-trust material

Definition of done:
- a reviewer can follow the path from runtime verification to release provenance

## Workstream 3 — Deployment and operations

- present the three-lane delivery model clearly
- document the merged AWS CLI + `ztdeploy` operator workflow
- define monitoring and dashboard expectations without fabricating production screenshots

Definition of done:
- the deployment and monitoring story is technically honest and presentation-ready

## Workstream 4 — Product, business, and roadmap

- keep the product framing consistent with repo reality
- define governance and monetization boundaries clearly
- preserve open verifier/local policy evaluation while framing the organization policy control plane as a possible hosted layer

Definition of done:
- pricing, pitch, roadmap, and governance docs do not contradict the technical architecture

## Recommended execution order

1. Finalize spec compatibility artifacts: `prd.json`, `SPEC.csv`
2. Finalize testing and traceability consistency
3. Finalize deployment/monitoring/dashboard artifacts
4. Finalize pricing, pitch, and roadmap consistency
