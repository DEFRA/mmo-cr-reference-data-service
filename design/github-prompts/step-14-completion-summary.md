# Step 14 — Completion Summary: Implement the Manifest API

## Plan

[Step 14-implement-manifest-api-plan.md](./Step%2014-implement-manifest-api-plan.md)

## Endpoint implemented

```
GET /api/v1/reference-data/manifest
GET /api/v1/reference-data/manifest?include=vessels,ports,species
```

Requires `reference-data.read` via the existing (provisional) Authentication Service
integration. Reads only from the in-memory active manifest (Step 11) — never S3/Floci per
request, never triggers cache refresh.

## Key decisions

- **Manifest unavailability**: a single check (`store.getManifest() === null`) covers both
  "hydration not yet complete" and "no valid manifest was ever hydrated" — the In-Memory Data
  Store only ever holds a manifest once the Cache Refresh Module has validated one. Returns `503
reference_data_unavailable`.
- **`include` error code**: no dedicated `invalid_query_parameter` code exists in this
  repository's `SERVICE_ERROR_CODES`; reused `invalid_request` (→ `400`) per the master plan's
  "reuse existing approved code" fallback.
- **`include` validation set**: restricted to _persisted_ datasets only (`isPersistedDataset`),
  so `map-ports` is explicitly rejected as an include value rather than silently returning an
  empty dataset list.
- **Deterministic ordering**: dataset entries are ordered by the canonical `DATASETS` registry
  order, not raw manifest storage/write order.
- **Filtered-manifest ETag policy** (explicitly required by the prompt): one ETag per active
  manifest revision (`sha256(manifestId:version)`), shared by the full and every filtered view.
  Simpler than a per-filter-combination projector, with no confirmed requirement for one; a
  change to an excluded dataset invalidates a filtered client's cache too (accepted trade-off).
- **`map-ports` in the manifest**: omitted entirely — already enforced by the existing
  `manifestDatasetEntrySchema` (Step 04) and required by the master plan.
- **New central route registry**: `src/common/domain/route-paths.js` (`API_BASE_PATH`,
  `MANIFEST_ROUTE_PATH`, `DATASET_ROUTE_PATHS`, `getDatasetRoutePath`) — the
  `/api/v1/reference-data` prefix did not exist anywhere in the repository before this step;
  Step 13 delivered only the reusable API utilities, not an actual registered route.

## Files created

- `src/common/domain/route-paths.js` (+ test) — central public route-path registry.
- `src/reference-data/query/manifest-include-filter.js` (+ test) — `include` parsing/validation.
- `src/reference-data/query/manifest-projection.js` (+ test) — internal manifest → public
  response projector, dataset ordering, URL mapping, ETag calculation.
- `src/reference-data/query/query-service.js` (+ test) — `createQueryService({ store })` →
  `{ getManifest }`, the Query Module's first real use case.
- `src/reference-data/controller/manifest-controller.js` (+ test) — `createManifestController`:
  bearer-token extraction, authentication/authorisation, conditional-request handling, response
  headers. No try/catch — errors propagate to the existing global `error-response` plugin.
- `src/routes/manifest.js` (+ registration test) — thin production route wiring, matching the
  existing `routes/health.js`/`routes/readiness.js` convention.
- `src/routes/manifest.test.js` — Hapi `server.inject` integration tests (200, filtered 200, 400,
  304, 401, 403, 503) using stubbed Query/Authentication dependencies at a distinct test path (the
  real production route is exercised separately by `manifest-registration.test.js`).

## Files modified

- `src/reference-data/query/index.js` — composes the real `query` singleton
  (`createQueryService({ store: inMemoryStore })`); removed the Step 02 `{ name: 'query' }`
  placeholder marker.
- `src/reference-data/controller/index.js` — re-exports `createManifestController`; the
  `controller = { name: 'controller' }` boundary marker is unchanged (still an accurate module
  identity marker, not a single-route object).
- `src/plugins/router.js` — registers the `manifest` route alongside `health`/`readiness`.
- `src/reference-data/reference-data-components.test.js` — replaced the `query` placeholder
  assertion with a dedicated contract-shape test (`Object.keys(query) === ['getManifest']`),
  matching the pattern already used for `cacheRefresh`/`inMemoryStore`/`persistence`.
- `README.md` — added an API endpoints table entry and a Manifest API section.

## Tests

24 new/changed test files touched; +6 new test files, 828 tests passing (0 regressions), 6
Floci-gated integration tests still skipped without Docker, coverage 97.37% statements.

## Verification

```
npm run lint      # pass, 0 problems
npm test           # TZ=UTC vitest run --coverage — 828 passed, 6 skipped, 0 failed
```

Regression-checked: `architecture-boundaries.test.js` (S3 SDK / auth-client import boundaries),
`server.test.js` (common API behaviour), cache-refresh/in-memory-store/persistence suites — all
unaffected.

## Security / privacy

- Bearer token is only forwarded to `authenticationClient.authenticate`; never logged.
- `include` length/count bounded before any dataset-registry lookup.
- No dynamic `import()`/object-path construction from user input; dataset URLs come from the
  fixed `DATASET_ROUTE_PATHS` registry only.
- No S3 object keys, bucket names, or Floci endpoints ever appear in a manifest response
  (verified by a dedicated projection test asserting the serialised body never matches
  `checksum|objectRef|bucket|floci|s3:`).
- `304` responses never serialise a body.

## Deferred

- OpenAPI documentation (no OpenAPI spec exists anywhere in this repository yet; deferred to
  Step 31 per the master plan).
- All dataset-specific query/search endpoints (Steps 15–20).
- Metrics emission (hooks not yet wired anywhere in the repository; deferred to Step 25).
- The stale `src/common/domain/manifest.js` JSDoc property names (`collectionVersion`,
  `lastModifiedAt`) that don't match the real Step 04 schema/runtime shape (`version`,
  `lastModified`) — a pre-existing documentation-only inconsistency, left unchanged as
  out-of-scope for this step.

## Deviations from plan

None. All decisions above were flagged as required explicit choices by the Step 14 prompt itself
(filtered-manifest ETag policy, `include` error code, `map-ports` treatment) and resolved using
the prompt's own stated heuristics/existing repository conventions, not silent invention.
