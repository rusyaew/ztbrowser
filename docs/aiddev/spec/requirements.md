# Requirements

## Functional requirements

### F001 Browser-visible verification
- `FR-001` The extension shall fetch attestation from `/.well-known/attestation` on the current origin.
- `FR-002` The extension shall verify attestation cryptographically before showing a lock.
- `FR-003` The extension shall store failure reasons and debug steps for inspection.

### F002 Facts and provenance lookup
- `FR-004` The extension shall query facts by verified PCR tuple.
- `FR-005` Facts lookup shall expose workload metadata when a matching row exists.
- `FR-006` A facts miss shall not negate a successful cryptographic verdict.

### F003 Canonical release provenance
- `FR-007` Canonical enclave releases shall publish EIF, measurements, provenance manifest, and checksums.
- `FR-008` Canonical facts updates shall be produced from release CI output.
- `FR-009` The system shall support rebuild verification against published provenance.

### F004 Operator deployment workflow
- `FR-010` Operators shall be able to deploy and verify a canonical release via scriptable AWS automation.
- `FR-011` The operator UI shall show stage-level progress and live logs.
- `FR-012` The operator UI shall expose deployment list and lifecycle actions.

### F005 Demo and self-signed path
- `FR-013` Demo services shall expose the same attestation endpoint shape as the canonical path.
- `FR-014` The verifier shall support different trusted roots without changing protocol shape.
- `FR-015` The popup shall distinguish demo and canonical trust roots.

## Non-functional requirements

- `NFR-001` Verification logic shall not run in the untrusted page context.
- `NFR-002` Failure states shall be understandable from popup/debug output.
- `NFR-003` Facts shall be treated as metadata, not root-of-trust material.
- `NFR-004` Canonical provenance shall be reproducible and auditable.
- `NFR-005` Deployment automation shall minimize accidental cloud cost.
- `NFR-006` Demo paths shall remain clearly labeled as noncanonical.
- `NFR-007` Course artifacts shall not require architectural rewrites just to match the class template.
