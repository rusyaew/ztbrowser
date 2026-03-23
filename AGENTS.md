# AGENTS

## Architecture authority

- `ztbrowser` is the integration repo.
- `https://github.com/rusyaew/ztinfra-enclaveproducedhtml` is the canonical measured enclave repo.
- Real AWS deploys must consume enclave release artifacts from that repo.
- Canonical facts rows must come from enclave release CI, not from manual workspace builds.

## Current deploy model

- parent proxy: in this repo under `aws-deploy/parent-proxy`
- enclave EIF: fetched from enclave release artifacts into `aws-deploy/build/`
- checker: local or browser-side verifier
- facts node: metadata lookup only

## Important rules

- Do not reintroduce monorepo-owned canonical enclave builds in `ztbrowser`.
- If you need to change the measured enclave workload, change `ztinfra-enclaveproducedhtml` and cut a new tagged release.
- If you need new canonical facts, they must be generated from enclave repo CI provenance and merged into `facts-node/facts-db.json`.
- Historical demo and pre-split rows may exist in the facts DB, but they are noncanonical.
