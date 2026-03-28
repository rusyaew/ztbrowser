# Governance and Product Boundary

## Why this document exists

For ZTBrowser, pricing is inseparable from product boundary.
Before pricing anything, the project must decide what remains public-good infrastructure and what becomes productized.

## Recommended model

**Open core platform**

Keep the trust substrate and reference implementation open.
Monetize the operational and enterprise layers built around it.

## Terminology split

### Local policy evaluation
This means policy logic inside the extension or client runtime, such as allowlist-driven decisions, request blocking, and trust-root-based local enforcement.
This layer must remain open and inspectable because it directly affects the trust decision visible to the user.

### Organization policy control plane
This means centralized policy management for teams and enterprises.
This is a candidate commercial layer because it reduces organizational governance and rollout burden rather than replacing the inspectable verifier.

## Recommended public-good / open layers

- verifier logic and reference extension flow
- local policy evaluation in the client
- trust-root handling model
- facts / provenance schema
- canonical release manifest format
- reference demos and educational materials
- interoperability with open confidential-computing ecosystems such as CoCo

## Recommended monetizable layers to investigate

- hosted provenance / facts with SLAs and audit features
- managed deploy and operator control plane
- organization policy control plane, including:
  - organization-level policy management
  - managed rule distribution
  - central policy administration
  - audit logs and policy history
  - team/tenant controls
  - signed policy bundles pushed to many clients
  - enterprise exceptions / approvals / rollout controls
- enterprise integrations and support
- compliance and attestation reporting
- multi-provider CoCo-based orchestration when it exists

## Why not a pure foundation-only posture today

A foundation or nonprofit model is plausible for parts of the stack, but the repo today already contains operator and deployment ergonomics that naturally point toward a productized platform layer.

## Why not a fully closed commercial posture

Closing the verifier, local policy evaluation, protocol, or provenance format would damage the project’s trust story.
Open verification and open evidence formats are part of the product’s credibility.

## Current decision

For the course package, position ZTBrowser as:
- open verifier, local policy evaluation, and provenance substrate
- productizable operator, organization-policy, and compliance layer on top
- compatible with future public-interest governance or ecosystem collaboration if the project grows in that direction
