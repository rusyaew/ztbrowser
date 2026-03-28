# Course-to-Repo Map

## Course phase -> repo evidence

| Course phase | Repo evidence today | Course artifact needed |
|---|---|---|
| Idea / validation | README, demos, architecture decks | product framing, landing copy, validation story |
| Research | real AWS Nitro split, canonical enclave repo, merged AWS deploy tooling and TUI | market/competitor memo, positioning map, decision log |
| Specification | implicit in code and docs only | PRD/SPEC, user stories, BDD, FR/NFR |
| Tests | real tests in `tests/` and `scripts/smoke-api.ts` | formal test strategy and traceability |
| Implementation | strong | mostly document and map, not rebuild |
| Deployment | strong across merged repo CI, canonical enclave release CI, and operator AWS automation | package into course-facing ops docs |
| Monitoring | minimal current evidence | define credible monitoring/PMF plan |
| Economics | missing | governance, monetization, pricing docs |
| Pitch / roadmap | partial in decks + Trello | formal pitch and roadmap docs |

## Critical adaptation

The course Telegram/FastAPI example should not be applied literally.
ZTBrowser maps the same discipline onto:

- browser extension
- Node/Express services
- Rust parent proxy
- external canonical enclave repo
- AWS Nitro deployment flow
- operator-driven deployment tooling in the merged repo

## What must not be forced

- fake landing-page product code
- fake dashboard screenshots
- Telegram bot structure
- a monolithic rewrite to match the course example architecture
