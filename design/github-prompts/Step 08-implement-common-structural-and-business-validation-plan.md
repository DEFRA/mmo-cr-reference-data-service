# Step 08 — Implementation Plan: Common Structural and Business Validation

## 1. Repository state discovered

- Structural schemas already exist (Step 04): `src/common/schemas/v1/*.js`, `schema-registry.js` (`getCollectionSchema`, `getManifestSchema`), `schema-versions.js`, Joi-based, `validate.js` (`validateAgainstSchema`, `mapValidationErrorDetails`).
- `src/common/domain/validation.js` already defines `VALIDATION_SEVERITY` and JSDoc typedefs for `ValidationIssue`/`ValidationResult` (documentation-only, from Step 03). This step implements the executable engine that produces values of this shape.
- `src/reference-data/validation/index.js` is a Step 02 placeholder (`export const validation = { name: 'validation' }`).
- `src/common/domain/datasets.js` is the single dataset registry (`DATASETS`, `isSupportedDataset`, `isUploadableDataset`, `isPersistedDataset`, `isDerivedDataset`, `getDatasetCapabilities`). `map-ports` is `uploadable: false`.
- `src/common/domain/errors.js` defines `SERVICE_ERROR_CODES` — a different, HTTP-facing error model (later step). Validation issue codes are a separate, lower-level catalogue per the Step 08 prompt.
- Fixtures convention: JSON files under `src/common/schemas/fixtures/{valid,invalid}`, imported with `import x from './y.json' with { type: 'json' }`, `test.each` tables. No magic numbers in `.js` — named constants (see `coordinate.js`, `geojson.js`).
- Defensive cloning convention: `structuredClone`.
- Error convention: plain `Error` with `.code`/`.dataset`/`.retryable` for _thrown_ internal failures — not used for ordinary validation issues, which are returned in the result, not thrown.

## 2. Gaps against Step 08

Everything below is new: the executable validation engine, issue/result model, common business rules, duplicate/relationship/date/GeoJSON utilities, and the dataset-validator registry (extension point; Step 09 will populate the per-dataset business rules, Step 08 registers safe no-op placeholders so the registry is complete and testable now).

## 3. Proposed module structure

```
src/reference-data/validation/
  index.js                        - public API (validateCollection, issue codes, registry accessors)
  error-codes.js                  - VALIDATION_ISSUE_CODE catalogue (stable, machine-readable)
  validation-result.js            - issue/warning factories + createIssueCollector(maxIssues) (dedup/truncation)
  duplicate-detection.js          - findDuplicates(entries, { caseInsensitive }) generic utility
  relationship-validation.js      - createReferenceIndex(items, keyFn), validateReference(...)
  date-range-validation.js        - validateDateOrder({ startValue, endValue, startPath, endPath, code })
  geojson-validation.js           - validateFeatureCollectionGeometries(collection) - coordinate range,
                                     ring closure, non-empty geometry (dataset-agnostic, reusable by Step 09)
  collection-envelope-validator.js - validateCommonEnvelope({dataset, expectedDataset, schemaVersion, collection})
                                     dataset-match, itemCount/featureCount consistency, duplicate id/feature GUIDs,
                                     invokes geojson-validation when the dataset format is GeoJSON
  dataset-validator-registry.js   - resolveDatasetBusinessValidator(dataset); rejects unsupported/non-uploadable
                                     (map-ports) datasets; Step 08 registers no-op placeholders for the six
                                     uploadable datasets, Step 09 replaces each placeholder with a real validator
  validate-collection.js          - top-level pipeline: structural (Joi, Step 04) -> common business (this step)
                                     -> dataset-specific business (registry) -> combined ValidationResult
  validation/*.test.js            - unit tests colocated per module
  validation/fixtures/            - small JSON collections for business-rule tests requiring 2+ items
                                     (duplicate GUID, duplicate business code, item-count mismatch, etc.),
                                     built from the Step 04 fixture shapes
```

`src/reference-data/validation/index.js` is updated to export the real API (`validateCollection`, `VALIDATION_ISSUE_CODE`, `resolveDatasetBusinessValidator`) instead of the placeholder object, following the same "index re-exports from a real module" convention used by `in-memory-store/index.js` (no factory singleton is needed here since validation is stateless/pure).

## 4. Validation result / issue contract

Aligns with the existing `src/common/domain/validation.js` typedefs:

```js
{ valid, errors: ValidationIssue[], warnings: ValidationIssue[], receivedCount, normalisedCount }
```

`ValidationIssue = { code, message, path, itemIndex, rejectedValue, dataset, severity, correlationId }`.

- `valid` is `false` iff `errors.length > 0`.
- Deterministic ordering: stage order (structural, then common business, then dataset-specific), then input path (string compare), then item index.
- `MAX_VALIDATION_ISSUES = 200` (named constant in `validation-result.js`); once reached, stop appending and add one `validation_issues_truncated` warning.
- `rejectedValue` is only attached for small, safe scalar values (string/number/boolean/null); never for whole objects/arrays.

## 5. Error-code catalogue (from the Step 08 prompt, reused verbatim)

`invalid_document, invalid_root_type, required_property_missing, invalid_property_type, unsupported_dataset, dataset_mismatch, invalid_guid, duplicate_guid, unsupported_schema_version, invalid_collection_version, invalid_date, invalid_date_range, invalid_item_count, duplicate_business_code, unresolved_reference, invalid_enum_value, unexpected_property, invalid_geojson_structure, business_rule_failed` plus `validation_issues_truncated` (bounding safeguard) and `invalid_coordinate` / `open_polygon_ring` / `empty_geometry` (GeoJSON common foundation, reused verbatim from the Step 09 prompt's category list since they are dataset-agnostic).

Structural Joi errors (`required_property_missing`, `invalid_property_type`, `invalid_guid`, `invalid_enum_value`, `unexpected_property`, `invalid_root_type`) are derived from `error.details[].type` via a small mapping table in `collection-envelope-validator.js`.

## 6. Common business rules implemented in Step 08

- **Dataset mismatch**: `collection.dataset !== expectedDataset` (context supplied by the caller — never inferred from a filename).
- **Item/feature count consistency**: `itemCount !== (items ?? features).length`.
- **Duplicate GUIDs**: item `id` (JSON datasets) or feature `id` (GeoJSON datasets), via `duplicate-detection.js`, case-sensitive (GUIDs are canonical-form identifiers, not business codes — the case-insensitive decision applies only to business codes per the confirmed answer).
- **GeoJSON common foundation** (dataset-agnostic, applies to any dataset whose `DATASET_FORMAT` is `geojson`): numeric coordinate values already structurally guaranteed by Step 04 (`positionSchema`); this step adds WGS84 range checking, ring-closure checking (first/last position deep-equal), and non-empty-geometry checking for `Polygon`/`MultiPolygon`.
- **Reusable utilities** (`duplicate-detection.js`, `relationship-validation.js`, `date-range-validation.js`) are exported for Step 09's dataset-specific validators to compose (gear category/characteristic references, vessel active-date range, business-code duplicate checks).

Confirmed decision: business-code duplicate comparisons (used by Step 09) are **case-insensitive**; GUID duplicate comparisons remain exact-match (GUIDs are not free text).

## 7. Dataset-validator registry (extension point)

`dataset-validator-registry.js` exports `resolveDatasetBusinessValidator(dataset)`:

- Throws for `!isSupportedDataset(dataset)` (`unsupported_dataset`-style thrown Error, since resolution failure is a programming/contract error, not a collection validation issue).
- Throws for a dataset that is supported but not uploadable (`map-ports`) — explicit rejection, per the derived-dataset rule.
- Returns a registered function `(collection, context) => ValidationResult` for each of the six uploadable datasets. Step 08 registers a shared no-op placeholder (`{ valid: true, errors: [], warnings: [] }`) for all six; Step 09 replaces each entry with the real dataset-specific validator module.

## 8. Pipeline (`validate-collection.js`)

```
validateCollection({ dataset, schemaVersion, collection, correlationId })
  -> if !isSupportedDataset(dataset) or !isUploadableDataset(dataset): return invalid result (unsupported_dataset), stop
  -> structural: getCollectionSchema(dataset, schemaVersion) + validateAgainstSchema  (Step 04)
     -> map Joi error.details to ValidationIssue[] via mapValidationErrorDetails() + code mapping
  -> if the root value is unusable for further checks (not an object) -> return structural-only result
  -> common business: validateCommonEnvelope(...)
  -> dataset-specific business: resolveDatasetBusinessValidator(dataset)(collection, context)
  -> combine, order deterministically, truncate at MAX_VALIDATION_ISSUES, return ValidationResult
```

Business checks run even when structural issues exist elsewhere in the document (matches "continue independent checks... skip dependent checks when structurally unusable"), guarded with `Array.isArray` checks so a malformed `items`/`features` never throws.

## 9. Files to create

- `src/reference-data/validation/error-codes.js` (+ none needed test — pure constants, covered indirectly)
- `src/reference-data/validation/validation-result.js` + `.test.js`
- `src/reference-data/validation/duplicate-detection.js` + `.test.js`
- `src/reference-data/validation/relationship-validation.js` + `.test.js`
- `src/reference-data/validation/date-range-validation.js` + `.test.js`
- `src/reference-data/validation/geojson-validation.js` + `.test.js`
- `src/reference-data/validation/collection-envelope-validator.js` + `.test.js`
- `src/reference-data/validation/dataset-validator-registry.js` + `.test.js`
- `src/reference-data/validation/validate-collection.js` + `.test.js`
- `src/reference-data/validation/fixtures/*.json` (small 2-item collections for duplicate/count fixtures, reused by Step 09 too)

## 10. Files to modify

- `src/reference-data/validation/index.js` — replace placeholder with real exports.

## 11. Files intentionally left unchanged

- All `src/common/schemas/**` (Step 04 structural schemas remain the sole structural authority).
- `src/common/domain/validation.js` (typedefs already correct; no behaviour to add).
- `src/common/domain/errors.js` (separate HTTP-facing error model, untouched).

## 12. Security / privacy

- `rejectedValue` only for small safe scalars; never whole records/collections.
- No network calls, no dynamic `import()`, no S3/Floci/Authentication Service access anywhere in this module (enforced by architecture-boundaries-style reasoning; only `persistence/**` may import the S3 SDK, already covered by the existing `architecture-boundaries.test.js`).
- Bounded issue collection (`MAX_VALIDATION_ISSUES`).
- Bounded GeoJSON traversal (iterates existing structurally-bounded arrays only; no unbounded recursion — ring/position depth is fixed by the GeoJSON spec).

## 13. Performance

- Duplicate/relationship indexing uses `Map`/`Set` (linear time), no repeated full-array scans.
- No deep cloning of the whole collection during validation (read-only traversal only).

## 14. Verification commands

```
npm run lint
npm test
```

## 15. Assumptions

- Business-code case-insensitivity and GUID exact-match confirmed by owner (see conversation).
- `MAX_VALIDATION_ISSUES = 200` is a reasonable, configurable-in-code default; no existing config key requested this, so it is not added to `convict` config to avoid scope creep (documented as a code-level constant).

## 16. Deferred to later steps

- Dataset-specific business rules (vessels/gears/ports/species/map-land/map-statistical-areas) — Step 09.
- Normalisation — Step 10.
- Authentication Service integration — Step 12.
- HTTP error mapping — Step 13.
