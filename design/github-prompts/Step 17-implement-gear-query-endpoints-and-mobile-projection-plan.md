# Step 17 — Implementation Plan: Gear Query Endpoints and Mobile Projection

Treated as already approved per this step's operating mode. This plan is written to
accurately describe the implementation already present in the working tree (recovered
after an interrupted session), not a fresh design — no implementation behaviour is
changed to match this document; this document is corrected to match the code.

## 1. Repository state discovered

- Step 15 (common query engine) and Step 16 (vessels) are implemented and verified.
- The shared `createCollectionRouteController` (Step 15/16 follow-on) already supports
  `postProcessCollectionBody`/`postProcessItemBody` hooks and `getProjectionContext`,
  used here without modification.
- `createCollectionQueryService` (Step 15) already merges, per request, a `context`
  object from `config.buildContext(collection)` + caller-supplied projection context +
  `parsedRequest.customFilterValues`, and returns this `context` on both
  `queryCollection`/`getItemById` results. Gears is the first dataset to rely on this
  mechanism (for vessel-length band resolution and category/characteristic lookups) —
  no engine changes were required.
- Canonical gear schema (Step 04): `gears` collection has `categories[]`,
  `characteristics[]`, and `items[]`; each item has `categoryId`, `pairFishing`,
  `applicableCharacteristics[]` (each with `characteristicId`, `fixed`, `required`,
  `vesselLengthApplicability[]`), and `active`.
- `VESSEL_LENGTH_BAND` (`under-10m`, `10-to-12m`, `over-12m`) already exists in
  `reference-data/validation/vessel-length-bands.js` (Step 09); reused directly rather
  than re-declared.

## 2. Design (as implemented)

### 2.1 `vessel-length-band.js`

- `resolveVesselLengthBand(vesselLengthMetres)`: `< 10` → `under-10m`; `>= 10 and <= 12`
  → `10-to-12m`; `> 12` → `over-12m`. Rejects non-finite/non-positive input with
  `invalid_request`.
- `parseVesselLengthMetres(rawValue)`: strict decimal-string parsing (rejects units,
  partial numerics, non-numeric strings) for the `vesselLengthMetres` query parameter.

### 2.2 `gears-mobile-projector.js`

- `buildGearLookupIndexes(collection)`: builds `categoriesById`/`characteristicsById`
  `Map`s once per collection snapshot.
- `projectGearToMobile(gear, { categoriesById, characteristicsById, vesselLengthBand })`:
  resolves the category (fails safely with `internal_error` if unresolved — a condition
  Step 09 business validation should already prevent), selects applicable
  characteristics (all of them when no band is supplied; only band-matching ones
  otherwise), and maps them to `requiredMeasurementIds`/`variableMeasurementIds`.
  **Fixed/required mapping decision (preserved, not reinterpreted):**
  `fixed === true && required === true` → `requiredMeasurementIds`; every other
  combination (`fixed === false`, or `fixed === true && required === false`) →
  `variableMeasurementIds`. This is the smallest, non-data-losing mapping for the one
  combination (`fixed === true && required === false`) that the approved prompt did not
  define a distinct field for, and is applied consistently rather than silently dropped.
  A gear with zero applicable characteristics for a selected band is retained with empty
  `requiredMeasurementIds`/`variableMeasurementIds` arrays (vessel-length applicability
  is a characteristic-level concept in the Step 04 schema, not a gear-level one).
- `projectMeasurement(characteristic)`: maps `id/code/name/dataType/unit/minValue/maxValue`
  to `id/code/label/kind/unit/minimumValue/maximumValue`.
- `collectPageMeasurements(mobileItems, characteristicsById)`: de-duplicated,
  page-specific measurement list (only characteristics referenced by the returned page),
  built from an internal `__referencedCharacteristicIds` field attached per mobile item.
- `stripInternalProjectionFields(mobileItem)`: removes `__referencedCharacteristicIds`
  before the item reaches the public response (done once, at the controller layer, for
  both the collection page and the single-item route).

### 2.3 `gears-query-configuration.js`

- `prepareRecords(records, collection)`: per-request, non-mutating enrichment adding
  `_categoryCode`, `_categoryName`, `_searchableCharacteristics` (joined
  name+code strings) to each gear so exact filters/search/sort can use plain field
  accessors without embedding lookup logic in the shared engine.
- `buildContext(collection)`: exposes `{ categoriesById, characteristicsById }` to the
  mobile projector via the Step 15 context-merging mechanism.
- Exact filters: `code` (gear code, case-insensitive), `categoryCode`
  (case-insensitive), `categoryId` (exact GUID match, case-sensitive).
- Custom filters: `pairFishing` (strict boolean parse, filters gears by exact
  `pairFishing` value) and `vesselLengthMetres` (parsed via
  `parseVesselLengthMetres`; **predicate always returns true** — it never removes a
  gear from the result set, it only narrows applicable characteristics during mobile
  projection, per the retained-gear policy in §2.2).
- Text search fields: name, code, type, category name, category code, and the
  denormalised searchable-characteristics string (so a matching characteristic returns
  its gear exactly once, per the de-duplication requirement).
- Sort fields: name, code, type, categoryName, categoryCode, pairFishing; default sort
  by name.
- `activeField`: `gear.active` (canonical boolean, Step 04).
- `mobileProjector`: resolves `vesselLengthBand` from `context.vesselLengthMetres` (when
  present) and delegates to `projectGearToMobile`.

### 2.4 `src/routes/gears.js`

- Builds `{ collectionHandler, itemHandler }` via `createCollectionRouteController`
  with `gearsQueryConfiguration`, adding two dataset-specific response post-processors:
  - `addMobileMeasurements` (collection route, mobile view only): computes the
    page-specific `measurements` array via `collectPageMeasurements`, adds a
    `context: { vesselLengthMetres, vesselLengthBand }` property when a vessel length
    was supplied, and strips the internal projection field from every item.
  - `addMobileItemContext` (item route, mobile view only): strips the internal
    projection field from the single returned item.
- Canonical view responses are untouched by the post-processors (pass-through),
  preserving the full canonical gear record including `fixed`.

## 3. Files created

- `src/reference-data/query/vessel-length-band.js` (+ test)
- `src/reference-data/query/gears-mobile-projector.js` (+ test)
- `src/reference-data/query/gears-query-configuration.js` (+ test)
- `src/routes/gears.js`
- `src/routes/gears.test.js` (added to complete this step — see §5)

## 4. Files modified

- `src/plugins/router.js` — registers `gearsCollection`/`gearsItem` alongside the
  existing manifest/vessel routes.

## 5. Outstanding work completed in this pass

- `src/routes/gears.test.js` was missing from the interrupted session; added now,
  following the `src/routes/vessels.test.js` integration-test convention (stub
  authentication client + a real in-memory store + the real `gearsQueryConfiguration`
  and `collection-query-service`, exercised through a real Hapi server via
  `server.inject`).

## 6. Decisions preserved from the interrupted session (not re-litigated)

- Fixed/required → required/variable measurement mapping: see §2.2. `fixed` remains an
  unmodified, explicit canonical property in every canonical-view response.
- Gears without applicable characteristics for a selected vessel-length band are
  retained (not excluded) in the mobile response.
- `vesselLengthMetres` never filters the gear result set; it only affects mobile
  projection.

## 7. Test approach

Unit: vessel-length band boundaries (9.99/10/11/12/12.01) and invalid inputs; mobile
projector (category/characteristic resolution, required/variable split, band exclusion,
page-specific measurement de-duplication, immutability); query configuration (full
collection, search, category/code/pairFishing filters, mobile view with/without vessel
length). Integration: `gears.test.js` — canonical/mobile collection, `{id}` retrieval,
gear-code/category-code/pairFishing filters, vessel-length bands (under-10/10-12/over-12),
required vs variable measurement ids, `fixed` preservation in canonical view, unknown/
invalid GUID, 401/403, ETag/304, standard error envelope.

## 8. Deferred

Ports, species, and map-location endpoints (Steps 18-20) — explicitly out of scope for
this pass.
