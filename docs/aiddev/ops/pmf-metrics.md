# PMF Metrics

## Product frame

ZTBrowser is treated as a developer trust platform, not a consumer browser extension business.
That changes which metrics matter.

## North-star candidate

**Verified attested services successfully explained to the browser**

A practical proxy metric:
- count of successful verifications with canonical or intentionally accepted trust roots, paired with meaningful metadata resolution when expected

## Funnel metrics

### Acquisition
- number of teams trying the demo or deploy path
- number of stars/issues/demo requests is only weak signal and should not be overstated

### Activation
- first successful `attestation_verified`
- first successful `facts_lookup_matched`
- first successful canonical deploy verification
- first successful operator-driven AWS deploy or verify run

### Retention
- repeated deploy runs by the same team
- repeated validation of the same or new workloads over time
- repeated use of kept-live managed deployments

### Transparency completeness
- `facts_lookup_matched / attestation_verified`
- lag between canonical release and merged facts row

### Operator efficiency
- deploy success rate
- median deploy-to-verification time
- number of manual interventions needed per successful run
- share of deployment failures attributable to cloud capacity, script defects, or facts/provenance mismatch

## PMF research metrics

For pilot teams, use a PMF-style question such as:
- “How disappointed would you be if ZTBrowser no longer existed?”

Also track qualitative questions:
- what sensitive workflows would you gate on attestation if this became reliable?
- do you need AWS-only support, or multi-provider support first?
- do you need hosted provenance/facts, or just the open verifier stack?
- is the operator deploy path already valuable on its own, or only when paired with an organization policy control plane and compliance tooling?

## What not to track as core PMF evidence yet

- raw page views
- browser installs without successful verification use
- vanity GitHub activity without deploy or validation behavior
