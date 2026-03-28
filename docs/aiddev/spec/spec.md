# Product Specification

## Product context

ZTBrowser is a developer trust platform for attested web services. Its primary value is to make runtime attestation visible and interpretable in the browser.

## In scope

- browser-side attestation verification
- facts/provenance lookup by verified PCRs
- canonical enclave release and rebuild discipline
- repeatable AWS Nitro deployment and operator tooling
- noncanonical demo/application path for learning and product exploration

## Out of scope for this specification

- CoCo integration
- multi-cloud deployment portability
- FHE execution or Cornami-style services
- a production commercial control plane

## Current architectural split

- browser extension: user-facing trust decision and UX
- facts node: public metadata lookup by PCR tuple
- canonical enclave repo: measured workload source and release artifacts
- integration repo: operator tooling, parent proxy, verifier, demos

## Current truth labels used in this package

- **Merged truth**: already on `origin/main`
- **External canonical**: lives in `ztinfra-enclaveproducedhtml`
- **Local draft**: useful but not part of the current merged baseline

## Core features

- F001: Browser-visible attestation verification
- F002: Facts and provenance lookup
- F003: Canonical enclave release provenance
- F004: Operator deployment workflow
- F005: Demo and self-signed application path
