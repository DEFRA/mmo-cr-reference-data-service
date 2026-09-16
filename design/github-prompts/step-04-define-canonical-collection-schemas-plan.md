# Plan: Step 04 — Define Canonical Collection Schemas

## Repository inspection summary

- Joi is already a direct dependency (used for Step 02's convict custom formats) — reused here for all schemas. No new dependency introduced.
- Conventions: plain JS/ESM, colocated `*.test.js` files, path alias `#/*`, no top-level `test/` directory.
- Step 03 provides `DATASETS`, `DATASET_FORMAT`, `isPersistedDataset`, etc. in `#/common/domain/datasets.js` — reused, not duplicated.

## Decisions / assumptions

1. Item-level optional fields (vessel `namePln`/`activeTo`, identifiers, species names) use explicit nullable (`allow(null).optional()`), matching the prompt's JSON examples and this repo's existing `nullable: true` convention in `config.js`. Envelope-level `effectiveFrom` stays plain-optional (omittable).
2. Business-code/enum-like fields (`status`, `typeCode`, `registrationCountryCode`, `countryCode`, `languageCode`, `faoCode`, gear `code`/`dataType`, `vesselLengthApplicability` values) are validated as non-empty strings only — no invented ISO-3166/639 patterns or enums, since no authoritative value list was given.
3. `itemCount` for gears reflects the `items` array length only (not categories/characteristics).
4. Map feature `properties` schemas are intentionally minimal (`id` [+ `name` for map-land]) with `additionalProperties:false`, documented as a v1 scope decision.
5. Fixtures are `.js` modules exporting object literals (not `.json` files), matching this repo's all-ESM convention rather than introducing JSON import-attribute syntax.

## Files created

### Fragments — `src/common/schemas/fragments/`

- `guid.js`, `date.js`, `timestamp.js`, `coordinate.js`, `geojson.js`, `collection-metadata.js` (+ `.test.js` for each)

### Core

- `schema-versions.js` (+ test)
- `validate.js` (+ test)
- `schema-registry.js` (+ test)

### v1 schemas — `src/common/schemas/v1/`

- `collection-envelope.js` (+ test)
- `manifest.js` (+ test)
- `vessels.js` (+ test)
- `gears.js` (+ test)
- `ports.js` (+ test)
- `species.js` (+ test)
- `map-land.js` (+ test)
- `map-statistical-areas.js` (+ test)
- `map-ports.js` (derived-only response shape, not registered as persisted)

### Fixtures — `src/common/schemas/fixtures/`

- `valid/{vessels,gears,ports,species,map-land,map-statistical-areas}.js`
- `invalid/` — 18 focused fixtures per the required-tests list

### Cross-cutting

- `src/common/schemas-import.test.js` — imports all new modules, proves no circular-dependency failures

## Files modified

- `README.md` — new "Canonical Schemas" section

## Out of scope

S3/Persistence, In-Memory Store, cache refresh, Authentication Service, Hapi routes, business validation (uniqueness, cross-record refs, date ordering), normalisation, mobile projections, search/pagination, OpenAPI, seed data, deployment infra.

## Verification

Run schema tests in isolation, then `npm test`, `npm run lint`, `npm run format:check` (scoped to files this step touches), then confirm app still starts.
