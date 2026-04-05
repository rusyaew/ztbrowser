# Test Case Catalog

| Test ID | Scenario | Level | Current evidence |
|---|---|---|---|
| `T001` | `SC001` valid attestation -> locked | unit/integration | `tests/unit/extension/attestationVerifier.test.mjs`, `tests/integration/extension/content.test.mjs` |
| `T002` | `SC002` invalid attestation -> unlocked with reason | unit/integration | `tests/unit/extension/attestationVerifier.test.mjs`, `tests/integration/extension/content.test.mjs` |
| `T003` | `SC003` facts match returns workload metadata | integration | `tests/integration/extension/content.test.mjs`, `tests/integration/facts-node/server.test.mjs` |
| `T004` | `SC004` facts miss preserves cryptographic success | integration | `tests/integration/extension/content.test.mjs` |
| `T005` | `SC005` canonical release publishes artifacts and facts update | process / workflow | `ztinfra-enclaveproducedhtml/.github/workflows/release-enclave.yml` |
| `T006` | `SC006` rebuild verification compares against provenance | process / workflow | `ztinfra-enclaveproducedhtml/.github/workflows/rebuild-verify.yml`, `tools/rebuild-verify.sh` |
| `T007` | `SC007` verify action deploys, checks, cleans up | manual integration on merged tooling | `scripts/aws-cli/`, `src/ztdeploy/`, manual verification evidence |
| `T008` | `SC008` deployments view lists and manages instances | manual integration on merged tooling | `src/ztdeploy/`, `scripts/aws-cli/list-managed-instances.sh`, `scripts/aws-cli/stop-instance.sh`, `scripts/aws-cli/terminate-instance.sh` |
| `T009` | `SC009` Micrus validates under demo root | manual/demo | `micrus/README.md`, demo runtime path |
| `T010` | `SC010` popup distinguishes demo and canonical keychains or equivalent platform labeling | current merged UI / manual | `ztbrowser-chrome-extension/popup.js`, `ztbrowser-chrome-extension/popup.html` |
| `T011` | `SC011` common envelope verifies on Nitro and CoCo | unit/integration | `tests/unit/extension/attestationVerifier.test.mjs`, `tests/integration/extension/content.test.mjs` |
| `T012` | `SC011` unknown platform or envelope version is rejected | unit/integration | `tests/unit/extension/attestationVerifier.test.mjs` |
| `T013` | `SC012` CoCo evidence normalizes to `image_digest + initdata_hash` | unit/integration | `tests/unit/extension/attestationVerifier.test.mjs` |
| `T014` | `SC012` generic CoCo evidence is rejected | unit/integration | `tests/unit/extension/attestationVerifier.test.mjs` |
| `T015` | `SC013` release-centered facts lookup resolves a matched realization | integration | `tests/integration/facts-node/server.test.mjs`, `tests/integration/facts-node/factsDb.test.mjs` |
| `T016` | `SC013` facts miss preserves realization verification success | integration | `tests/integration/extension/content.test.mjs`, `scripts/smoke-api.ts` |
| `T017` | `SC013` Nitro compatibility path via `lookup-by-pcr` remains valid | integration | `tests/integration/facts-node/server.test.mjs`, `scripts/smoke-api.ts` |
| `T018` | `SC014` canonical release publishes Nitro and CoCo realization outputs | process / workflow | `ztinfra-enclaveproducedhtml/.github/workflows/release-enclave.yml`, release artifacts |
| `T019` | `SC014` browser/runtime envelope contract remains common-shape | integration | `tests/integration/extension/background.test.mjs`, `tests/integration/extension/content.test.mjs` |
| `T020` | `SC015` AWS CoCo deploy/verify happy path succeeds for the canonical HTML service | manual/process-backed E2E | `scripts/aws-cli/`, `src/ztdeploy/`, release artifacts |
| `T021` | `SC015` AWS CoCo deploy can fail verification without masking the error as success | manual/process-backed E2E | `scripts/aws-cli/`, `src/ztdeploy/` |
| `T022` | `SC016` mixed Nitro and CoCo deployments show correct platform metadata | manual/process-backed E2E | `src/ztdeploy/`, deployment listing UI |
| `T023` | `SC016` AWS CoCo lane is labeled experimental and cleanup remains cost-aware | manual/process-backed E2E | `scripts/aws-cli/`, `src/ztdeploy/` |
| `T024` | `SC016` operator metadata exposes platform and lifecycle state | manual/process-backed E2E | `src/ztdeploy/`, `scripts/aws-cli/list-managed-instances.sh` |
| `T025` | branch-adjacent capacity fallback chooses a later allowed instance type | planned/manual | `scripts/aws-cli/`, `src/ztdeploy/` |
| `T026` | exhausted instance-type candidates fail clearly | planned/manual | `scripts/aws-cli/`, `src/ztdeploy/` |
| `T027` | resolved instance type persists into run/deployment metadata and TUI | planned/manual | `src/ztdeploy/` |
