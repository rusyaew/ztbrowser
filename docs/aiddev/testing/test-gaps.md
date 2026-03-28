# Test Gaps

## Gaps acceptable for this course wave

- no full AWS end-to-end CI for Nitro deployment
- no automated Micrus suite yet
- no automated tests for `ztdeploy` UI behavior on `origin/main`
- no formal assertion in `ztbrowser` CI that canonical release PRs always align with facts rows

## Recommended next test additions

1. unit tests for facts-node matching edge cases including `pcr8` normalization
2. tests for `ztdeploy` stage graph and failure handling
3. automated check that `facts-db.json` canonical row fields are structurally complete
4. focused Micrus tests for demo trust-root flow
5. a targeted non-default AWS verification job or reproducible dry-run harness for the operator lane

## What should not be done just for the course

- do not claim AWS integration tests exist if they are manual today
- do not relabel human-triggered deployment automation as fully autonomous CD
- do not add brittle full-cloud tests that create cost and maintenance pain without a clear benefit
