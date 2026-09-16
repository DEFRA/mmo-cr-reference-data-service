# Step 10 Implementation Plan: Canonical Data Normalisation

## 1. Repository state discovered

- `src/reference-data/normalisation/index.js` is still the Step 02 placeholder
  (`{ name: 'normalisation' }`) — no executable logic exists yet.
- Step 04 canonical schemas (`src/common/schemas/v1/*.js`) are all `Joi` schemas validated with
  `{ convert: false, abortEarly: false, allowUnknown: false }` (`validate.js`) — i.e. **strict,
  non-coercing**. Any collection reaching normalisation has therefore already satisfied exact
  types (numbers are real numbers, booleans are real booleans, GUIDs/timestamps already match
  their patterns). There is no separate "legacy" input contract anywhere in this repository.
- Step 08/09 established the registry pattern (`Map` + `resolve*`/`register*` + a default
  placeholder + a `datasets/register.js` side-effect module imported by the component's
  `index.js`) that this step reuses for symmetry.

## 2. Owner-confirmed decisions

Recorded in `/memories/repo/conventions.md`:

1. No hypothetical legacy numeric-string/boolean-string/CRS/property-rename conversions are
   implemented — there is no real source format for them in this repo. They are documented as
   "not applicable" extension points.
2. Whitespace trimming applies to every string leaf, including business codes/identifiers.
3. Timestamps are left exactly as supplied (no UTC/offset normalisation).

## 3. What this reduces normalisation to

Because (1)+(3) remove every hypothetical transformation this repo has no real input for, the only
implementable, testable, non-invented rule is: **recursively trim leading/trailing whitespace from
every string leaf in the collection, for every maintained dataset** (JSON and GeoJSON alike). This
is dataset-agnostic by nature, but a per-dataset registry entry is still provided (per the Step 10
architecture requirement for an extension point), with each dataset normaliser documented as
"trimming only — no dataset-specific rule currently applies" so a future rule can be added to one
dataset without touching the others.

## 4. Proposed file structure

```
src/reference-data/normalisation/
  string-trim.js                          (+ test)  trimStringsDeep(value) — recursive, immutable
  warning-codes.js                                    NORMALISATION_WARNING_CODE
  normalisation-result.js                 (+ test)  createNormalisationResult, MAX_NORMALISATION_WARNINGS
  dataset-normaliser-registry.js          (+ test)  resolve/register, identity placeholder, rejects map-ports
  normalise-collection.js                 (+ test)  top-level entry point
  datasets/
    vessels-normaliser.js                 (+ test)
    gears-normaliser.js                   (+ test)
    ports-normaliser.js                   (+ test)
    species-normaliser.js                 (+ test)
    map-land-normaliser.js                (+ test)
    map-statistical-areas-normaliser.js   (+ test)
    register.js                          side-effect registration
    normalisation-integration.test.js    stage-order + Step 08/09 composition proof
  index.js                                modified: real API + side-effect import of datasets/register.js
```

## 5. Contracts

```js
trimStringsDeep(value, path = '') -> { value, changed, changes: [{path, originalValue, normalisedValue}] }
createNormalisationResult({ value, changed, changes, maxWarnings? }) -> { value, changed, warnings }
normaliseCollection({ dataset, collection }) -> { value, changed, warnings }
```

Never mutates the input (always rebuilds new arrays/objects); numbers/booleans/null pass through
unchanged; idempotent by construction (a second pass finds nothing left to trim).

## 6. Per-dataset normalisers

All six (`vessels`, `gears`, `ports`, `species`, `map-land`, `map-statistical-areas`) are thin,
individually-registered wrappers around `trimStringsDeep` + `createNormalisationResult`, each with
a doc comment stating that trimming is the only currently-applicable rule for that dataset and
naming the specific "not applicable" categories (e.g. no numeric-string conversion because
`lengthOverallMetres`/coordinates/`minValue`/`maxValue` must already be strict numbers).

## 7. Integration with Step 08 (validation) / Step 09 (business rules)

Step 10 does not modify `validate-collection.js` — full pipeline wiring (structural → normalise →
business → persistence) is the future Command Module's job. Instead,
`datasets/normalisation-integration.test.js` composes the existing pieces manually to prove:

- A structurally valid collection normalises without error.
- `resolveDatasetBusinessValidator` (Step 09) still detects a duplicate GUID/business-code after
  normalisation (proving trimming never hides or fabricates a business-rule pass).
- Trimming a duplicate business code that only differs by whitespace still leaves it a business
  duplicate once normalised (whitespace was the only difference).
- Running normalisation twice on its own output is a no-op (idempotency) and never mutates input.

## 8. Explicitly deferred / out of scope

Mobile projections, S3/Floci, Authentication Service, Hapi routes, Command Module wiring, GUID
generation, coordinate/CRS conversion, numeric/boolean legacy conversion (no source format),
property renaming (no source format).

## 9. Verification commands

```
npm run lint
npm test
```
