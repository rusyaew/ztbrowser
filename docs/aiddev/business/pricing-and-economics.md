# Pricing and Economics

## Pricing status

Pricing is not mature enough to be presented as settled truth.
The correct output for this course is a disciplined pricing hypothesis, not a fake price list.

## Adjacent-market observation

In confidential computing and security infrastructure, the public-good layer is often open or standards-driven, while revenue is captured in:
- managed control planes
- policy and orchestration
- enterprise support
- integrations
- compliance reporting

ZTBrowser already has the beginnings of that commercial surface in the merged repo: operator deployment automation, deployment lifecycle controls, and a browser-visible verification layer. The monetization question is therefore not whether there is any operational surface at all, but which parts should remain open and which parts should become hosted or enterprise offerings.

## Recommended pricing hypothesis

### Core open product
Free and open:
- verifier and browser-side trust flow
- local policy evaluation in the client
- facts/provenance schema
- reference demos and documentation
- canonical release discipline for the reference workload

### Commercial layer hypotheses

#### Option A — Team platform subscription + usage
- flat team/platform fee
- usage metric tied to managed deployments, verified origins, or services governed by organization policy bundles

#### Option B — Enterprise support + compliance
- implementation support
- audit/reporting packages
- custom integrations
- private facts/provenance services

#### Option C — Hosted operator and organization policy control plane
- deployment management
- organization-level policy management
- managed rule distribution
- central policy administration
- audit logs and policy history
- team/tenant controls
- signed policy bundles pushed to many clients
- enterprise exceptions / approvals / rollout controls
- secret and attestation workflow integrations
- multi-provider routing in the future

## Things that may remain free or ecosystem-funded

- public reference facts nodes
- public schema definitions
- reference rebuild verification tooling
- interoperability work around CoCo or shared attestation formats

## Economic questions that still require discovery

- who actually pays first: platform engineering, security, compliance, or the application team?
- is the first real budget attached to deployment operations, compliance, or end-user trust UX?
- should hosted facts be a product, a freemium service, or a public-good layer?
- does the strongest willingness to pay appear before or after CoCo/multi-provider support exists?

## Course-safe conclusion

For this repo stage, present pricing as:
- open core
- commercial operator, organization-policy, and compliance layers under investigation
- customer discovery required before publishing numbers
