# Analytics Events

These are proposed product analytics events for course completeness and future implementation.
They are not all implemented today.

## Core product events

| Event | When | Why it matters |
|---|---|---|
| `attestation_fetch_started` | validation begins | activation and reliability funnel |
| `attestation_fetch_failed` | attestation endpoint fetch fails | infra and UX failure analysis |
| `attestation_verified` | verifier returns success | core product value event |
| `attestation_failed` | verifier returns failure | trust failure analysis |
| `facts_lookup_matched` | facts row matched by PCR | provenance completeness |
| `facts_lookup_unmatched` | no matching row | release/facts lag signal |
| `popup_opened` | user opens popup | debug engagement and trust inspection |

## Operator events

| Event | When | Why it matters |
|---|---|---|
| `deploy_run_started` | operator starts `verify` or `deploy` | operator activation |
| `deploy_stage_failed` | any deployment stage fails | ops quality metric |
| `deploy_run_succeeded` | deployment completes successfully | deployment success rate |
| `managed_deployment_kept_live` | deploy action leaves instance running | cost/usefulness balance |

## Release/provenance events

| Event | When | Why it matters |
|---|---|---|
| `canonical_release_published` | enclave release artifacts published | release cadence |
| `facts_pr_opened` | release workflow opens facts PR | provenance freshness |
| `facts_pr_merged` | canonical facts merged | deployability and metadata completeness |
| `rebuild_verify_passed` | rebuild verifier matches manifest | supply-chain trust signal |

## PMF metric anchors

- activation: first successful `attestation_verified`
- transparency completeness: `facts_lookup_matched / attestation_verified`
- operator success: `deploy_run_succeeded / deploy_run_started`
- release freshness: time from `canonical_release_published` to `facts_pr_merged`
