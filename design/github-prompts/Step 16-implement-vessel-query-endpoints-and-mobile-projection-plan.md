# Step 16 — Implementation Plan: Vessel Query Endpoints and Mobile Projection

Treated as already approved per this step's operating mode. Builds directly on the Step 15
common query engine; no engine changes were required.

## Endpoints

`GET /api/v1/reference-data/vessels`, `GET /api/v1/reference-data/vessels/{id}`.

## Design

- `vessels-query-configuration.js`: exact identifier filters (cfr, uvi, mmsi, ircs,
  externalMark, registrationNumber — MMSI case-sensitive/exact, the rest
  case-insensitive per the Step 09 duplicate-detection casing convention already
  recorded in repo memory); free-text search across name/namePln/all identifiers;
  sort fields name/namePln/cfr/externalMark/registrationNumber/lengthOverallMetres;
  `activeField` treats the free-form `status` string's literal `"active"` value as
  active (Step 04 does not define a boolean active flag for vessels).
- `vessels-mobile-projector.js`: `pln` = externalMark → registrationNumber → null;
  `displayName` = non-empty `namePln` → `${name} ${pln}` → `name`.
- Reuses the generic `createCollectionRouteController` (Step 15 follow-on shared
  helper) for both routes — no vessel-specific controller code was required beyond
  configuration and projection.
- Response envelope (established here, reused by Steps 17-19):
  `{ dataset, collectionId, schemaVersion, version, view, total, offset?, limit?, items }`
  for collections; the item route returns the item directly.

## Files created

- `src/reference-data/query/vessels-query-configuration.js` (+ test)
- `src/reference-data/query/vessels-mobile-projector.js` (+ test)
- `src/routes/vessels.js` (+ integration test)
- `src/reference-data/controller/collection-route-controller.js` and
  `src/reference-data/controller/read-access.js` (shared infrastructure, extracted
  from the Step 14 manifest controller; `manifest-controller.js` refactored to reuse
  `read-access.js` with no behavioural change — its existing tests still pass).

## Files modified

- `src/plugins/router.js` — registers the two vessel routes.

## Decisions

- Business identifiers remain in `identifiers.*`; the mobile view exposes only
  `id, name, pln, cfr, displayName, lengthOverallMetres` — no `homePort`, no UVI/MMSI/
  IRCS/registrationCountryCode/status in the default mobile summary.
- `{id}` is always the GUID; no business identifier is ever accepted there — enforced
  automatically because `getItemById` always matches on `config.getGuid`.

## Tests

Configuration wiring, mobile projector (PLN/displayName rules, immutability), and a
Hapi `server.inject` integration suite (canonical/mobile/search/item/404/400/401).

## Deferred

Gear, port, species, and map endpoints (Steps 17-20).
