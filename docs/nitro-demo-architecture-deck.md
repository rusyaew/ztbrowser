# ZTBrowser Nitro Verification Demo — 10 Slide Deck Script

Use this as source text for an AI presentation + diagram generator.

---

## Slide 1 — Title & Goal

**Slide title:**
ZTBrowser Nitro Verification: Architecture, Trust, and Demo/Real Compatibility

**On-slide text:**
- Goal: verify enclave identity via Nitro-style attestation before trusting page execution context.
- Core claim: only trusted root certificate input changes between real AWS Nitro and demo plug.
- Everything else (checker API, extension flow, facts lookup, endpoint shape) remains identical.

**Diagram prompt for generator:**
Create a clean architecture overview with five boxes in a left-to-right flow:
1) Browser + Extension
2) Demo/Real Service (`/.well-known/attestation`)
3) Clientside Checker (`/verify`)
4) Facts Node (`lookup-by-pcr`)
5) Trust Roots (AWS root PEM or Demo root PEM)
Show arrows: extension -> service, extension -> checker, extension -> facts node, checker -> trust roots.
Use color coding: runtime flow arrows in blue, trust anchor dependency in orange.

**Speaker notes:**
This deck explains how the system verifies Nitro-style attestation documents, maps PCRs to human-auditable source metadata, and keeps the interface stable across two environments: real AWS Nitro trust roots and a toy simulated Nitro service. The design goal is environment transparency: consumers cannot tell demo vs real by protocol; only operator-selected root certificates change verifier trust.

---

## Slide 2 — System Components

**Slide title:**
Component Inventory and Responsibilities

**On-slide text:**
- **Service**: returns Nitro-shaped attestation payload with COSE-signed document.
- **Extension**: fetches attestation, sends doc+nonce to checker, queries facts DB by verified PCRs.
- **Checker**: validates signature, chain, nonce, and extracts PCRs.
- **Facts Node**: read-only mapping (PCR tuple -> repo/image metadata), not a cryptographic trust root.
- **Trust Roots**: configured PEM cert(s) loaded by checker.

**Diagram prompt for generator:**
Create a layered diagram with three horizontal layers:
- Top: Browser/Extension
- Middle: Checker + Facts Node
- Bottom: Service + Trust Roots
Label each component with one sentence responsibility.
Add a side note that facts node is metadata only.

**Speaker notes:**
The checker is the cryptographic enforcement point. Facts DB improves transparency and auditability, but does not establish authenticity by itself. Extension consumes checker verdict as lock/unlock signal and enriches UI with facts metadata when a PCR match exists.

---

## Slide 3 — AWS Nitro Attestation Protocol (Conceptual)

**Slide title:**
Nitro Attestation Protocol: What Is Verified

**On-slide text:**
- Service exposes `POST /.well-known/attestation`.
- Request carries nonce challenge (`NONCE`).
- Response includes base64 COSE attestation doc (`nitro_attestation_doc_b64`).
- Checker verifies:
  1) COSE signature integrity
  2) certificate chain to trusted root(s)
  3) nonce equality (freshness/challenge binding)
  4) extracted PCR values (identity measurements)

**Diagram prompt for generator:**
Sequence diagram with actors: Extension, Service, Checker, Trust Root Store.
Steps:
1) Extension -> Service: POST attestation with NONCE
2) Service -> Extension: COSE attestation doc
3) Extension -> Checker: /verify with NONCE + doc
4) Checker -> Trust Root Store: resolve trusted roots
5) Checker -> Extension: verdict + parsed PCRs
Annotate validations at checker step.

**Speaker notes:**
Attestation is meaningful only if signature chain and nonce pass. PCRs then represent measured enclave identity claims bound to that signed document. This is why signature validation is centralized in checker, while facts mapping remains supplemental.

---

## Slide 4 — Attestation Document Structure

**Slide title:**
COSE Payload Fields and Their Meaning

**On-slide text:**
- Signed envelope: COSE_Sign1, ES384 (`alg = -35`).
- Payload fields used by checker:
  - `certificate`, `cabundle` (chain material)
  - `nonce`
  - `pcrs` (`pcr0`, `pcr1`, `pcr2`, optional `pcr8`)
  - `module_id`, `timestamp`
- Output from checker:
  - `workingEnv` (nonce check)
  - `codeValidated` (signature + chain + structure)
  - parsed `pcrs` + root fingerprint used

**Diagram prompt for generator:**
Create a “document anatomy” diagram:
Outer box “COSE_Sign1” with sections Protected Header, Payload, Signature.
Inside Payload list the fields above.
Highlight nonce and PCRs with a different color as policy-relevant fields.

**Speaker notes:**
The implementation parses CBOR maps, verifies COSE signature with leaf cert public key, builds cert chain, and checks root against configured trusted fingerprints derived from PEM files.

---

## Slide 5 — Root-Cert-Only Mode Switching (Real vs Demo)

**Slide title:**
Single Switch Principle: Trust Root Input Only

**On-slide text:**
- Checker always runs same code path and same `/verify` API.
- Only operator-configured trust roots change:
  - Real mode: AWS Nitro root PEM
  - Demo mode: self-signed demo root PEM
- No demo markers in protocol contract.
- Extension, facts node, and service clients remain mode-agnostic.

**Diagram prompt for generator:**
Create a split diagram with two columns:
Left column “Real Nitro” -> checker trust source `aws-nitro-root.pem`.
Right column “Demo Plug” -> checker trust source `demo-pki/root-cert.pem`.
Both columns converge into identical checker pipeline block.
Add note: “same request/response schema on both paths”.

**Speaker notes:**
This design enforces compatibility testing. Any component behavior differences should come only from trust material, not hidden demo logic branches.

---

## Slide 6 — Facts DB Model and Role

**Slide title:**
Facts Node: PCR-to-Source Transparency Layer

**On-slide text:**
- Facts DB row contains:
  - `workload_id`, `repo_url`, `oci_image_digest`
  - `pcr0`, `pcr1`, `pcr2`, `pcr8`
  - metadata (`last_updated`, notes, build metadata)
- Extension queries `POST /api/v1/lookup-by-pcr` using checker-verified PCRs.
- Match result enriches UI with repo/image context.
- Facts mismatch does not replace cryptographic verdict logic.

**Diagram prompt for generator:**
Entity-relationship style card:
Main table “workloads facts” with listed columns.
Arrow from “Checker verified PCR output” to “lookup-by-pcr query”.
Arrow from “facts match” to “Extension metadata UI”.
Callout: “metadata trust aid, not signature validation”.

**Speaker notes:**
Facts node answers “what code/image likely produced this measurement” for auditability. Checker answers “is this signed by a trusted root and nonce-correct.” Keep those concerns distinct.

---

## Slide 7 — Extension Runtime Flow

**Slide title:**
How the Browser Extension Works

**On-slide text:**
- Generates cryptographically random nonce in content script.
- Calls service attestation endpoint.
- Sends `{ platform, nonce_sent, attestation_doc_b64 }` to checker `/verify`.
- Uses checker verdict for lock icon:
  - lock when `workingEnv && codeValidated`
- If verified PCRs are present, queries facts node for metadata enrichment.
- Stores state in `chrome.storage.local` for popup rendering.

**Diagram prompt for generator:**
Detailed flowchart with decision diamonds:
1) fetch attestation success?
2) checker verification success?
3) facts match found?
Show outputs:
- lock/unlock icon
- popup with reason
- popup with repo/image if matched, PCR summary always if available.

**Speaker notes:**
The extension treats checker as authority for cryptographic validity. Facts lookup is additive and can fail independently without changing cryptographic pass/fail logic.

---

## Slide 8 — End-to-End Verification Decision Logic

**Slide title:**
Verification Logic: From Bytes to User Signal

**On-slide text:**
1. Decode and parse attestation doc.
2. Verify COSE signature.
3. Build and verify certificate chain.
4. Confirm root fingerprint is trusted.
5. Compare nonce challenge.
6. Extract PCR tuple.
7. Evaluate lock state and optionally map PCRs via facts DB.

**Diagram prompt for generator:**
Pipeline diagram with numbered stages 1-7.
At each stage include potential failure label:
- invalid_doc
- invalid_signature
- invalid_chain
- nonce_mismatch
Final stage outputs: `workingEnv`, `codeValidated`, `reason`, `verified.pcrs`.

**Speaker notes:**
This slide should emphasize deterministic, auditable failure reasons. Operationally, these reasons are essential for debugging root misconfiguration vs signature tampering vs replay/mismatch issues.

---

## Slide 9 — Real Nitro vs Toy Plug Simulation

**Slide title:**
Compatibility Matrix: Real Nitro and Toy Plug

**On-slide text:**
- Same external contract:
  - `/.well-known/attestation`
  - checker `/verify` payload/response
  - facts lookup API
- Difference is signer trust chain source.
- Toy plug behavior:
  - signs Nitro-shaped docs per request nonce
  - uses demo root/leaf cert chain
- Real Nitro behavior:
  - genuine platform attestation chain under AWS root

**Diagram prompt for generator:**
Table-style comparison with rows:
- Endpoint shape
- Nonce behavior
- Signature algorithm
- Cert chain format
- Trusted root configured in checker
- Expected result when mismatched root used
Use green checkmarks for “same”, orange for “different trust source”.

**Speaker notes:**
Include explicit statement: with AWS root configured, toy plug must fail (`invalid_chain`). With demo root configured, toy plug should pass. This is the core safety property proving root-based trust separation.

---

## Slide 10 — Operations, Testing, and Next Steps

**Slide title:**
Operational Playbook and Future Hardening

**On-slide text:**
- Local run in 3 terminals:
  1) facts node
  2) checker with selected `TRUST_ROOT_CERT_PATHS`
  3) service (`MODE=good|bad`)
- Smoke tests cover good and tampered signature paths.
- Key operational checks:
  - root cert path is correct
  - expected rejection on root mismatch
  - nonce mismatch handled explicitly
- Next steps:
  - add cert validity-time checks/pinning policy hardening
  - move verifier to browser/WASM if desired
  - integrate real Nitro runtime for live attestation issuance

**Diagram prompt for generator:**
Roadmap slide with three lanes:
- “Now”: root-swap trust model + end-to-end verification
- “Near term”: stronger policy checks + observability
- “Future”: in-browser verifier + production Nitro deployment
Include a small command-line block visual for the 3-terminal startup.

**Speaker notes:**
Close by reinforcing that the architecture is intentionally composable: cryptographic verification remains strict and centralized, while facts and UI layers remain portable. This gives a realistic path from local simulation to production Nitro without protocol redesign.

