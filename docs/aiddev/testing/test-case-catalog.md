# Test Case Catalog

| Test ID | Scenario | Level | Current evidence |
|---|---|---|---|
| `T001` | `SC001` valid attestation -> locked | unit/integration | `tests/unit/extension/attestationVerifier.test.mjs`, `tests/integration/extension/content.test.mjs` |
| `T002` | `SC002` invalid attestation -> unlocked with reason | unit/integration | `tests/unit/extension/attestationVerifier.test.mjs`, `tests/integration/extension/content.test.mjs` |
| `T003` | `SC003` facts match returns workload metadata | integration | `tests/integration/extension/content.test.mjs` |
| `T004` | `SC004` facts miss preserves cryptographic success | integration | `tests/integration/extension/content.test.mjs` |
| `T005` | `SC005` canonical release publishes artifacts and facts update | process / workflow | `ztinfra-enclaveproducedhtml/.github/workflows/release-enclave.yml` |
| `T006` | `SC006` rebuild verification compares against provenance | process / workflow | `ztinfra-enclaveproducedhtml/.github/workflows/rebuild-verify.yml`, `tools/rebuild-verify.sh` |
| `T007` | `SC007` verify action deploys, checks, cleans up | manual integration on merged tooling | `scripts/aws-cli/`, `src/ztdeploy/`, manual verification evidence |
| `T008` | `SC008` deployments view lists and manages instances | manual integration on merged tooling | `src/ztdeploy/`, `scripts/aws-cli/list-managed-instances.sh`, `scripts/aws-cli/stop-instance.sh`, `scripts/aws-cli/terminate-instance.sh` |
| `T009` | `SC009` Micrus validates under demo root | manual/demo | `micrus/README.md`, demo runtime path |
| `T010` | `SC010` popup distinguishes demo and canonical keychains | local draft only | current local extension draft in dirty root worktree |
