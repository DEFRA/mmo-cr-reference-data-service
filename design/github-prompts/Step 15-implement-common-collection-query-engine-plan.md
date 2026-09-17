# Step 15 — Implementation Plan: Common Collection Query Engine

Treated as already approved per this step's prompt operating mode.

## 1. Repository state discovered

- Steps 05, 11, 12, 13, 14 are implemented and verified (see their completion summaries).
- `src/common/domain/query.js` defines documentation-only JSDoc typedefs (`QueryRequest`,
  `QueryFilters`, `QueryResult`, pagination/sorting shapes) — no runtime code yet.
- `src/common/domain/representations.js` defines `REPRESENTATIONS.CANONICAL/MOBILE` and
  `isSupportedRepresentation`.
- `src/common/contracts/reference-data-projector.js` defines the projector contract
  (`project(canonicalItem, context)`), not yet implemented for any dataset.
- `src/reference-data/query/index.js` (Step 14) already composes a `query` singleton with
  `getManifest` only. This step adds the reusable collection query engine alongside it,
  without changing the manifest use case.
- `src/reference-data/in-memory-store` exposes `getCollection(dataset)` /
  `getCollectionMetadata(dataset)` (both return `undefined` when not loaded, defensively
  cloned) — the only source of active data for this engine.
- No dataset-specific query configuration, request parser, pagination, sorting, or
  projection code exists yet anywhere in the repository.

## 2. Design

### 2.1 Engine independence

The engine (`collection-query-engine.js`) is a pure function operating on a plain array of
records (items or GeoJSON features) plus a `QueryConfiguration` object and an already-parsed
internal request. It has no Hapi, AWS SDK, or Authentication Service dependency.

### 2.2 Query configuration (`query-configuration.js`)

`createQueryConfiguration({ dataset, format, getGuid, exactFilters, textSearchFields,
customFilters, sortFields, defaultSort, activeField, mobileProjector })` validates its own
shape at construction (missing dataset/getGuid, duplicate filter/sort names, etc. throw
immediately) and returns a frozen configuration object. No dataset-specific configuration is
authored in this step — only the mechanism plus one minimal test configuration.

### 2.3 Request parser (`query-request-parser.js`)

`parseCollectionQuery(rawQuery, config)` turns a plain query-string object into an internal
request: `{ view, freeText, ids, exactFilters, customFilterValues, includeInactive, sort,
offset, limit, isFullCollectionRequest }`. Every recognised key is validated strictly; any
key not recognised by the common parameters or `config` throws `invalid_request`. Documented
policy decisions (see saved session/repo memory) apply: AND semantics, silent ID
de-duplication, unknown IDs silently produce fewer results, bounded lengths, reject-not-clamp
above the maximum limit, `field`/`-field` sort syntax with an automatic GUID tie-break appended
by the engine, and the "full collection request" test (true only when no recognised
non-`view` parameter was supplied).

### 2.4 Engine pipeline (`collection-query-engine.js`)

`runCollectionQuery({ config, records, parsedRequest })` applies, in order: active-state
filter → ids filter → exact filters (AND) → custom filters (AND) → free-text search →
total-count capture → sort (copy, never in place) → pagination (skipped for full-collection
requests). Returns `{ totalCount, items, offset, limit, isFullCollectionRequest }`.

### 2.5 Query service (`collection-query-service.js`)

`createCollectionQueryService({ store })` → `{ queryCollection(dataset, config, rawQuery),
getItemById(dataset, config, id, rawQuery) }`. Reads one snapshot via
`store.getCollection`/`getCollectionMetadata`, throws `reference_data_unavailable` when not
loaded, applies the engine, and applies `config.mobileProjector` when `view=mobile` (throwing
`internal_error` if a mobile view is requested but no projector is configured — this step
provides no dataset projector, so this path is only exercised by an explicit test double).

## 3. Files created

- `src/reference-data/query/query-configuration.js` (+ test)
- `src/reference-data/query/query-request-parser.js` (+ test)
- `src/reference-data/query/collection-query-engine.js` (+ test)
- `src/reference-data/query/collection-query-service.js` (+ test)
- `src/reference-data/query/collection-query-service.integration.test.js` (integration:
  real `createInMemoryDataStore()` + a focused test configuration)

## 4. Files modified

- `src/reference-data/query/index.js` — re-exports the new factories (the manifest `query`
  singleton and its `getManifest` behaviour are unchanged).

## 5. Out of scope (confirmed deferred)

Vessel/gear/port/species/map-specific configuration and endpoints (Steps 16-20).

## 6. Test approach

Unit tests for configuration validation, parser (defaults, strict parsing, rejection paths,
full-collection detection), engine pipeline (filters, search, sort stability/immutability,
pagination correctness, active-state), and query-service integration against a real
in-memory store instance. Architecture-boundary regression (existing test) re-run unaffected.

## 7. Security & performance

Bounded list/string lengths before any lookup; no dynamic property evaluation (accessors are
plain functions supplied by configuration, never caller-controlled strings); single array
copy for sort, no repeated full-collection cloning.
