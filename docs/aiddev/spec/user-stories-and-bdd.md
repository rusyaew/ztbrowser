# User Stories and BDD Scenarios

## F001 Browser-visible verification

- **US-1** As a user, I want the extension to show a lock only when attestation is valid, so that I do not trust unverifiable services.
- **US-2** As a user, I want invalid attestation to remain unlocked with a visible reason, so that failures are diagnosable.

Scenarios:
- `SC001` valid attestation -> locked
- `SC002` invalid or malformed attestation -> unlocked with reason

## F002 Facts and provenance lookup

- **US-3** As a reviewer, I want verified realizations to resolve to workload metadata when available, so that I understand what was measured.
- **US-4** As a user, I want a facts miss to remain a metadata issue, not a cryptographic failure.

Scenarios:
- `SC003` facts match returns workload metadata
- `SC004` facts miss leaves verification result intact

## F003 Canonical enclave release provenance

- **US-5** As an operator, I want canonical release artifacts and a facts PR from tagged CI, so that runtime identity is auditable.
- **US-6** As a reviewer, I want rebuild verification, so that published measurements are reproducible.

Scenarios:
- `SC005` tagged release publishes EIF, measurements, provenance, and facts row update
- `SC006` rebuild verifier compares output against published provenance

## F004 Operator deployment workflow

- **US-7** As an operator, I want a verify flow that deploys, checks, and cleans up automatically.
- **US-8** As an operator, I want to inspect and manage live deployments from the TUI.

Scenarios:
- `SC007` verify action deploys, checks landing page and attestation, then cleans up
- `SC008` deployments view lists instances and lifecycle actions

## F005 Demo and self-signed application path

- **US-9** As a demo operator, I want a self-signed path that still exercises the browser verification flow.
- **US-10** As a presenter, I want canonical and demo keychains to stay visibly distinct.

Scenarios:
- `SC009` Micrus validates under demo trust root
- `SC010` popup distinguishes demo keychain from AWS Nitro keychain or equivalent current platform labeling

## F006 Multi-backend service realizations and AWS CoCo integration

- **US-11** As a reviewer, I want one attestation endpoint contract for Nitro and CoCo, so that browser entrypoints do not depend on backend-specific UX.
- **US-12** As a security engineer, I want CoCo evidence to prove a workload-specific identity rather than a generic guest, so that browser-visible trust is not vulnerable to interchangeable evidence.
- **US-13** As an operator, I want the canonical HTML service to lower into Nitro and AWS CoCo deployment inputs, so that I can deploy either realization from one release.
- **US-14** As an operator, I want an AWS-only experimental CoCo deploy/verify path, so that I can prove the backend actually works rather than only generating code or docs.
- **US-15** As an operator, I want the runtime and operator UI to reveal the backend realization in use, so that Nitro and CoCo runs are not confused.
- **US-16** As a reviewer, I want release-centered facts lookup across accepted realizations, so that one release can describe both Nitro and CoCo.

Scenarios:
- `SC011` common envelope verifies on Nitro and CoCo
- `SC012` CoCo evidence normalizes to `image_digest + initdata_hash`
- `SC013` release-centered facts lookup resolves Nitro and CoCo realizations
- `SC014` canonical release publishes Nitro and CoCo realization outputs
- `SC015` AWS CoCo deploy/verify happy path succeeds for the canonical HTML service
- `SC016` mixed Nitro and CoCo deployments show correct platform metadata
