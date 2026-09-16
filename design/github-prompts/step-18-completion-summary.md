# Step 18 — Completion Summary: Port Query Endpoints, Location Search, and Map Projection

## Plan

[Step 18-implement-port-query-endpoints-location-search-and-map-projection-plan.md](./Step%2018-implement-port-query-endpoints-location-search-and-map-projection-plan.md)

## Owner-directed design simplification (applied, not a deviation)

Radius search is one explicit composite operation, not three independent
`customFilters` with no-op predicates:

- Added a small, additive `compositeFilters` mechanism to the Step 15 shared
  configuration/parser/engine (`query-configuration.js`, `query-request-parser.js`,
  `collection-query-engine.js`): a named filter declares multiple `params`, is
  rejected with `invalid_request` if only some are supplied, `parse(rawQuery)` runs
  exactly once when all are present, and one `predicate(record, value)` runs in the
  normal filter pipeline (after exact/custom filters, before free text/sort/paginate).
  This is fully backward-compatible — no existing dataset (vessels/gears) needed any
  change.
- Ports registers exactly one composite filter, `location` (`latitude`, `longitude`,
  `radiusKm` → one `{latitude,longitude,radiusKm}` object → Haversine predicate).
- `map-ports` is **not** routed through the generic engine at all. It is a dedicated
  pure projection (`map-ports-projector.js`) plus a small query use case
  (`map-ports-query-service.js`) that reads the active `ports` snapshot directly from
  the In-Memory Data Store.
- One shared `bounding-box.js` utility (`parseBoundingBox`/`isPointInBoundingBox`) is
  used for `map-ports` now and is deliberately left reusable, unmodified, for Step 20.
- One shared `result-etag.js` utility was extracted from `collection-query-service.js`
  (pure refactor, identical output) so the dedicated map-ports path doesn't duplicate
  the hashing approach.

## Endpoints

```
GET /api/v1/reference-data/ports
GET /api/v1/reference-data/ports/{id}
GET /api/v1/reference-data/map/ports
```

## Confirmed decisions (owner instruction, not re-litigated)

- Port code: exact, **case-sensitive**, leading zeros preserved.
- Country code: case-insensitive.
- Radius boundary: inclusive. Radius: must be `>0` and `<=1000km` (the `>0` floor is
  the smallest safe default for the one behaviour the original prompt left
  undefined — no requirement defines a zero-radius search).
- Bounding boxes crossing the antimeridian: rejected (`invalid_request`).
- `map-ports` is never independently persisted and never routed through the generic
  query engine.

## Files created

- `src/reference-data/query/location-search.js` (+ test) — lat/lon/radius parsing,
  Haversine distance, `matchesLocationSearch`, `parseLocationSearch`.
- `src/reference-data/query/bounding-box.js` (+ test) — shared bbox parser + point
  containment (reused unmodified by Step 20).
- `src/reference-data/query/result-etag.js` (+ test) — extracted deterministic ETag
  helper.
- `src/reference-data/query/ports-query-configuration.js` (+ test).
- `src/reference-data/query/map-ports-projector.js` (+ test).
- `src/reference-data/query/map-ports-query-service.js` (+ test).
- `src/reference-data/controller/map-ports-controller.js` — dedicated GeoJSON
  controller (not built on the generic JSON envelope controller).
- `src/routes/ports.js` (+ test), `src/routes/map-ports.js` (+ test).
- `design/github-prompts/Step 18-implement-port-query-endpoints-location-search-and-map-projection-plan.md`.

## Files modified

- `src/reference-data/query/query-configuration.js` — adds `compositeFilters`
  (validated at construction: non-empty `params`, function checks, no param/name
  collisions with existing filters).
- `src/reference-data/query/query-request-parser.js` — parses/validates composite
  filters (all-or-none, single parse call).
- `src/reference-data/query/collection-query-engine.js` — applies composite filters
  in the pipeline.
- `src/reference-data/query/collection-query-service.js` — reuses the extracted
  `result-etag.js` helper (no behavioural change).
- `src/reference-data/query/index.js` — composes `getMapPorts` into the production
  `query` singleton; re-exports new factories.
- `src/plugins/router.js` — registers ports/map-ports routes.
- `src/reference-data/reference-data-components.test.js` — updated the `query`
  contract-shape assertion to include `getMapPorts`.
- `src/reference-data/query/collection-query-engine.test.js`,
  `query-configuration.test.js`, `query-request-parser.test.js` — extended with
  composite-filter coverage (this additive change touched shared Step 15 test
  fixtures, which is expected/necessary, not a scope violation).

## Tests

Location-search (parsing, boundaries, distance, radius inclusion/exclusion), bounding
box (parsing, antimeridian rejection, point containment), result-etag (determinism),
ports query configuration (exact/text/sort/radius, AND-combination, mobile
projection), map-ports projector (feature shape, coordinate order, missing-coordinate
exclusion, bbox filtering, immutability), map-ports query service (unavailable
dataset, unsupported params), and full Hapi route integration suites for both
`ports.test.js` and `map-ports.test.js` (200/400/401/404/304/503, radius search,
GeoJSON content type).

## Verification

```
npm run lint       # clean, 0 problems
npm test            # 1049 passed, 6 skipped, 0 failed
npx prettier --check <every Step 18 file>   # all pass (16 files needed --write, applied and reverified)
npm run format:check (repo-wide)            # 27 pre-existing warnings, none in Step 18 files
```

Coverage: 96.29% statements / 91.26% branches overall; all new Step 18 files
individually verified above ~93% (ports-query-configuration.js reached 100% after
adding search/sort coverage tests).

## Defra SonarCloud review

`sonarqube_analyze_file` run against every Step 18 source file (`location-search.js`,
`bounding-box.js`, `result-etag.js`, `ports-query-configuration.js`,
`map-ports-projector.js`, `map-ports-query-service.js`, `map-ports-controller.js`,
`routes/ports.js`, `routes/map-ports.js`) plus the three modified shared engine files
— **no findings** on any of them. Security Hotspot listing requires SonarQube
Connected Mode, not configured locally; pending CI verification (same caveat as
Step 17).

## Confirmations

- No Step 19/20 files were created or modified (Step 20 reuses `bounding-box.js`
  as-is, per design, but no Step 20-specific file was touched in this pass).
- No database or Redis introduced.
- No direct S3/Floci access from Query Module or controllers; no direct
  Authentication Service call from ports/map-ports routes.
- `port` GUID remains the resource ID; port code remains a separate business
  identifier; `map-ports` is derived and not independently persisted or uploadable.

## Remaining risks / decisions

- `radiusKm <= 0` rejection is a documented smallest-safe-default for a behaviour the
  original prompt explicitly left ambiguous; flagged for owner awareness.
- SonarCloud Connected Mode not configured locally — full CI-based Sonar verification
  remains pending.
