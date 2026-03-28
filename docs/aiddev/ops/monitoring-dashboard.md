# Monitoring Dashboard Specification

## Purpose

This is the course-facing dashboard definition for ZTBrowser.
It is a dashboard specification, not a fake screenshot.

## Dashboard goals

- expose current health across the three delivery lanes
- show whether canonical release evidence stays aligned with deployable runtime identity
- show whether operator-driven deployments are succeeding
- expose signals useful for PMF-style product learning

## Panel group 1 — Repo and demo health

### Panel: Main CI status
- source: `.github/workflows/ci.yml`
- signal: latest run status by branch
- purpose: detect regression in merged repo quality gates

### Panel: Smoke API status
- source: local/CI smoke checks
- signal: pass/fail and recent failures
- purpose: detect breakage in demo/protocol paths

## Panel group 2 — Canonical release health

### Panel: Canonical release cadence
- source: `ztinfra-enclaveproducedhtml` releases
- signal: latest release tag, release time
- purpose: show release freshness

### Panel: Facts publication freshness
- source: provenance timestamps and merged facts state
- signal: time from release to facts PR merge
- purpose: detect provenance drift or publication lag

### Panel: Rebuild verification outcome
- source: rebuild-verification workflow outputs
- signal: latest pass/fail comparison state
- purpose: show supply-chain auditability

## Panel group 3 — Operator deployment health

### Panel: Deploy success rate
- source: `ztdeploy` / AWS script run logs
- signal: successful runs divided by started runs
- purpose: measure deploy reliability

### Panel: Deploy stage failure breakdown
- source: staged deploy logs
- signal: failures by stage such as prereqs, instance launch, release fetch, proxy start, attestation check
- purpose: locate the operational bottleneck

### Panel: Deploy-to-verification time
- source: staged deploy timestamps
- signal: median duration from run start to successful landing-page/attestation verification
- purpose: measure operator efficiency

### Panel: Managed live deployments
- source: AWS instance listings from merged tooling
- signal: count of running/stopped managed instances, instance types, public IP presence
- purpose: show live operational footprint and cost risk

## Panel group 4 — Browser trust/product signals

### Panel: Attestation verification outcomes
- source: future verifier telemetry based on `analytics-events.md`
- signal: `attestation_verified` vs `attestation_failed`
- purpose: measure core product success

### Panel: Facts match rate
- source: future extension/facts telemetry
- signal: `facts_lookup_matched / attestation_verified`
- purpose: measure transparency completeness

### Panel: Trust-root mix
- source: future verifier telemetry
- signal: AWS canonical root vs demo/self-signed root validations
- purpose: separate real production-style validations from demos

## Minimum implementation path

1. treat CI status, release workflow status, and operator run logs as current data sources
2. add lightweight structured deploy-run summaries
3. add lightweight service metrics for facts lookup and verifier outcomes
4. only then build a real dashboard in Grafana, OpenSearch Dashboards, or another metrics UI

## Non-goals

- do not fabricate live charts for the course
- do not claim continuous telemetry already exists for every panel
- do not add heavy observability infrastructure inside the canonical enclave path just for coursework
