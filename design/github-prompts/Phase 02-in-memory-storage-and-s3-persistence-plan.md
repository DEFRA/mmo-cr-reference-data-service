# Plan: Phase 2 — In-Memory Storage and S3-Compatible Persistence

This phase coordinates three independently-gated steps. Each step's own approved prompt
(`github-prompts/step-0{5,6,7}-*.md`) remains authoritative for its objective, scope,
deliverables, and completion criteria. This file records only the phase-level execution plan.

## Repository state at phase start

- Steps 01-04 fully implemented (contracts, domain types, schemas, schema registry).
- `src/reference-data/in-memory-store/index.js` and `src/reference-data/persistence/index.js`
  were stub markers only (`{ name: '...' }`).
- `compose/floci/start.d/10-setup-resources.sh` had only commented-out example commands.
- No plan files existed yet for Steps 05/06/07.
- Step 03 contracts (`src/common/contracts/in-memory-data-store.js`,
  `reference-data-repository.js`) and Step 04 schemas required no changes to support Steps 05-07.
- `@aws-sdk/client-s3` was not yet a dependency (needed for Step 07).
- No conflicts found between the repository and the three approved step prompts.

## Sequence

1. **Step 05 — In-Memory Data Store** (own plan: `Step 05-implement-in-memory-data-store-plan.md`)
2. **Step 06 — Configure Floci S3 resources** (own plan:
   `Step 06-configure-floci-s3-resources-for-local-development-plan.md`)
3. **Step 07 — Persistence Module** (own plan:
   `Step 07-implement-persistence-module-plan.md`)

Each step is implemented and verified independently; the next step does not begin until the
prior step's completion gate (focused tests, full suite, lint, format) passes and is reported.

## Phase-level constraints carried into every step

- No database, MongoDB, Redis, LocalStack, or MinIO introduced.
- Step 06 uses the existing Floci service only.
- Step 07 confines all direct AWS S3 SDK usage to the Persistence Module.
- No Step 08+ functionality (validation, normalisation, cache refresh, auth, routes, query)
  implemented in this phase.

## Status

- Step 05: implemented (see completion report in conversation).
- Step 06: implemented (see completion report in conversation).
- Step 07: implemented (see completion report in conversation). Phase 2 complete.
