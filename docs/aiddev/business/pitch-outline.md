# Pitch Outline

## 1. Problem

Attestation systems prove execution properties to infrastructure operators, but they rarely create a trustworthy, browser-visible signal that normal users, partner teams, or auditors can inspect.

## 2. Solution

ZTBrowser verifies attestation in the browser, links runtime measurement to public workload provenance, and supports repeatable deployment of attested services.

## 3. Why now

- confidential computing is becoming more relevant
- AI/privacy-sensitive workflows need stronger runtime trust narratives
- browser-visible trust is still underbuilt relative to backend attestation stacks

## 4. Product

- extension verifier
- facts/provenance layer
- canonical enclave release discipline
- AWS Nitro deploy path
- operator-driven AWS deployment automation via CLI and TUI
- demo app path through Micrus

## 5. Market

Target buyer/user cluster:
- platform engineering
- security engineering
- compliance / audit stakeholders in privacy-sensitive systems

## 6. Differentiation

ZTBrowser is not only infrastructure and not only UX.
Its differentiation is the bridge between attested runtime proof and browser-visible trust/provenance.

## 7. Business model

Recommended framing:
- open verifier, local policy evaluation, and provenance substrate
- monetizable hosted operator, organization-policy, and compliance layers

## 8. Roadmap

Near-term:
- harden current AWS Nitro path and operator tooling
- improve extension UX
- harden facts and local policy evaluation layers

Mid-term:
- CoCo / multi-provider portability
- promote Micrus-style app flows into stronger release discipline
- define the first version of the organization policy control plane

Long-term:
- organization policy control plane maturation
- privacy-preserving compute expansion including FHE-adjacent integrations
