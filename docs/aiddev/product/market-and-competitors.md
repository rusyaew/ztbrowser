# Market and Competitors

## Framing

ZTBrowser sits at the intersection of:
- confidential computing and attestation
- provenance / release transparency
- browser-visible security UX
- operator tooling for attested delivery

## Adjacent categories

### 1. Confidential-computing platforms
Examples:
- Fortanix
- Anjuna
- Google Confidential Space and attestation tooling

These systems typically monetize secure execution, policy, orchestration, secrets, and enterprise integrations.
They usually do **not** focus on browser-visible verification as the primary user experience.

### 2. Open confidential-computing infrastructure
Examples:
- Confidential Containers (CoCo)

This layer behaves more like ecosystem infrastructure or a public-good standardization area than a product on its own.
Open projects here enable vendors and downstream platforms rather than acting as the complete end product.

### 3. Provenance and transparency systems
These systems connect build/release identity to deployed artifacts.
ZTBrowser’s facts and release-provenance layer overlaps here, but it adds a browser-verification dimension.

### 4. Application-facing trust UX
Micrus demonstrates this direction: use attestation verification to gate sensitive actions in a user-facing application.

## Competitive differentiation

ZTBrowser differentiates on the combination of:
- browser-visible attestation verification
- public provenance mapping from PCRs to released workload identity
- canonical release discipline through a measured enclave repo
- operator UX for deploy/verify flow

## Likely competitive position

ZTBrowser is best positioned as:
- a trust UX and provenance layer for attested services
- not a replacement for the underlying confidential-computing provider
- not a generic browser security extension for arbitrary websites

## Strategic references

- Confidential Containers: https://confidentialcontainers.org/
- OpenTelemetry JavaScript docs: https://opentelemetry.io/docs/languages/js/
- Fortanix: https://www.fortanix.com/
- Anjuna: https://www.anjuna.io/
- Google Confidential Computing overview: https://cloud.google.com/confidential-computing
