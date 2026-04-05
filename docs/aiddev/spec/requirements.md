# Requirements

## Functional requirements

### F001 Browser-visible verification
- `FR-001` The extension shall fetch attestation from `/.well-known/attestation` on the current origin.
- `FR-002` The extension shall verify attestation cryptographically before showing a lock.
- `FR-003` The extension shall store failure reasons and debug steps for inspection.

### F002 Facts and provenance lookup
- `FR-004` The extension shall query facts by verified realization identity.
- `FR-005` Facts lookup shall expose workload and release metadata when a matching row exists.
- `FR-006` A facts miss shall not negate a successful cryptographic verdict.

### F003 Canonical release provenance
- `FR-007` Canonical enclave releases shall publish EIF, measurements, provenance manifest, checksums, and realization metadata.
- `FR-008` Canonical facts updates shall be produced from release CI output.
- `FR-009` The system shall support rebuild verification against published provenance.

### F004 Operator deployment workflow
- `FR-010` Operators shall be able to deploy and verify a canonical release via scriptable AWS automation for Nitro and AWS CoCo realizations.
- `FR-011` The operator UI shall show stage-level progress and live logs.
- `FR-012` The operator UI shall expose deployment list and lifecycle actions.

### F005 Demo and self-signed path
- `FR-013` Demo services shall expose the same attestation endpoint shape as the canonical path.
- `FR-014` The verifier shall support different trusted roots without changing protocol shape.
- `FR-015` The popup shall distinguish demo and canonical trust roots or equivalent platform labeling as implemented.

### F006 Multi-backend service realizations and AWS CoCo integration
- `FR-016` The system shall support a versioned common attestation envelope with a public `platform` field.
- `FR-017` The verifier shall dispatch to backend-specific verification logic based on the public platform field.
- `FR-018` The verifier shall normalize backend-specific evidence into a single browser-visible result shape.
- `FR-019` Facts lookup shall support release-centered accepted realizations in addition to the legacy Nitro compatibility path.
- `FR-020` AWS CoCo realizations shall normalize to `image_digest + initdata_hash` identity.
- `FR-021` The canonical enclave release workflow shall lower one release into Nitro and AWS CoCo realization outputs.
- `FR-022` The AWS CoCo runtime shall expose the common envelope on the attestation endpoint.
- `FR-023` The operator workflow shall support deploy/verify for the AWS CoCo realization.
- `FR-024` The operator UI shall expose backend realization and lifecycle metadata for Nitro and AWS CoCo runs.
- `FR-025` Nitro behavior shall remain backward compatible while CoCo is added.

## Non-functional requirements

- `NFR-001` Verification logic shall not run in the untrusted page context.
- `NFR-002` Failure states shall be understandable from popup/debug output.
- `NFR-003` Facts shall be treated as metadata, not root-of-trust material.
- `NFR-004` Canonical provenance shall be reproducible and auditable.
- `NFR-005` Deployment automation shall minimize accidental cloud cost.
- `NFR-006` Demo paths shall remain clearly labeled as noncanonical.
- `NFR-007` Course artifacts shall not require architectural rewrites just to match the class template.
- `NFR-008` Common-envelope and realization identity changes shall remain versioned and extensible.
- `NFR-009` AWS CoCo evidence shall remain workload-specific and must not rely on generic guest evidence.
- `NFR-010` Facts shall remain metadata even when multiple accepted realizations exist for a release.
- `NFR-011` AWS CoCo operator support shall remain explicitly experimental in the current product scope.
- `NFR-012` The new CoCo path shall not silently replace or regress Nitro verification semantics.
- `NFR-013` Release and operator metadata shall preserve traceability across Nitro and AWS CoCo realizations.
