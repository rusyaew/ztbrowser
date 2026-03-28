# Traceability Matrix

| Feature | Scenario | Requirements | Current tests / evidence | Gap |
|---|---|---|---|---|
| `F001` | `SC001` | `FR-001`,`FR-002`,`NFR-001` | unit verifier test, content integration test | none for core browser flow |
| `F001` | `SC002` | `FR-003`,`NFR-002` | unit verifier test, content integration test | popup error UX can be expanded |
| `F002` | `SC003` | `FR-004`,`FR-005`,`NFR-003` | content integration test | none for extension happy path |
| `F002` | `SC004` | `FR-006`,`NFR-003` | content integration test | hosted facts behavior under sleep/staleness still mostly manual |
| `F003` | `SC005` | `FR-007`,`FR-008`,`NFR-004` | release workflow config, canonical facts row process | no repo-local automated assertion in `ztbrowser` |
| `F003` | `SC006` | `FR-009`,`NFR-004` | rebuild workflow and tool exist | comparison output not consumed by `ztbrowser` CI |
| `F004` | `SC007` | `FR-010`,`FR-011`,`NFR-005` | merged AWS scripts, `ztdeploy`, and manual deploy verification evidence | no automated AWS end-to-end test |
| `F004` | `SC008` | `FR-012`,`NFR-005` | merged TUI and lifecycle scripts | no automated UI tests |
| `F005` | `SC009` | `FR-013`,`FR-014`,`NFR-006` | Micrus docs and manual demo | no automated Micrus test suite |
| `F005` | `SC010` | `FR-015`,`NFR-006` | local extension draft evidence only | needs merge and test if promoted |
