# Existing vs Missing

## Reusable existing assets

- `README.md`
- `AWS-DEPLOY.md`
- `aws-deploy/README.md`
- `.github/workflows/ci.yml`
- `scripts/aws-cli/`
- `src/ztdeploy/`
- `tests/unit/extension/attestationVerifier.test.mjs`
- `tests/integration/extension/*.test.mjs`
- `scripts/smoke-api.ts`
- `micrus/README.md`
- `ztinfra-enclaveproducedhtml` release and rebuild workflows

## Now provided by the course package

- product framing docs
- market / competitor analysis
- PRD / SPEC including `SPEC.csv`
- analytics event model
- test strategy and traceability matrix
- work plan and task breakdown
- monitoring strategy and dashboard specification
- PMF docs
- pricing / governance / commercialization docs
- course pitch outline
- root `prd.json` compatibility mirror

## Remaining implementation gaps, not missing documents

- stronger automated tests for `ztdeploy` and facts-node edge cases
- stronger automated validation linking canonical release fields to facts rows
- actual monitoring instrumentation and dashboard implementation if desired later
- broader AWS/CD automation if the project decides to move beyond operator-driven deploys

## Should not be created

- duplicate architecture decks
- fake traction claims
- fake pricing benchmarks presented as facts
- fake monitoring screenshots or fabricated production dashboards
