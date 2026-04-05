# Artifact Quality Gate

Use this gate before finalizing any AIDev artifact.

## Purpose

The course is evaluated on consistency across:
- specification
- tests
- code in GitHub
- working application behavior

That means no artifact should be accepted as a first draft if it weakens traceability, introduces unsupported claims, or makes later stages rediscover repo truth.

Read this file together with:
- [../evaluation_criteria.md](../evaluation_criteria.md)

## Mandatory preflight

Before finalizing an artifact:

1. Read `evaluation_criteria.md`.
2. Identify which part of the full rubric this artifact must support.
3. Check the draft against:
   - methodological consistency
   - alignment with current repository truth
   - consistency with existing AIDev artifacts
   - evidence density and traceability
   - completeness for the current stage
   - usefulness for the next stage
4. If the draft is weak, shallow, inconsistent, or under-evidenced, regenerate it internally before returning it.

Do not expose a knowingly weak draft as a final artifact.

## Quality bar

Default target quality bar:
- strong enough to support an eventual package score in the `9-10` range

This does not mean every artifact must be perfect in isolation. It means each artifact must:
- strengthen the full package
- avoid contradictions with code, tests, or runtime reality
- reduce ambiguity for downstream prompts and implementation work

An artifact is not acceptable if it:
- relies on stale docs without checking the repo
- introduces features not evidenced by code/tests/workflows
- hides important uncertainty
- weakens traceability between spec, tests, and implementation
- leaves obvious gaps that force the next stage to redo the analysis

## Stage-specific emphasis

### Repository analysis artifacts

Must be strong on:
- as-is reconstruction
- branch awareness
- architecture boundaries
- hotspots and risk zones
- uncertainty logging

Weak if they:
- confuse merged truth with draft state
- miss ownership boundaries
- skip test reality
- omit major deploy/runtime paths

### Change request artifacts

Must be strong on:
- bounded change scope
- delta from as-is behavior
- affected modules and unchanged areas
- explicit assumptions and non-goals

Weak if they:
- drift into redesign
- do not localize the change surface
- do not preserve unchanged behavior

### Test update artifacts

Must be strong on:
- changed behavior coverage
- unchanged behavior regression protection
- traceability to requirements/scenarios
- realistic test-level selection

Weak if they:
- add tests without protecting adjacent behavior
- ignore brittle or high-value regression baselines

### Code generation artifacts

Must be strong on:
- alignment with current architecture
- consistency with CR and tests
- minimal surface area
- no unsupported architectural drift

Weak if they:
- solve the wrong problem
- silently change contracts
- bypass quality constraints established earlier

## Regeneration rule

If the artifact would likely score below a strong `9` for its role in the package:
- revise it
- tighten evidence
- reduce ambiguity
- regenerate before finalization

Do not return low-confidence output just because a draft exists.
