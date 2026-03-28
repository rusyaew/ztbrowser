# Trello to Roadmap Map

## Trello source summary

### To Do
- ux for extension
- deploying third party projects

### Doing
- policy engine blocks bad packets to list of private endpoints
- policy engine highlights forms with allowed (private) endpoints (in whitelist)
- intregrate CoCo to work on all cloud providers
- presentation
- make micrus service deploy as good as `ztinfra-enclaveproducedhtml`
- CI selenium

### Done
- CI/CD + remap
- integrate good protocol
- check on cloud provider
- deploy cloud
- make demo server
- make demo server good: micrus + site
- integration 1 / 2
- client verifier in extension
- AWS better deploy with CLI

## Terminology note

The Trello cards use `policy engine` to describe client-side policy behavior in the extension, such as private-endpoint blocking and allowlist-driven UI cues.
In the AIDev business docs, that should not be confused with the future **organization policy control plane**, which means centralized policy management and distribution for teams.

## Mapping

### Near-term hardening
- ux for extension
- presentation
- CI selenium
- make Micrus deploy as well as canonical enclave workload

### Local policy evaluation layer
- policy engine blocks bad packets to private endpoints
- policy engine highlights forms with allowed endpoints

### Portability
- integrate CoCo to work on all cloud providers
- deploying third party projects

### Already achieved foundations
- protocol integration
- cloud deploy path
- extension verifier
- AWS CLI deploy improvement
