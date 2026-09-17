# Step 20 — Implementation Plan: Map-Location Query Endpoints

Treated as already approved per the owner's explicit decisions (2026-09-16), recorded
verbatim below.

## 1. Owner-approved decisions (authoritative for this step)

1. **`code` (statistical-area code) filter**: exact, case-insensitive. Trimmed per the
   existing Step 15 input convention. Canonical value never mutated. Never substring
   matching. Never treated as a GUID.
2. **`parentCode` filter**: exact, case-insensitive. Canonical value never mutated.
   No inference from an area-code prefix, no requirement that the parent feature
   exist in the collection, no hierarchy resolution/expansion, no recursive
   descendants. A `null` `parentCode` never matches.
3. **General text search (statistical areas)** — broad option: `properties.name`,
   `properties.code`, `properties.areaType`, `properties.parentCode`,
   `properties.parentName`, using the unmodified Step 15 matching behaviour. Never
   searches GUIDs, geometry, or coordinates; never serialises whole features. Null/
   missing `parentCode`/`parentName` handled safely (the engine's existing
   `typeof value === 'string'` guard already skips non-string accessor results). A
   feature matching on multiple fields is still returned once (the engine filters,
   it does not accumulate per-field duplicates). **`map-land`**: general search is
   limited to `properties.name` only — the schema has no `code`/`areaType`/
   `parentCode`/`parentName` properties to search.
4. **Polygon/MultiPolygon ↔ bounding-box intersection** — Option 1: true geometric
   intersection, pure JavaScript, no new dependency. Implemented as small, focused,
   testable functions (see §3.1). Boundary contact counts as intersection. Holes are
   respected (a bbox corner strictly inside a hole, and not on the hole's boundary,
   does not establish intersection with the polygonal surface). A feature's own
   axis-aligned envelope may only be used as an early-rejection optimisation (a
   non-overlapping envelope guarantees no intersection — never a false negative).
5. **Malformed canonical geometry encountered during a query**: fails the complete
   request safely via the existing `SERVICE_ERROR_CODES.INTERNAL_ERROR` (→ `500`,
   already the safe generic mapping in `http-status.js`), never silently excludes the
   feature, never mutates active state, never triggers a refresh. Malformed _request_
   bounding boxes remain a `400` client error (existing `bounding-box.js` behaviour,
   unchanged) — this decision is scoped only to canonical geometry already active in
   memory. In this implementation, geometry is only evaluated when a `bbox` filter is
   supplied (that is the only code path that touches feature geometry); a `code`/
   `query`-only request never parses geometry and is unaffected.
6. **Confirmed reused decisions**: `bounding-box.js` (Step 18) reused unmodified —
   same `minLongitude,minLatitude,maxLongitude,maxLatitude` order, inclusive
   boundaries, antimeridian rejection. Map endpoints are GeoJSON-only (no `view`
   parameter). No pagination on map layers. No `map-land/{id}` route. `map-land`
   supports `query` + `bbox` only. `map-statistical-areas` supports `query`, `code`,
   `parentCode`, `bbox`. No active-state filtering (neither schema has an `active`
   property). Statistical-area item lookup is GUID-only. `map-ports` (Step 18)
   remains untouched and is not duplicated.

## 2. Repository state discovered

- No Step 20 code exists yet.
- Canonical schemas (Step 04, unchanged): `map-land` features have
  `properties: {id, name?}`; `map-statistical-areas` features have
  `properties: {id, code, name, areaType, parentCode?, parentName?, areaKm2?,
centroid?}`. Both are `FeatureCollection`s with `Polygon`/`MultiPolygon` geometry
  (`common/schemas/fragments/geojson.js`).
- Step 18 already built `bounding-box.js` (`parseBoundingBox`, `isPointInBoundingBox`)
  specifically to be reused, unmodified, here.
- No polygon-intersection utility exists anywhere in the repository.
- Step 15's `createCollectionRouteController` only builds the generic JSON envelope
  (`{dataset, collectionId, ..., items}`) — unsuitable for a bare GeoJSON
  `FeatureCollection`/`Feature` response. Rather than modifying that shared file
  (which is also used, unchanged, by vessels/gears/ports and must not regress), this
  step adds a **new, sibling** `geojson-collection-route-controller.js`, following the
  exact precedent already set by Step 18's dedicated `map-ports-controller.js` (a new
  file, not a modification of shared infrastructure). `collection-route-controller.js`
  is not touched.
- `map-land`/`map-statistical-areas` are ordinary persisted, queryable, non-derived
  datasets (unlike `map-ports`), so they _do_ go through the unmodified Step 15
  `createCollectionQueryService`/`createQueryConfiguration`/engine — only `map-ports`
  uses the dedicated non-generic path (Step 18 decision, preserved).

## 3. Design

### 3.1 `geometry-intersection.js`

Focused, pure, non-mutating functions:

- `pointInOrOnBoundingBox(point, bbox)` — thin wrapper reusing
  `isPointInBoundingBox` from `bounding-box.js` (no reimplementation).
- `boundingBoxCorners(bbox)` — the four corners as `[lon, lat]` points.
- `segmentsIntersect(p1, p2, p3, p4)` — orientation-based test with explicit
  collinear/boundary-touch handling (the standard robust algorithm).
- `isPointOnRingBoundary(point, ring)` — true when `point` lies on any ring edge.
- `isPointStrictlyInsideRing(point, ring)` — even-odd ray-casting test.
- `isPointInLinearRing(point, ring)` — boundary-inclusive: strictly-inside OR
  on-boundary.
- `isPointInPolygonalSurface(point, rings)` — exterior-ring-inclusive AND not
  strictly inside any hole (a point on a hole's boundary is still part of the
  surface).
- `polygonIntersectsBoundingBox(coordinates, bbox)` — combines: (a) any polygon
  vertex (any ring) inside-or-on the bbox; (b) any bbox corner inside the polygonal
  surface; (c) any polygon boundary segment (any ring) intersects any bbox edge.
  Conditions "polygon entirely surrounds bbox" and "bbox entirely surrounds polygon"
  are natural consequences of (a)/(b) respectively — no special-cased branch is
  needed, keeping each function small (Sonar complexity). An envelope-overlap
  pre-check (all ring coordinates' min/max vs the bbox) returns `false` early only
  when envelopes provably do not overlap.
- `multiPolygonIntersectsBoundingBox(coordinates, bbox)` — `some()` over each
  polygon's coordinates.
- `featureGeometryIntersectsBoundingBox(geometry, bbox)` — dispatches on
  `geometry.type` (`Polygon`/`MultiPolygon`); any other type, or any malformed ring/
  position encountered while evaluating, raises `SERVICE_ERROR_CODES.INTERNAL_ERROR`
  (never silently excludes the feature, never returns `false`).

### 3.2 `map-land-query-configuration.js` / `map-statistical-areas-query-configuration.js`

- `format: 'geojson'`, `getGuid: (feature) => feature.id` (the top-level GeoJSON
  identifier — the schema-documented invariant that `properties.id` must equal it is
  a business-validation concern, not a query concern).
- `customFilters.bbox`: `parse` = `parseBoundingBox` (Step 18, reused), `predicate` =
  `featureGeometryIntersectsBoundingBox(feature.geometry, bbox)`.
- Statistical areas additionally register `exactFilters` for `code`/`parentCode`
  (case-insensitive) and the five-field `textSearchFields` from decision 3; map-land
  registers only the `name` text-search field.
- `defaultSort`: `name` ascending (consistent with the established convention
  already used identically by vessels/gears/ports; not one of the flagged
  ambiguities), with the engine's automatic GUID tie-break.
- No `activeField`, no `mobileProjector`, no `prepareRecords` (no denormalisation is
  needed — every filter/search field is a direct, unnested `properties.*` accessor).

### 3.3 `geojson-collection-route-controller.js` (new, sibling to the JSON controller)

`createGeoJsonCollectionRouteController({ config, query, authenticationClient })` →
`{ collectionHandler, itemHandler }`. Reuses `requireReadAccess`,
`matchesIfNoneMatch`, and `CACHE_CONTROL` (all existing, unmodified). Collection
response: `{ type: 'FeatureCollection', metadata: { dataset, collectionId,
schemaVersion, version, crs: 'EPSG:4326', featureCount }, features: result.items }`.
Item response: the bare `Feature` (`result.item`), matching the Step 18 map-ports
convention. Both use `Content-Type: application/geo+json`.

### 3.4 Routes

`src/routes/map-land.js` (collection only) and `src/routes/map-statistical-areas.js`
(collection + item), both built via the new GeoJSON controller factory, registered in
`router.js` alongside the existing routes.

## 4. Files created

- `src/reference-data/query/geometry-intersection.js` (+ test)
- `src/reference-data/query/map-land-query-configuration.js` (+ test)
- `src/reference-data/query/map-statistical-areas-query-configuration.js` (+ test)
- `src/reference-data/controller/geojson-collection-route-controller.js` (+ test)
- `src/routes/map-land.js` (+ test)
- `src/routes/map-statistical-areas.js` (+ test)

## 5. Files modified

- `src/plugins/router.js` — registers the two new routes.

## 6. Explicitly not changed

`bounding-box.js`, `collection-route-controller.js`, `collection-query-engine.js`,
`query-configuration.js`, `query-request-parser.js`, `collection-query-service.js`,
`map-ports-projector.js`/`map-ports-query-service.js`/`map-ports-controller.js`
(Step 18, untouched), canonical schemas, Step 09 validation, Step 10 normalisation.

## 7. Test approach

Geometry utilities: every case in the owner's required spatial-test list (polygon
inside bbox, bbox inside polygon, partial overlap, boundary-only contact, disjoint,
hole cases ×3, MultiPolygon ×3, malformed ring/geometry, immutability, envelope
early-rejection correctness). Query configuration: filters, search, bbox integration,
malformed-geometry failure. Route integration: GeoJSON content type, feature shape,
coordinate order, bbox filtering, 400/500/401/404/304 as applicable. Regression:
Step 15 engine/service, Step 18 bounding-box/map-ports, Steps 16-19 route suites, full
repository suite.

## 8. Deferred

Step 21 onward.
