# Step 19 — Completion Summary: Species Query Endpoints and Name Resolution

## Plan

[Step 19-implement-species-query-endpoints-and-name-resolution-plan.md](./Step%2019-implement-species-query-endpoints-and-name-resolution-plan.md)
— records all 11 owner-approved decisions verbatim (2026-09-16), resolving every
ambiguity previously identified without inference from schema/duplicate-detection
conventions or other datasets.

## Endpoints

```
GET /api/v1/reference-data/species
GET /api/v1/reference-data/species/{id}
```

## Owner-approved decisions implemented exactly

1. General text search: FAO code + scientific name + all common/local names (via
   Step 15's unmodified matching, denormalised through `prepareRecords`).
2. `faoCode`: exact, case-insensitive.
3. `scientificName`: exact, case-insensitive (partial matching only via `query`).
4. `countryCode`: exact, case-insensitive, matches any `commonNames[].countryCode`.
5. `languageCode`: exact, case-insensitive, complete-tag match, no regional fallback.
6. `countryCode` is dual-purpose (species filter **and** Rule 2 mobile-resolution
   country context) — achieved for free via the existing `customFilterValues` →
   projection-context merge; no new parameter or plumbing added.
7. `Accept-Language`: first valid tag only, quality weights ignored, no regional
   fallback, absent ⇒ no context, invalid ⇒ `400`.
8. Filter combination: unmodified Step 15 AND semantics.
9. Mobile name-resolution: the exact 6-rule locked order, no reordering.
10. Tie-breaking: canonical source-array order, no sorting, no mutation.
11. Plan saved before implementation; canonical schemas/Step 09/Step 10/Step 15 engine
    left untouched (no changes were required to the engine itself).

## Shared-infrastructure defect found and fixed (owner-approved before proceeding)

While wiring the `prepareRecords`-based search-field denormalisation (needed for
decision #1), discovered that `collection-query-service.js` returned the
`prepareRecords`-enriched record directly as **both** the canonical and mobile API
output for any dataset using `prepareRecords` — leaking internal fields
(`_commonNamesText`/`_localNamesText` for species, `_categoryCode`/`_categoryName`/
`_searchableCharacteristics` for gears, retroactively) into public responses. Stopped,
demonstrated the failure with a throwaway test, proposed the smallest fix (track raw
records in a GUID→record map; always project/return the original raw record, never
the enriched one), and received explicit approval before applying it. Fix is ~15 lines,
fully additive, in `collection-query-service.js` only — no change to
`collection-query-engine.js`, `query-configuration.js`, or `query-request-parser.js`.
Regression-locked with new tests in `collection-query-service.test.js` and
`gears-query-configuration.test.js`.

## Files created

- `src/reference-data/query/species-name-resolver.js` (+ test)
- `src/reference-data/query/species-accept-language.js` (+ test)
- `src/reference-data/query/species-mobile-projector.js` (+ test)
- `src/reference-data/query/species-query-configuration.js` (+ test)
- `src/routes/species.js` (+ test)
- `design/github-prompts/Step 19-implement-species-query-endpoints-and-name-resolution-plan.md`

## Files modified

- `src/reference-data/query/collection-query-service.js` (+ test additions) — the
  approved canonical/mobile-output leak fix.
- `src/reference-data/query/gears-query-configuration.test.js` — added a regression
  assertion locking in the fix for the pre-existing gear leak.
- `src/plugins/router.js` — registers the species routes.

## Tests

Name resolver (all 6 rules, precedence ordering, tie-breaking, immutability,
determinism against malformed data — 21 tests), Accept-Language parser (valid/invalid/
absent/quality-weight-stripping/case-insensitivity/no-regional-fallback — 10 tests),
mobile projector (5 tests), query configuration (all filters, general search
exclusions, AND combination, active-state, canonical/mobile leak-proofing — 19 tests),
route integration (canonical/mobile, every filter, every resolution rule via HTTP,
GUID/404/400, 401, ETag/304 — 17 tests).

## Verification (exact requested order)

```
1. species-name-resolver.test.js          — 21 passed
2. species-mobile-projector.test.js       — 5 passed
3. species-query-configuration.test.js    — 19 passed
4. (filters covered within #3)
5. species-accept-language.test.js        — 10 passed
6. routes/species.test.js                 — 17 passed
7. Step 15 engine/service/config/parser regression — 69 passed
8. Steps 16-18 regression (vessels/gears/ports/map-ports) — 69 passed
9. npm test (full suite)                  — 1126 passed, 6 skipped, 0 failed
10. Coverage                               — 96.29% statements / 91.43% branches
11. npm run lint                           — clean, 0 problems
12. Prettier — all Step 19 files clean (4 needed --write, reverified clean)
13. Defra SonarCloud review — no findings on any Step 19 file or the modified
    collection-query-service.js
```

## Defra SonarCloud review

`sonarqube_analyze_file` run against all 12 Step 19 source/test files plus the
modified `collection-query-service.js`/`.test.js` — **no findings** on any of them.
Security Hotspot listing requires SonarQube Connected Mode (not configured locally);
pending CI verification, same caveat as Steps 17-18.

## Unrelated pre-existing warnings (not touched)

Repo-wide `format:check` reports 32 pre-existing warnings across earlier steps,
README, and design docs/conversation logs — none are Step 19 files.

## Confirmations

- No Step 20 files created or modified.
- No database or Redis introduced.
- No direct S3/Floci access; no direct Authentication Service call from species
  routes.
- No translation or external taxonomy service added.
- No mobile species projection persisted.
- Canonical schemas, Step 09 validation, Step 10 normalisation, and the Step 15
  query engine/configuration/parser mechanisms are unchanged in behaviour (the one
  shared-file change was an output-correctness bugfix, approved in advance, not a
  redesign).

## Remaining risks / decisions

- SonarCloud Connected Mode not configured locally — full CI-based Sonar verification
  remains pending (consistent with Steps 17-18).
- The `collection-query-service.js` fix retroactively corrects a latent Step 17 (gear)
  canonical-response defect; flagged here for visibility even though it was not a
  Step 19-introduced regression.
