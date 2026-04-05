# Product Specification

## Product context

ZTBrowser is a developer trust platform for attested web services. Its primary value is to make runtime attestation visible and interpretable in the browser while preserving a clear distinction between cryptographic verification and public provenance metadata.

## In scope

- browser-side attestation verification
- facts and provenance lookup by verified realizations
- canonical enclave release and rebuild discipline
- repeatable AWS Nitro deployment and operator tooling
- AWS-only CoCo v1 for the canonical service release
- noncanonical demo/application path for learning and product exploration

## Out of scope for this specification

- multi-cloud deployment portability beyond AWS in v1
- FHE execution or Cornami-style services
- a production commercial control plane

## Current architectural split

- browser extension: user-facing trust decision and UX
- facts node: public metadata lookup by realized workload identity
- canonical enclave repo: measured workload source and release artifacts
- integration repo: operator tooling, parent proxy, verifier, demos, and AWS CoCo operator lane

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
- F006: Multi-backend service realizations and AWS CoCo integration
