# Step 09 Implementation Plan: Dataset-Specific Validation

## 1. Repository state discovered

- Step 08 delivered a complete common validation engine under `src/reference-data/validation/`:
  - `validate-collection.js` — pipeline: unsupported-dataset/schema-version guard → Step 04 Joi
    structural schema → `validateCommonEnvelope` (dataset match, itemCount consistency, duplicate
    item/feature GUIDs, common GeoJSON foundation) → dataset-specific business validator resolved
    from `dataset-validator-registry.js` → bounded `createIssueCollector`.
  - `dataset-validator-registry.js` — `Map` of dataset → validator fn, pre-populated with a
    no-op `() => ({ valid: true, errors: [], warnings: [] })` for every uploadable dataset.
    `resolveDatasetBusinessValidator(dataset)` / `registerDatasetBusinessValidator(dataset, fn)`.
  - Reusable utilities: `findDuplicates(entries, { caseInsensitive })`,
    `createReferenceIndex(items, keyFn)` / `referenceExists(index, value)`,
    `isValidDateOrder({ startValue, endValue })`, `validateFeatureCollectionGeometries(collection)`
    (WGS84 range + closed rings + non-empty geometry, dataset-agnostic).
  - `error-codes.js` — `VALIDATION_ISSUE_CODE` map (stable string codes).
  - A dataset business validator receives `(collection, { correlationId })` and must return
    `{ valid, errors: Issue[], warnings: Issue[] }` (plain arrays; the pipeline itself adds
    `dataset`/`correlationId` to each issue and feeds them through the bounded collector).
- Step 04 canonical schemas (`src/common/schemas/v1/*.js`) already structurally enforce, and Step
  09 must NOT duplicate:
  - Port coordinate pairing and WGS84 range (`coordinateSchema`: both lat/long required together).
  - GeoJSON position shape, ring/position array shape (`geojson.js` fragment).
  - `dataType`, `vesselLengthApplicability`, country codes, language codes, FAO codes, area codes:
    all currently unconstrained non-empty strings (Step 04 plan explicitly deferred any enum/regex
    since no authoritative list existed at that time — Step 09 now supplies the enums that were
    deferred, per owner decisions below, as _business_ rules, not schema changes).
  - `lengthOverallMetres: Joi.number().strict().positive().required()` already rejects 0/negative.

## 2. Owner-confirmed decisions (resolving prompt ambiguities)

Recorded in repo memory (`/memories/repo/conventions.md`) for future steps:

1. **map-statistical-areas `parentCode`**: structural-only (already `Joi.string().min(1).allow(null)`).
   No same-collection resolution rule is implemented. Cross-collection/hierarchical resolution is
   explicitly deferred, not part of Step 09.
2. **Gear characteristic `dataType`**: approved enum contains only `"number"`, implemented as an
   extensible, central constant (`GEAR_CHARACTERISTIC_DATA_TYPES`).
3. **Duplicate/uniqueness comparison casing**:
   - Case-insensitive: vessel CFR, UVI, IRCS, externalMark, registrationNumber; gear/category/
     characteristic codes; FAO codes; statistical-area codes.
   - Case-sensitive (exact): vessel MMSI; port codes.
   - Comparison key only — original values are never mutated, coerced, or case-folded in output.
4. **Species nested-name GUIDs**: `commonNames[].id` and `localNames[].id` must be unique
   collection-wide, across both name types combined (one shared namespace).
5. **Vessel-length applicability**: canonical values are exactly `under-10m`, `10-to-12m`,
   `over-12m` (centralised constant, no aliases accepted).
6. **Vessel length non-negativity**: schema stays `positive()` (zero already structurally
   rejected). The plan's "non-negative" rule is therefore already satisfied structurally; Step 09
   does not add a redundant runtime check for it (documented as a deliberate no-op), avoiding an
   unreachable/duplicate error against the same fact.

## 3. Proposed file structure

```
src/reference-data/validation/
  gear-characteristic-data-types.js       (+ .test.js)   new: {number} enum
  vessel-length-bands.js                  (+ .test.js)   new: 3-band enum
  datasets/
    vessels-validator.js                  (+ .test.js)   new
    gears-validator.js                    (+ .test.js)   new
    ports-validator.js                    (+ .test.js)   new
    species-validator.js                  (+ .test.js)   new
    map-land-validator.js                 (+ .test.js)   new (explicit documented no-op)
    map-statistical-areas-validator.js    (+ .test.js)   new
    register.js                           new: side-effect registration of the six validators
  error-codes.js                          modified: add 5 new stable codes
  index.js                                modified: import './datasets/register.js' for side effects
```

No Step 04, Step 08, contracts, domain, or persistence files are modified except `error-codes.js`
(additive) and `validation/index.js` (one new side-effect import).

## 4. New error codes (additive to `VALIDATION_ISSUE_CODE`)

```
missing_natural_identifier
unsupported_characteristic_type
invalid_numeric_range
missing_applicability
duplicate_official_name
```

`duplicate_business_code`, `unresolved_reference`, `invalid_date_range`, `invalid_enum_value`,
`duplicate_guid` are reused as-is from Step 08.

## 5. Dataset validator rules

### Vessels (`vessels-validator.js`)

- Missing natural identifier: none of cfr/uvi/mmsi/ircs/externalMark/registrationNumber present
  (non-null, non-empty) → `missing_natural_identifier`.
- Duplicate cfr/uvi/ircs/externalMark/registrationNumber (case-insensitive) and duplicate mmsi
  (case-sensitive) → `duplicate_business_code`, one `findDuplicates` call per identifier field.
- `activeTo` before `activeFrom` → `isValidDateOrder` → `invalid_date_range`.
- Vessel length non-negativity: **not implemented** (see decision 6) — covered by a regression
  test proving the Step 04 schema already rejects negative/zero length.

### Gears (`gears-validator.js`)

- Duplicate item codes, category codes, characteristic codes — three independent
  case-insensitive `findDuplicates` namespaces → `duplicate_business_code`.
- `categoryId` resolves to `categories[].id` → `createReferenceIndex`/`referenceExists` →
  `unresolved_reference`.
- `applicableCharacteristics[].characteristicId` resolves to `characteristics[].id` →
  `unresolved_reference`.
- `characteristics[].dataType` ∈ `GEAR_CHARACTERISTIC_DATA_TYPES` → `unsupported_characteristic_type`.
- `minValue <= maxValue` when both present → `invalid_numeric_range`.
- `applicableCharacteristics[].vesselLengthApplicability`: must be a non-empty array (→
  `missing_applicability` if absent/empty) and every entry ∈ `VESSEL_LENGTH_BANDS` (→
  `invalid_enum_value` per unsupported entry).
- `fixed`/`required` independence: no rule needed (nothing to validate); covered by an
  immutability/pass-through test only.

### Ports (`ports-validator.js`)

- Duplicate port codes (case-sensitive) → `duplicate_business_code`.
- Country code format, coordinate pairing, lat/long range: **not implemented** — already fully
  enforced structurally by Step 04 (`coordinateSchema`, non-empty `countryCode`); covered by
  composition-level regression tests through `validateCollection`.

### Species (`species-validator.js`)

- Duplicate FAO codes (case-insensitive) → `duplicate_business_code`.
- `commonNames[].id` + `localNames[].id` unique collection-wide across both name types combined
  (case-sensitive, GUIDs) → `duplicate_guid`.
- At most one official (`official: true`) local name per species+languageCode →
  `duplicate_official_name`.
- Country/language code format: **not implemented** — Step 04 deliberately left these as
  unconstrained non-empty strings; no authoritative format exists to validate against.

### Map-land (`map-land-validator.js`)

- No dataset-specific rule exists beyond the common envelope + common GeoJSON foundation (Step
  08). Implemented as an explicit, documented, named no-op (`validateMapLandCollection`) — not
  left as the anonymous Step 08 placeholder — so the "no additional rules" decision is visible and
  independently testable rather than implicit.

### Map-statistical-areas (`map-statistical-areas-validator.js`)

- Duplicate `properties.code` (case-insensitive) → `duplicate_business_code`.
- `parentCode`: no resolution rule (decision 1) — composition test proves an unresolved
  `parentCode` does not fail validation.

## 6. Registry wiring

`datasets/register.js` imports the six validator modules and calls
`registerDatasetBusinessValidator(dataset, fn)` for each at module-evaluation time (side effect).
`validation/index.js` imports `register.js` for its side effect only, so importing anything from
the Validation Module boundary guarantees the real validators are wired instead of Step 08's
placeholders. A registry test confirms all six are no longer the placeholder no-op (except
map-land, which is intentionally an explicit no-op — asserted by identity/behaviour, not by
placeholder detection).

## 7. Fixtures and tests

- No new JSON fixture files: reuse the existing Step 04 valid fixtures
  (`src/common/schemas/fixtures/valid/*.json`) via `structuredClone(...)` + targeted mutation
  inside test files, exactly matching the pattern already used in `validate-collection.test.js`.
- One `*.test.js` per new source file, covering the full rule + edge-case + immutability list from
  the Step 09 prompt for every implemented rule, plus composition tests (via `validateCollection`)
  proving rules that are intentionally _not_ implemented here are still enforced structurally.
- Registry/integration tests: every uploadable dataset resolves to a validator; `map-ports`
  remains rejected upstream (already proven by Step 08); one dataset's validator is never invoked
  for another dataset's collection; no validator performs I/O or mutates input.

## 8. Explicitly deferred / out of scope

- Normalisation (Step 10).
- Country/language/FAO/area-code format enums beyond the "non-empty string" already enforced.
- Cross-collection parent-area resolution for statistical areas.
- Mobile projections, querying, S3/Floci, Authentication Service, Hapi routes.

## 9. Verification commands

```
npm run lint
npm test
```

(Repository has no separate type-check or build script beyond lint/test; `npm test` runs
`TZ=UTC vitest run --coverage` and is Docker-free. `npm run test:floci` is unaffected by this step.)
