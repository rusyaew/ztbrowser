# Final Artifact Map

## Evidence reused from repo

- core technical docs: `README.md`, `AWS-DEPLOY.md`, `aws-deploy/README.md`
- tests and CI: `.github/workflows/ci.yml`, `tests/`, `scripts/smoke-api.ts`
- operator deployment tooling: `scripts/aws-cli/`, `src/ztdeploy/`
- demos: `demo-service-repo/`, `micrus/`
- canonical enclave release repo: `ztinfra-enclaveproducedhtml`

## New course layer

- `docs/aiddev/evidence/*`
- `docs/aiddev/product/*`
- `docs/aiddev/spec/*`
- `docs/aiddev/testing/*`
- `docs/aiddev/ops/*`
- `docs/aiddev/plan/*`
- `docs/aiddev/business/*`
- root `prd.json` compatibility mirror

## Compatibility artifacts

- `docs/aiddev/spec/SPEC.csv`
- root `prd.json`

## Update policy

Only one repo-wide update is recommended beyond additive course artifacts:
- add a small pointer from `README.md` to `docs/aiddev/`

Everything else should remain additive and isolated under `docs/aiddev/`, with the root `prd.json` present only for course/tool compatibility.
