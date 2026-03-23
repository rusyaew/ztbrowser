# ZTBrowser AWS Nitro Enclave Architecture — 10 Slide Deck Script

Use this as source text for an AI presentation and diagram generator.

This version reflects the current architecture, not the earlier SGX/demo-only MVP.

---

## Slide 1 — Title and System Goal

**Slide title:**
ZTBrowser: Browser Verification for an AWS Nitro Enclave-Backed Website

**On-slide text:**
- Goal: let a browser verify that a website is backed by a measured Nitro enclave before presenting a trust signal.
- Current deployment claim:
  - `GET /` is generated inside the enclave
  - `POST /.well-known/attestation` returns a real AWS-root-verifiable attestation doc
- Trust is split into:
  - cryptographic verification
  - public metadata lookup

**Diagram prompt for generator:**
Create a modern title slide with a single high-level architecture ribbon across the middle. Show five labeled blocks from left to right:
1) User Browser
2) Chrome Extension
3) AWS Parent Proxy
4) Nitro Enclave
5) Local Checker + Hosted Facts DB
Use blue arrows for runtime traffic and orange arrows for trust/reference lookups. Add a subtitle callout: “Lock shown only after attestation verification”.

**Speaker notes:**
The purpose of the system is not just to show that a server claims to use trusted execution, but to let the browser independently verify that claim. The system combines a real AWS Nitro attestation document, a local verifier trusted by the user, and a facts database that maps measurements to human-auditable metadata.

---

## Slide 2 — System Components and Responsibilities

**Slide title:**
Component Map: Who Does What

**On-slide text:**
- **Browser page**: loads normal website content
- **Extension**: orchestrates attestation fetch, checker call, facts lookup, lock state
- **Parent proxy**: public HTTP server on EC2, forwards requests into enclave over `vsock`
- **Enclave server**: generates landing-page HTML and requests real NSM attestation docs
- **Clientside checker**: validates COSE signature, chain, trusted root, nonce, PCR extraction
- **Facts DB**: maps PCR tuple to repo and image metadata

**Diagram prompt for generator:**
Draw a component inventory diagram with six rounded rectangles arranged in two rows. Top row: Browser page, Extension, Local Checker. Bottom row: AWS Parent Proxy, Nitro Enclave, Facts DB. Add short one-line responsibility text under each label. Show that the extension talks to both the parent proxy and the checker, and separately to facts DB.

**Speaker notes:**
The key separation is that the public site and the cryptographic verifier are not the same thing. The site can be remote and hostile. The checker is local and trusted by the user. Facts DB is public and useful, but not treated as a cryptographic root of trust.

---

## Slide 3 — End-to-End Runtime Flow

**Slide title:**
End-to-End Request Flow

**On-slide text:**
1. User opens the website
2. Browser receives enclave-generated landing page via parent proxy
3. Extension sends nonce challenge to `/.well-known/attestation`
4. Parent proxy forwards nonce to enclave via `vsock`
5. Enclave asks NSM for a real attestation document
6. Extension sends nonce + attestation doc to local checker
7. Extension queries facts DB by verified PCRs
8. Extension shows lock or unlock

**Diagram prompt for generator:**
Create a detailed sequence diagram with actors:
- User
- Browser Page
- Extension
- Parent Proxy
- Nitro Enclave
- NSM
- Local Checker
- Hosted Facts DB
Show exact order of interactions. Mark the `vsock` hop between parent proxy and enclave clearly. Highlight the checker as the cryptographic decision point.

**Speaker notes:**
This slide should make clear that the extension performs two logically separate follow-up actions after fetching attestation: first cryptographic verification through the checker, then metadata lookup through facts DB. The lock depends on the first. The second is for transparency and context.

---

## Slide 4 — Parent Proxy and Enclave Boundary

**Slide title:**
Public HTTP Outside, Sensitive Logic Inside

**On-slide text:**
- Public internet traffic terminates at the EC2 parent instance
- Parent proxy exposes:
  - `GET /`
  - `POST /.well-known/attestation`
- Parent proxy does not create attestation itself
- Nitro enclave performs:
  - landing-page HTML generation
  - NSM attestation request
- Parent and enclave communicate only over `vsock`

**Diagram prompt for generator:**
Create a boundary diagram with a large outer box labeled “EC2 Parent Instance” and a smaller sealed box inside labeled “Nitro Enclave”. Put the HTTP listener in the outer box and the HTML generator + attestation worker in the inner box. Show `vsock` as the only communication path between them. Add an external internet cloud pointing only to the parent proxy, not the enclave.

**Speaker notes:**
This is the core AWS Nitro architectural constraint. The enclave has no direct external networking. That forces the parent to act as a transport bridge. The design goal is to keep the parent as thin as possible and move meaningful content generation plus attestation issuance into the enclave.

---

## Slide 5 — Real Nitro Attestation Protocol

**Slide title:**
What the Checker Actually Verifies

**On-slide text:**
- Attestation endpoint request:
  - `{ "NONCE": "<hex>" }`
- Attestation response includes:
  - `platform`
  - `nonce`
  - `workload.eif_pcrs`
  - `evidence.nitro_attestation_doc_b64`
- Checker verifies:
  - COSE signature integrity
  - certificate chain
  - trusted root fingerprint
  - nonce equality
  - PCR extraction from signed payload

**Diagram prompt for generator:**
Create a protocol diagram with two stacked panels:
Top panel shows the outer JSON request and response.
Bottom panel zooms into the attestation doc as a COSE_Sign1 envelope containing payload, certificate chain material, nonce, PCRs, module ID, and timestamp.
Highlight that the signed document, not the outer JSON wrapper, is the real trust anchor.

**Speaker notes:**
The outer JSON is only a transport envelope. The cryptographic object that matters is the signed Nitro attestation document. The checker validates that document against the AWS root and then extracts the PCR tuple that represents the enclave identity.

---

## Slide 6 — PCR Identity and Facts DB

**Slide title:**
Measured Identity vs Public Metadata

**On-slide text:**
- PCRs are the measured identity of the enclave build
- Facts DB stores:
  - `workload_id`
  - `repo_url`
  - `oci_image_digest`
  - `pcr0`, `pcr1`, `pcr2`, `pcr8`
  - operational metadata
- Extension queries facts DB using checker-verified PCRs
- Facts DB explains what was measured, but does not prove authenticity

**Diagram prompt for generator:**
Create a split comparison diagram:
Left side “Cryptographic Identity” with PCR0/1/2/8 flowing out of the checker.
Right side “Transparency Metadata” with a facts table showing repo URL, image digest, workload ID, timestamps.
Connect them with a labeled arrow: “lookup by PCR tuple”.

**Speaker notes:**
This distinction is important. The checker answers “is this attestation authentic and fresh?” Facts DB answers “which source repo and image metadata correspond to this measurement?” Those are different questions and should stay separated in the architecture.

---

## Slide 7 — Extension Architecture and UX Logic

**Slide title:**
How the Extension Produces the Lock Signal

**On-slide text:**
- Content script starts validation on page load
- Background worker performs cross-origin fetches
- Local checker runs at `http://localhost:3000/verify`
- Facts DB is currently hosted remotely
- Extension stores:
  - `workingEnv`
  - `codeValidated`
  - `reason`
  - `verifiedPcrs`
  - facts metadata
- Lock rule:
  - locked when `workingEnv && codeValidated`

**Diagram prompt for generator:**
Create a browser-extension internal architecture diagram with three blocks:
1) Content Script
2) Background Service Worker
3) Popup UI
Show the content script triggering validation, the background service worker making network requests to remote site, local checker, and hosted facts DB, and the popup reading state from extension storage. Use a separate storage cylinder labeled `chrome.storage.local`.

**Speaker notes:**
The background service worker matters because it avoids fragile networking behavior from a content script running inside an arbitrary remote page. The popup is only a renderer of state; it is not part of the trust computation path.

---

## Slide 8 — Decision Logic and Failure Modes

**Slide title:**
From Attestation Bytes to Locked or Unlocked

**On-slide text:**
- `workingEnv = nonce matches`
- `codeValidated = signature + chain + trusted root + valid doc`
- Facts result is a metadata enrichment step
- Typical failure reasons:
  - `invalid_doc`
  - `invalid_signature`
  - `invalid_chain`
  - `nonce_mismatch`
  - `unsupported_platform`
  - network fetch failure

**Diagram prompt for generator:**
Create a verification pipeline with numbered gates. Each gate is a decision box:
1) fetch attestation
2) parse outer response
3) verify COSE signature
4) verify certificate chain
5) check trusted root
6) compare nonce
7) extract PCRs
8) query facts DB
At the end, show two outputs:
- lock icon decision
- metadata shown in popup

**Speaker notes:**
This slide should emphasize that failure is intentionally diagnosable. A broken AWS root chain, a bad nonce, or a pure network problem should not collapse into one vague “untrusted” result during engineering and testing.

---

## Slide 9 — Reproducible AWS Deployment

**Slide title:**
How the Nitro Deployment Is Made Stable

**On-slide text:**
- Known-good parent instance:
  - `Amazon Linux 2023`
  - `m5.xlarge`
  - Nitro Enclaves enabled
- Known-good allocator:
  - `memory_mib: 2048`
  - `cpu_count: 2`
- Reproducibility controls:
  - pinned Docker base-image digests
  - `Cargo.lock`
  - `cargo build --locked`
- Result: stable PCRs across rebuilds

**Diagram prompt for generator:**
Create a deployment pipeline diagram:
Source repo -> pinned Docker build -> EIF build -> `describe-eif` PCR output -> run enclave -> parent proxy on `:9999`.
Add a side panel called “Stability controls” listing pinned image digests, lockfile usage, and allocator settings.

**Speaker notes:**
This slide should connect the architecture to operations. PCR-based identity is only useful if the build is reproducible enough that operators can intentionally regenerate the same measurements. The deployment runbook is documented in `AWS-DEPLOY.md`.

---

## Slide 10 — Security Model, Limits, and Next Steps

**Slide title:**
What Is Proven Today, and What Comes Next

**On-slide text:**
- Proven today:
  - landing page bytes come from enclave
  - attestation doc verifies to AWS root
  - nonce binds the proof to the browser challenge
  - PCRs identify the enclave build
- Not yet proven:
  - entire full-stack web app is enclave-only
  - all downstream data flows are protected
  - production-grade policy engine or transparency log
- Next steps:
  - stronger popup/debug UX
  - real OCI digest pipeline
  - systemd-managed AWS service startup
  - broader enclave-served content path

**Diagram prompt for generator:**
Create a final slide with three columns:
1) “Proven now”
2) “Operational limits”
3) “Next engineering steps”
Use concise iconography: shield for proven security properties, warning triangle for limits, roadmap arrow for next steps.

**Speaker notes:**
End by being precise. The system already proves something meaningful: a browser can verify a real AWS Nitro attestation and bind it to enclave-generated content. But it is not yet a complete production confidentiality platform. That distinction makes the project more credible, not less.
