# Step 09 — Completion Summary: Dataset-Specific Validation

## Plan

[Step 09-implement-dataset-specific-validation-plan.md](./Step%2009-implement-dataset-specific-validation-plan.md)

## Owner-confirmed decisions

Six ambiguities were raised before implementation and explicitly resolved by the owner (recorded
in `/memories/repo/conventions.md`): map-statistical-areas `parentCode` stays structural-only
(no same-collection resolution); gear characteristic `dataType` enum currently contains only
`"number"`; duplicate-comparison casing is case-insensitive for CFR/UVI/IRCS/externalMark/
registrationNumber/gear-codes/category-codes/characteristic-codes/FAO-codes/statistical-area-codes
and case-sensitive for MMSI/port-codes; species `commonNames[].id`/`localNames[].id` share one
collection-wide GUID namespace across both name types; vessel-length bands are exactly
`under-10m`/`10-to-12m`/`over-12m`; `lengthOverallMetres` stays `positive()` (Step 09's
"non-negative" rule is therefore already satisfied structurally and was not re-implemented as a
redundant runtime check).

## Repository state discovered

Step 08's common validation engine (`validate-collection.js`, `dataset-validator-registry.js`,
`findDuplicates`, `createReferenceIndex`/`referenceExists`, `isValidDateOrder`,
`validateFeatureCollectionGeometries`) was complete, with a no-op placeholder business validator
registered for every uploadable dataset.

## Files created

- `src/reference-data/validation/gear-characteristic-data-types.js` (+ test) — approved enum (`["number"]`).
- `src/reference-data/validation/vessel-length-bands.js` (+ test) — approved 3-band enum.
- `src/reference-data/validation/datasets/vessels-validator.js` (+ test) — natural-identifier presence, per-field duplicate detection (mixed casing), active date-range.
- `src/reference-data/validation/datasets/gears-validator.js` (+ test) — code uniqueness (items/categories/characteristics, independent namespaces), category/characteristic reference resolution, dataType enum, numeric range, vessel-length applicability.
- `src/reference-data/validation/datasets/ports-validator.js` (+ test) — port-code uniqueness (exact).
- `src/reference-data/validation/datasets/species-validator.js` (+ test) — FAO-code uniqueness, collection-wide nested-name GUID uniqueness, official-local-name-per-language constraint.
- `src/reference-data/validation/datasets/map-land-validator.js` (+ test) — explicit, documented no-op (no rules beyond Step 08 common).
- `src/reference-data/validation/datasets/map-statistical-areas-validator.js` (+ test) — area-code uniqueness; `parentCode` intentionally not resolved.
- `src/reference-data/validation/datasets/register.js` (+ test) — side-effect registration of all six validators over the Step 08 placeholders.
- `src/reference-data/validation/datasets/dataset-validation-integration.test.js` — end-to-end `validateCollection()` coverage per dataset, cross-dataset isolation, immutability, and composition tests proving rules intentionally left to the Step 04 schema (vessel length, port coordinate pairing/range, statistical-area parentCode) still hold.

## Files modified

- `src/reference-data/validation/error-codes.js` — added `missing_natural_identifier`, `unsupported_characteristic_type`, `invalid_numeric_range`, `missing_applicability`, `duplicate_official_name`.
- `src/reference-data/validation/index.js` — added a side-effect import of `./datasets/register.js` so consuming the Validation Module boundary always wires the real validators.

## Tests

79 new tests across 12 files. Full suite: 540 passed / 6 skipped (Floci-gated), 0 regressions.

## Verification

```
npm run lint         # pass
npm test              # 540 passed, 6 skipped, ~98% statement coverage
```

Formatting: all files created/modified in this step pass Prettier (`npx prettier --write` applied
to exactly those files). Pre-existing repo-wide `format:check` drift in unrelated
`design/_conversations` and prior-step files was not introduced by Step 09 and was left untouched.

## Security / privacy

No S3/Floci/Authentication Service access (validators are pure functions over in-memory objects).
No network calls. No complete-collection logging. All new business-code duplicate detection reuses
the Step 08 bounded/redacted issue model; rejected values are safe scalars only.

## Deferred

Canonical normalisation (Step 10). Cross-collection/hierarchical parentCode resolution for
statistical areas. Country/language/FAO/area-code format enums beyond "non-empty string" (no
authoritative format was approved). Mobile projections, querying, uploads, S3/Floci, Authentication
Service, Hapi routes.

## Deviations from plan

None. All six ambiguities were resolved by explicit owner decision before implementation began, and
implementation matches the approved Step 09 plan exactly.
