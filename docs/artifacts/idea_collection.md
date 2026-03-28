# Lesson 1 Idea Collection

This artifact gives paste-ready responses for the Lesson 1 idea-submission form and the extended Product Idea Canvas.
The wording is intentionally simpler than the later AIDev business docs.
It frames ZTBrowser as an early-stage product focused on browser-visible proof of enclave-backed web services.

## Recommended short submission

### 1. Target user
Platform and security engineers building web services that process sensitive data and need to prove trusted execution to users, partners, or auditors.

### 2. Problem description
Today, confidential-computing and attestation evidence is mostly backend-facing. From the browser, users cannot easily verify whether a site handling sensitive data is really running in the trusted environment it claims.

### 3. Proposed solution
ZTBrowser verifies attestation in the browser, links the verified runtime identity to public release and provenance metadata, and helps teams deploy and demonstrate attested services.

### 4. Expected outcome for the user
Users can decide whether to trust a service before sending sensitive data, and teams can prove what is actually running instead of relying on screenshots, promises, or backend-only evidence.

### One-sentence answer
ZTBrowser helps platform and security teams prove, in the browser, that a sensitive web service is really running as an attested enclave-backed workload, so users can trust it before sending data.

## Product Idea Canvas

### 1. Client (Ideal Customer Profile - ICP)
Platform and security engineers building web services that process sensitive data and need to prove trusted execution to users, partners, or auditors.

### 2. Problem (What pain point are you solving for the ICP?)
Attestation systems usually prove execution properties only to infrastructure operators. From the browser, users and reviewers cannot easily tell whether a service handling sensitive data is really running in the trusted environment it claims.

### 3. Solution (How does your product solve the problem?)
ZTBrowser verifies attestation in the browser, maps the verified runtime identity to public provenance and release metadata, and gives teams a repeatable way to deploy and demonstrate attested services.

### 4. Key Metrics (How will you measure success and growth?)
- successful browser verifications
- facts/provenance match rate
- time from release to verified deployment
- number of teams running deploy/verify flows

### 5. Alternatives (What are the current competing solutions/workarounds?)
- manual trust claims on websites
- backend-only attestation dashboards
- custom internal scripts
- vendor confidential-computing platforms without browser-visible trust UX

### 6. Value Proposition (What single, compelling statement describes the benefit you deliver?)
ZTBrowser lets teams prove in the browser that a sensitive web service is running as the attested release they intended, before users submit secrets or private data.

### 7. Segments (List the different market segments you will target)
- platform engineering teams
- security and compliance teams
- privacy-sensitive application teams
- confidential-computing early adopters

### 8. Channels (How will you reach your customers and deliver the solution?)
- GitHub and open-source distribution
- technical demos and presentations
- security and confidential-computing communities
- direct outreach to platform and security teams

### 9. Business Model (How will you generate revenue?)
Open-core model: the verifier and provenance substrate stay open, while future revenue can come from hosted operator, organization-policy, and compliance layers.

## Notes on positioning

For Lesson 1, the product is intentionally framed narrowly around browser-visible proof of enclave-backed web services.
Later course artifacts expand this into the broader developer trust platform narrative.

## What not to write in the form

- do not claim multi-cloud support today
- do not claim CoCo integration today
- do not claim FHE support today
- do not say facts metadata is the trust root
- do not overcomplicate the first form with the full control-plane story
