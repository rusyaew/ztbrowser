# Users, JTBD, Problem, Solution

## Primary user

### Platform or security engineer
Job to be done:
- ship a confidential or enclave-backed service and prove its execution identity to external users, auditors, or partner teams

Pain:
- attestation is difficult to surface in a user-friendly way
- raw PCRs and attestations are hard to interpret
- deployment and provenance discipline are often ad hoc

Moment of value:
- the service is live, the browser can verify it, and the user sees a meaningful trust signal tied to a released workload identity

## Secondary user

### Security / compliance stakeholder
Job to be done:
- validate that a deployed service corresponds to a released and auditable workload identity

Pain:
- backend attestation evidence is usually too opaque for quick review
- provenance and release data are often disconnected from runtime proof

## Tertiary user

### Application team experimenting with attestation-gated workflows
Job to be done:
- use browser-visible verification as a gate before sensitive actions such as login, password submission, or secret handling

Pain:
- difficult to prototype without rebuilding large infrastructure stacks
- need a demo path before a production enclave path is ready

## Problem statement

Attestation systems prove execution properties to infrastructure operators, but they rarely produce a trustworthy, browser-visible signal that links runtime proof to a public workload identity.

## Solution statement

ZTBrowser verifies attestation documents in the browser runtime, enriches them with public provenance data, and provides both canonical and demo deployment paths so teams can move from education and iteration toward real enclave-backed delivery.
