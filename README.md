# ZTBrowser Alpha

## Description

Verify Intel SGX or Fully Homomorphic Encryption protected sites using Zero Trust Browser Extension and force server to process your data in a hardware/mathematical black box with declared open source code, protecting yourself from advertisement, espionage, and data leaks.

## Guide

Run `exampleserver.ts` for example server,
`clientsidechecker.ts` to emulate clientside SGX/FHE verification, add `ztbrowser-chrome-extension` to Google Chrome
for the `ztbrowser` extension.

Attestation endpoint for servers is `/.well-known/attestation` for arbitrary server + some other endpoints for compatibility 
with other FHE/SGX servers.