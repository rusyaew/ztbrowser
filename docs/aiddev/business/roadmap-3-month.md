# 3-Month Roadmap

## Month 1 — Hardening and course-complete product packaging

- finalize course artifact set in `docs/aiddev`
- improve extension UX around neutral/no-attestation states
- keep canonical AWS Nitro path presentation-ready
- stabilize facts-node behavior and transparency semantics
- package current demos and operator flow cleanly

## Month 2 — Product and local policy strengthening

- expand client-side policy evaluation around private endpoint allowlists
- improve form-highlighting and action-gating UX
- investigate how facts and local policy evaluation should move closer to the trusted boundary
- add focused tests around deployment and facts semantics

## Month 3 — Portability and productization

- investigate CoCo-based portability for non-AWS environments
- define what multi-provider deployment abstraction should look like
- decide which operator, organization-policy, and provenance layers become the first monetizable surface
- define the first organization policy control plane scope:
  - organization-level policy management
  - managed rule distribution
  - central policy administration
  - audit logs and policy history
  - team/tenant controls
  - signed policy bundles pushed to many clients
  - enterprise exceptions / approvals / rollout controls
- evaluate how Micrus can be promoted into canonical release discipline
- define whether FHE-adjacent integrations belong in the next roadmap or a later research track
