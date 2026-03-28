# Monetization Options Decision Log

## Option 1 — Foundation / common-good first

### Description
Run the core as public-interest infrastructure and fund it through grants, memberships, donations, or sponsored ecosystem work.

### Pros
- strongest trust/public-good narrative
- compatible with standards and ecosystem collaboration

### Cons
- weak near-term product ownership and budget clarity
- harder to align with operator tooling already emerging in the repo

## Option 2 — Foundation + services

### Description
Keep the core open and mission-driven, but monetize support, integration, audits, and consulting.

### Pros
- preserves trust and openness
- fits early-stage service revenue

### Cons
- can stall productization
- may under-monetize the real operator/control-plane value

## Option 3 — Open core platform (recommended)

### Description
Keep verifier, protocol, provenance, and local policy evaluation substrate open, and monetize hosted operator, organization-policy, and compliance layers.

### Pros
- fits current repo strengths
- preserves trust story
- creates a credible future business model
- aligns with likely monetization in adjacent confidential-computing products

### Cons
- boundary must be managed carefully to avoid eroding the public-trust layer

## Decision

Recommended for the course artifacts:
- **Option 3: Open core platform**

## Boundary rule of thumb

If a component must be inspectable to preserve trust, it should default toward open.
If a component mostly reduces operational complexity, governance burden, or enterprise integration cost, it is a candidate for monetization.

Applied to policy:
- local policy evaluation stays open
- centralized organization policy management and distribution is the monetization candidate
