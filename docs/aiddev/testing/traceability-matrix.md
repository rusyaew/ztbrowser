# Traceability Matrix

| Feature | Scenario | Requirements | Current tests / evidence | Gap |
|---|---|---|---|---|
| `F001` | `SC001` | `FR-001`,`FR-002`,`NFR-001` | unit verifier test, content integration test | none for core browser flow |
| `F001` | `SC002` | `FR-003`,`NFR-002` | unit verifier test, content integration test | popup error UX can be expanded |
| `F002` | `SC003` | `FR-004`,`FR-005`,`NFR-003`,`NFR-010` | `tests/integration/facts-node/server.test.mjs`, `tests/integration/facts-node/factsDb.test.mjs`, `scripts/smoke-api.ts` | facts-node coverage is now visible, but hosted deployment behavior is still manual |
| `F002` | `SC004` | `FR-006`,`NFR-003` | content integration test | hosted facts behavior under sleep/staleness still mostly manual |
| `F003` | `SC005` | `FR-007`,`FR-008`,`NFR-004` | release workflow config, canonical facts row process | no repo-local automated assertion in `ztbrowser` |
| `F003` | `SC006` | `FR-009`,`NFR-004` | rebuild workflow and tool exist | comparison output not consumed by `ztbrowser` CI |
| `F004` | `SC007` | `FR-010`,`FR-011`,`NFR-005`,`NFR-013` | merged AWS scripts, `ztdeploy`, and manual deploy verification evidence | no automated AWS end-to-end test |
| `F004` | `SC008` | `FR-012`,`NFR-005` | merged TUI and lifecycle scripts | no automated UI tests |
| `F005` | `SC009` | `FR-013`,`FR-014`,`NFR-006` | Micrus docs and manual demo | no automated Micrus test suite |
| `F005` | `SC010` | `FR-015`,`NFR-006` | current merged popup/platform labeling evidence | demo-specific trust-root distinction is now documented, but not fully automated |
| `F006` | `SC011` | `FR-016`,`FR-017`,`FR-018`,`NFR-008`,`NFR-012` | unit verifier test, extension integration test | common-envelope and dispatch coverage is present but should remain regression-protected |
| `F006` | `SC012` | `FR-020`,`NFR-009` | unit verifier test, facts-node tests | workload-specific identity checks need explicit evidence |
| `F006` | `SC013` | `FR-019`,`FR-025`,`NFR-010` | `tests/integration/facts-node/server.test.mjs`, `tests/integration/facts-node/factsDb.test.mjs`, `scripts/smoke-api.ts` | legacy + release-centered lookup mapping should stay regression-protected |
| `F006` | `SC014` | `FR-007`,`FR-021` | `ztinfra-enclaveproducedhtml/.github/workflows/release-enclave.yml` | no repo-local automated assertion in `ztbrowser` |
| `F006` | `SC015` | `FR-010`,`FR-022`,`FR-023`,`NFR-011` | manual operator evidence, `scripts/aws-cli/`, `src/ztdeploy/` | live AWS CoCo substrate evidence remains manual/process-backed |
| `F006` | `SC016` | `FR-012`,`FR-024`,`NFR-013` | `src/ztdeploy/`, `scripts/aws-cli/list-managed-instances.sh` | platform-visible operator metadata is present but still manual to validate |
