# Step 20 — Completion Summary: Map-Location Query Endpoints

## Plan

[Step 20-implement-map-location-query-endpoints-plan.md](./Step%2020-implement-map-location-query-endpoints-plan.md)
— records all 6 owner-approved decisions verbatim (2026-09-16), resolving every
casing/matching/search-field/geometry-intersection/error-handling ambiguity before
implementation, per the same no-inference discipline established in Step 19.

## Endpoints

```
GET /api/v1/reference-data/map/land
GET /api/v1/reference-data/map/statistical-areas
GET /api/v1/reference-data/map/statistical-areas/{id}
```

`map/land` intentionally has no item route (per owner decision #6). `map/ports`
(Step 18) is untouched and not duplicated.

## Owner-approved decisions implemented exactly

1. `code` filter (statistical areas): exact, case-insensitive, trimmed — never
   substring, never a GUID lookup.
2. `parentCode` filter (statistical areas): exact, case-insensitive; a `null`
   `parentCode` never matches any filter value; no hierarchy inference, expansion,
   or recursion.
3. General text search: `map-statistical-areas` searches `name`, `code`, `areaType`,
   `parentCode`, `parentName`; `map-land` searches `name` only (its schema has no
   other text fields).
4. Bounding-box intersection is a **true geometric Polygon/MultiPolygon ∩ bbox
   test**, implemented as pure JS with no new dependency — vertex-in-bbox,
   bbox-corner-in-polygon, boundary-touching segment intersection, and holes (a
   bbox corner strictly inside a hole is not an intersection with the surface; the
   hole boundary itself still counts) are all handled. The bounding-box envelope
   is used only as an early-rejection optimisation, never as the final result and
   never producing a false negative.
5. Malformed canonical geometry encountered during a query fails the **entire
   request** with `SERVICE_ERROR_CODES.INTERNAL_ERROR` (→ 500) — never silently
   excludes the feature, never mutates active state, never triggers a refresh.
   Malformed **request** bounding boxes remain unchanged 400s via the existing
   `bounding-box.js` validation.
6. Confirmed and preserved: `bounding-box.js` reused unchanged; both endpoints are
   GeoJSON-only (no `view` parameter); no pagination; no `/map/land/{id}`;
   `map-land` = query + bbox only; `map-statistical-areas` = query + code +
   parentCode + bbox; neither schema has an `active` field so no active-state
   filtering is applied; statistical-area item lookup is GUID-only;
   `map-ports` (Step 18) is untouched.

## Design note superseding a Step 18 assumption

Step 18's recorded assumption was that all derived/non-authoritative GeoJSON
layers (including map-land/map-statistical-areas) would bypass the generic
collection query engine like `map-ports` does. After the owner's Step 20 decisions,
map-land and map-statistical-areas instead run through the **existing generic
`createQueryConfiguration`/collection-query-engine pipeline** (via `customFilters`
for `bbox` and `exactFilters` for `code`/`parentCode`), because — unlike
`map-ports` — they need standard filter/search composition without any bespoke
per-feature business projection. `map-ports` itself remains on its dedicated
non-generic path, unchanged. Repo memory has been updated to record this
correction so future steps don't re-derive the old assumption.

## Files created

- `src/reference-data/query/geometry-intersection.js` (+ test — 29 tests, pure
  polygon/multipolygon ∩ bounding-box functions, no mutation, no dependency)
- `src/reference-data/query/map-land-query-configuration.js` (+ test — 8 tests)
- `src/reference-data/query/map-statistical-areas-query-configuration.js`
  (+ test — 15 tests)
- `src/reference-data/controller/geojson-collection-route-controller.js`
  (+ test — 5 tests) — sibling to (not a modification of)
  `collection-route-controller.js`; returns `application/geo+json`
  FeatureCollection/Feature bodies instead of the plain JSON envelope.
- `src/routes/map-land.js` (+ test — 7 tests, collection route only)
- `src/routes/map-statistical-areas.js` (+ test — 10 tests, collection + item routes)
- `design/github-prompts/Step 20-implement-map-location-query-endpoints-plan.md`

## Files modified

- `src/plugins/router.js` — registers `mapLand`, `mapStatisticalAreasCollection`,
  and `mapStatisticalAreasItem` alongside all prior routes. No other shared file
  was modified; `bounding-box.js`, `collection-query-engine.js`,
  `query-configuration.js`, `query-request-parser.js`, `collection-query-service.js`,
  and every Step 18 map-ports file are unchanged.

## Tests

Geometry intersection (segments, ring boundary, polygonal surface with holes,
polygon vs bbox in every required case — inside/outside/partial/boundary/disjoint/
hole variants — MultiPolygon, feature dispatch, immutability, malformed-geometry
error code — 29 tests), map-land query configuration (full collection, name-only
search, true bbox intersection, invalid bbox, malformed-geometry request failure,
unsupported param rejection, no pagination, no mutation — 8 tests),
map-statistical-areas query configuration (code/parentCode exact case-insensitive
filters incl. null-never-matches, 5-field general search, bbox filtering, AND
combination, malformed-geometry failure, GUID item retrieval, no pagination —
15 tests), GeoJSON controller (200 + `application/geo+json`, 304 on matching ETag,
401 without a token, bare-Feature item response, `reference_item_not_found`
propagation — 5 tests), route integration for both endpoints (GeoJSON response,
content type, general search, bbox filtering incl. disjoint case, invalid bbox
→ 400, malformed persisted geometry → safe 500, missing token → 401, ETag → 304,
GUID lookup, unknown GUID → 404, invalid GUID → 400 — 17 tests across both files).

## Verification (exact requested order)

```
1. Focused spatial utility tests
   geometry-intersection.test.js                                    — 29 passed
2. Map query-configuration tests
   map-land-query-configuration.test.js
   map-statistical-areas-query-configuration.test.js                 — 28 passed
3. Map route integration tests
   routes/map-land.test.js
   routes/map-statistical-areas.test.js                              — 17 passed
   (geojson-collection-route-controller.test.js also run alongside   —  5 passed)
4. Step 18 bounding-box and map-port regression
   bounding-box.test.js, map-ports-projector.test.js,
   map-ports-query-service.test.js, routes/map-ports.test.js,
   routes/ports.test.js                                              — 42 passed
5. Step 15 common query-engine regression
   collection-query-engine.test.js, collection-query-service.test.js,
   collection-query-service.integration.test.js,
   query-configuration.test.js, query-request-parser.test.js         — 69 passed
6. Steps 16-19 regression
   routes/vessels.test.js, routes/gears.test.js, routes/species.test.js — 39 passed
7. Complete Docker-free test suite (npm test)
   1200 passed | 6 skipped (129 files, 1 skipped)                    — 0 failed
8. Coverage — 96.27% statements / 91.86% branches / 95.88% functions / 96.18% lines
9. npm run lint                                                      — clean
10. Prettier — 7 Step 20 files needed --write (geometry-intersection.js/.test.js,
    geojson-collection-route-controller.test.js, map-land.test.js,
    map-statistical-areas.js/.test.js, the Step 20 plan .md); reverified clean;
    lint + affected tests rerun after formatting — all still pass
11. Build — no build script exists for this Node service; verified equivalently by
    booting the real Hapi server (`createServer()` → `initialize()` → route table
    inspection → `stop()`) and confirming `map/land`, `map/statistical-areas`,
    `map/statistical-areas/{id}` are registered with no startup errors
12. Defra SonarCloud review — 0 findings on all 13 Step 20 source/test files
```

## Defra SonarCloud review

`sonarqube_analyze_file` run against all 13 Step 20 files (6 source + 6 test files

- the modified `router.js`) — **no findings** on any of them. Security Hotspot
  listing requires SonarQube Connected Mode, which is not configured locally;
  pending CI verification, same caveat as Steps 17-19.

## Unrelated pre-existing warnings (not touched)

Repo-wide `format:check` continues to report pre-existing warnings across earlier
steps, README, and design docs/conversation logs — none are Step 20 files and none
were modified.

## Confirmations

- No database, Redis, or new dependency introduced.
- No direct S3/Floci access; no direct Authentication Service call from map routes
  (reuses `requireReadAccess` exactly as Steps 16-19 do).
- `map-ports` (Step 18) was not touched, not duplicated, and remains on its
  dedicated non-generic path.
- No pagination, no `view` parameter, and no `/map/land/{id}` route were added,
  per the owner's explicit decisions.
- Malformed **canonical** geometry fails the whole request (500,
  `internal_error`) without mutating active state or triggering a refresh;
  malformed **request** bounding boxes remain 400s, unchanged from Step 18.
- Envelope-based early rejection in `geometry-intersection.js` never produces a
  false negative — verified by dedicated tests asserting envelope overlap is used
  only as an optimisation ahead of the exact geometric test.
