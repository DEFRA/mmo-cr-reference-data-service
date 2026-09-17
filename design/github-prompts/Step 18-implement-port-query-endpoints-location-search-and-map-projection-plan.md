# Step 18 — Implementation Plan: Port Query Endpoints, Location Search, and Map Projection

Treated as already approved per this step's operating mode and the owner's explicit
simplified-design instruction (2026-09-16), which supersedes the generic
"independent custom filters" approach used as a placeholder pattern in earlier steps.

## 1. Owner-directed design simplification (explicit instruction, not an assumption)

Radius search is **not** modelled as three independent `customFilters` entries with
no-op predicates. Instead:

1. A new, small, generally-useful **composite filter** mechanism is added to the Step 15
   query configuration/parser/engine: a named filter that declares multiple raw query
   parameters (`params: [...]`), is only invoked once all of them are present, is
   rejected (400) if only some are present, and produces one parsed value passed to one
   `predicate(record, value)`. This is strictly additive — the existing single-param
   `customFilters` mechanism (already used by gear's `pairFishing`) is completely
   unchanged, and no dataset (including gears) needs to change.
2. Ports registers exactly one composite filter, `location`, with
   `params: ['latitude', 'longitude', 'radiusKm']`, whose `parse` builds one
   `{ latitude, longitude, radiusKm }` object and whose `predicate` applies the
   Haversine distance test. This runs inside the normal engine pipeline (after exact/
   text filters, before sort/pagination) — i.e. exactly where the engine already runs
   custom filters, with no bespoke ports-only pipeline needed for the JSON `ports`
   dataset.
3. `map-ports` (the derived GeoJSON layer) is **not** routed through the generic
   collection engine at all (per explicit instruction). It is a dedicated, pure
   projection reading the active `ports` snapshot directly from the In-Memory Data
   Store, filtered by an optional bounding box using the same shared bounding-box
   utility that Step 20 will reuse for `map-land`/`map-statistical-areas`.

## 2. Repository state discovered

- No Step 18 code exists yet (verified via `git status`); this is a clean implementation,
  not a recovery.
- Step 15's `createQueryConfiguration`/`parseCollectionQuery`/`runCollectionQuery` support
  `exactFilters`, `textSearchFields`, `customFilters`, `sortFields`, `activeField`,
  `mobileProjector`, `prepareRecords`, `buildContext` (the last two added for gears,
  Step 17). This step adds `compositeFilters` alongside these, following the same
  validate-at-construction / parse-once / predicate-in-pipeline shape.
- `collection-query-service.js` computes a deterministic per-request ETag inline; this
  step extracts that into `result-etag.js` (pure function, identical hash inputs/output)
  so the new dedicated map-ports query path can reuse it without depending on the
  generic engine.
- Canonical port schema (Step 04): `{ id, code, name, countryCode, coordinate: {latitude,
longitude} | null, active }`.

## 3. Design

### 3.1 `location-search.js`

- `parseLatitude`/`parseLongitude`/`parseRadiusKm`: strict decimal parsing + range
  validation (`latitude` ∈ [-90, 90], `longitude` ∈ [-180, 180], `radiusKm` ∈ (0, 1000]).
  `radiusKm <= 0` is rejected (no approved requirement defines zero-radius behaviour;
  treating it as an invalid request is the smallest safe default, consistent with how
  `limit=0` and `vesselLengthMetres<=0` are already rejected elsewhere).
- `calculateHaversineDistanceKm(a, b)`: standard Haversine formula, named
  `EARTH_RADIUS_KM` constant, no coordinate mutation.
- `matchesLocationSearch(coordinate, location)`: `false` when `coordinate` is
  `null`/`undefined` (ports without coordinates never match a radius search); otherwise
  `distance <= radiusKm` (**inclusive** boundary, per owner instruction).

### 3.2 `query-configuration.js` / `query-request-parser.js` / `collection-query-engine.js`

(small, additive extension)

- Configuration: `compositeFilters` (default `[]`), each
  `{ name, params: string[], parse: (rawQuery) => value, predicate: (record, value) =>
boolean }`. Validated at construction: non-empty `params`, `parse`/`predicate` are
  functions, no name/param collisions with `exactFilters`/`customFilters`/other
  `compositeFilters`.
- Parser: every composite filter's `params` are added to the recognised-key set. If none
  of a composite filter's params are present, it contributes nothing. If some but not
  all are present, `invalid_request` ("latitude, longitude, and radiusKm must be
  supplied together"). If all are present, `parse(rawQuery)` runs once and the result is
  stored in `parsedRequest.compositeFilterValues[name]`.
- Engine: `applyCompositeFilters` runs immediately after `applyCustomFilters` and before
  free-text search (same position custom filters already occupy relative to the rest of
  the pipeline), using AND semantics with every other filter stage.

### 3.3 `ports-query-configuration.js`

- Exact filters: `code` (port code, **case-sensitive** exact match, leading zeros
  preserved as plain strings — never parsed as numbers), `countryCode`
  (case-**in**sensitive exact match).
- Composite filter: `location` (see §3.1/3.2).
- Text search fields: name, code, countryCode (case-insensitive substring).
- Sort fields: name, code, countryCode; default sort by name.
- `activeField`: `port.active`.
- `mobileProjector`: `{ id, code, name, displayName: name, coordinate }` —
  `coordinate` is passed through as-is (`null` when absent), matching the canonical
  schema's own representation of a missing coordinate rather than inventing an
  omission rule the schema doesn't already use.

### 3.4 `map-ports-projector.js` + `map-ports-query-service.js` (dedicated, non-generic path)

- `projectPortsToMapPorts(collection, metadata, { bbox } = {})`: filters to ports with a
  valid `coordinate`, maps each to a GeoJSON `Feature` (`id`, `properties: {id, code,
name}`, `geometry: {type: 'Point', coordinates: [longitude, latitude]}`), optionally
  restricted by `isPointInBoundingBox`, wrapped in a `FeatureCollection` with
  `metadata: { dataset: 'map-ports', sourceDataset: 'ports', sourceCollectionId,
version, crs: 'EPSG:4326', featureCount }`. Never mutates the canonical `ports`
  collection; `map-ports` is not written back to the store or the manifest.
- `createMapPortsQueryService({ store })` → `{ getMapPorts(rawQuery) }`: loads the active
  `ports` snapshot directly (same "unavailable → `reference_data_unavailable`" rule as
  the generic engine), parses an optional `bbox` query parameter via the shared
  `bounding-box.js` parser, projects, and computes a deterministic ETag via the
  extracted `result-etag.js` helper.

### 3.5 `bounding-box.js` (shared utility, reused by Step 20)

- `parseBoundingBox(rawBbox)`: exactly four finite numbers
  `minLongitude,minLatitude,maxLongitude,maxLatitude`; longitude/latitude range
  validation; `minLatitude <= maxLatitude` required; **antimeridian-crossing boxes
  (`minLongitude > maxLongitude`) are rejected for now** (per owner instruction) with
  `invalid_request`.
- `isPointInBoundingBox(longitude, latitude, bbox)`: inclusive on all four edges.
  (Polygon/MultiPolygon intersection is explicitly deferred to Step 20 and not
  implemented here.)

### 3.6 Routes

- `src/routes/ports.js`: `portsCollection`/`portsItem`, built via the existing
  `createCollectionRouteController` (no post-processing needed — canonical/mobile JSON
  only).
- `src/routes/map-ports.js`: a small dedicated handler (auth → `getMapPorts` →
  conditional `ETag`/`304` → `application/geo+json` body), since its response shape
  (bare `FeatureCollection`) and content type differ from the generic JSON envelope and
  it deliberately does not go through `createCollectionRouteController`.

## 4. Files created

- `src/reference-data/query/location-search.js` (+ test)
- `src/reference-data/query/bounding-box.js` (+ test)
- `src/reference-data/query/result-etag.js` (+ test)
- `src/reference-data/query/ports-query-configuration.js` (+ test)
- `src/reference-data/query/map-ports-projector.js` (+ test)
- `src/reference-data/query/map-ports-query-service.js` (+ test)
- `src/routes/ports.js` (+ test)
- `src/routes/map-ports.js` (+ test)

## 5. Files modified

- `src/reference-data/query/query-configuration.js` — adds `compositeFilters`.
- `src/reference-data/query/query-request-parser.js` — parses/validates composite
  filters (all-or-none).
- `src/reference-data/query/collection-query-engine.js` — applies composite filters.
- `src/reference-data/query/collection-query-service.js` — reuses the extracted
  `result-etag.js` helper (no behavioural/output change).
- `src/reference-data/query/index.js` — composes `mapPortsQuery` singleton and
  re-exports the new factories/utilities.
- `src/plugins/router.js` — registers the ports and map-ports routes.
- `src/reference-data/reference-data-components.test.js` — updates the `query`
  contract-shape assertion to include the new `getMapPorts` method.

## 6. Confirmed decisions (per owner instruction, not re-litigated)

- Port code: exact, case-sensitive.
- Country code: case-insensitive.
- Radius boundary: inclusive.
- Maximum radius: 1000 km (minimum: must be `> 0`).
- Bounding boxes crossing the antimeridian: rejected for now.
- `map-ports` never persisted, never routed through the generic engine.

## 7. Test approach

Unit: location-search parsing/validation/distance/boundary; bounding-box parsing/point
containment/antimeridian rejection; result-etag determinism; ports query configuration
(filters, search, sort, radius search including boundary and no-coordinate exclusion);
map-ports projector (feature shape, coordinate order, missing-coordinate exclusion, bbox
filtering, immutability, no independent persistence). Integration: `ports.test.js` and
`map-ports.test.js` following the `vessels.test.js`/`gears.test.js` convention (stub
auth + real in-memory store + real query wiring through a real Hapi server). Docker-free
throughout.

## 8. Deferred

Species (Step 19) and map-land/map-statistical-areas (Step 20) — the bounding-box
utility built here is deliberately shaped for Step 20 to reuse without modification for
its point/parse concerns, but polygon intersection is explicitly out of scope here.
