# Step 14 — Implementation Plan: Manifest API

Treated as already approved per the Step 14 prompt's operating mode; implementation proceeds
directly after this plan is saved.

## 1. Repository state discovered

- `src/reference-data/controller/index.js` and `src/reference-data/query/index.js` are still
  Step 02 boundary placeholders (`{ name: 'controller' }` / `{ name: 'query' }`) — no route or
  query use case exists yet.
- No `/api/v1/reference-data` route prefix or route-path registry exists anywhere in the
  repository yet. Step 13 delivered only the _reusable utilities_ (`error-envelope.js`,
  `map-error-to-response.js`, `conditional-request.js`, `cache-control.js`), not an actual route
  using them, and no dataset→URL mapping exists. Registering the first real route and the central
  route-path registry is therefore in scope for this step.
- The active manifest model is `src/common/domain/manifest.js` (JSDoc only) and the real,
  enforced shape is `src/common/schemas/v1/manifest.js` (`manifestId`, `version`, `generatedAt`,
  `datasets[]` with `dataset, collectionId, schemaVersion, version, format, etag, checksum,
itemCount, sizeBytes, lastModified`). Note: the `manifest.js` JSDoc typedef uses stale property
  names (`collectionVersion`, `lastModifiedAt`) that don't match the real schema/runtime shape;
  left unchanged as an out-of-scope pre-existing documentation inconsistency.
- `src/reference-data/in-memory-store/in-memory-data-store.js` (Step 05) exposes
  `getManifest()` returning `null` before hydration/after `clear()`, or a defensive clone of the
  active manifest set by the Cache Refresh Module (`store.setManifest(manifest)` in
  `cache-refresh-service.js`, called on both successful hydration and successful refresh,
  regardless of individual dataset failures).
- `src/reference-data/cache-refresh/` (Step 11) is the only writer of the active manifest; the
  Query Module must read the manifest only via the In-Memory Data Store, never via
  `cacheRefresh` directly (no hydration-trigger risk).
- `src/reference-data/validation/index.js` (Step 12) exports a working `authenticationClient`
  (provisional HTTP client) plus `requireAuthenticatedActor` / `requireReadPermission`, but no
  route anywhere calls them yet — this is the first consumer.
- `src/common/helpers/api/*` (Step 13) provides `matchesIfNoneMatch`, `CACHE_CONTROL`,
  `createErrorEnvelope`, `mapErrorToResponse`. `src/plugins/error-response.js` maps any thrown
  error reaching the Hapi boundary using `mapErrorToResponse`, which recognises known
  `SERVICE_ERROR_CODES` on a Boom-wrapped error **before** falling back to generic Boom/500
  handling — confirmed working via `error-response.js`/`map-error-to-response.test.js`. This means
  the manifest handler can simply `throw` plain domain errors (`.code` from `SERVICE_ERROR_CODES`)
  and rely on this existing global mapping; no per-route try/catch is needed.
- `src/plugins/correlation.js` sets `request.app.correlationId` on every request via `onRequest`
  and adds the `x-cdp-request-id` response header on every response via `onPreResponse` — the
  controller does not need to manage correlation headers itself.
- `src/plugins/router.js` currently registers only `health` and `readiness` (both defined as thin
  route objects directly under `src/routes/`).
- `src/reference-data/reference-data-components.test.js` currently asserts `query` equals
  `{ name: 'query' }` in a `test.each` placeholder block (alongside `controller`, `validation`,
  `command`, `normalisation`) and has dedicated blocks for the already-implemented `cacheRefresh`,
  `inMemoryStore`, `persistence`. This needs updating for `query` only (see below).

## 2. Proposed design

### 2.1 Central public route-path registry (new, framework-agnostic)

`src/common/domain/route-paths.js` — `API_BASE_PATH`, `MANIFEST_ROUTE_PATH`,
`DATASET_ROUTE_PATHS` (one entry per persisted dataset plus derived `map-ports`), and
`getDatasetRoutePath(dataset)`. Placed in `common/domain` (not `controller`) so both the Query
Module (manifest URL projection) and the future Controller/router wiring can import it without a
query→controller dependency.

### 2.2 Query Module (`src/reference-data/query/`)

- `manifest-include-filter.js` — `parseIncludeFilter(rawValue)`: returns `null` when absent
  (no filter); otherwise validates and returns a de-duplicated array of canonical dataset
  identifiers. Rejects (throws `SERVICE_ERROR_CODES.INVALID_REQUEST` — see §2.5) empty string,
  empty list members, values not in `DATASETS` filtered to persisted datasets (i.e. `map-ports` is
  rejected as an include value, since it can never appear in a manifest entry), and bounds both
  length and item count. Duplicate values are silently de-duplicated (documented policy).
- `manifest-projection.js` — `projectManifest(manifest, { include })`: orders dataset entries by
  the canonical `DATASETS` registry order (not raw manifest storage order, for determinism),
  applies the optional filter, maps each internal entry to the public shape (adds `url` via
  `getDatasetRoutePath`, splits `itemCount` vs `featureCount`+`crs` by format, includes
  `sizeBytes` only when numeric), and computes the manifest ETag. Returns `{ etag, body }`.
- `query-service.js` — `createQueryService({ store })` → `{ getManifest({ include }) }`. Reads
  one manifest snapshot via `store.getManifest()`; throws
  `SERVICE_ERROR_CODES.REFERENCE_DATA_UNAVAILABLE` when `null` (covers both "hydration not yet
  complete" and "no valid manifest available" — a single check, since the In-Memory Store only
  ever holds a manifest once hydration/refresh has successfully validated and set one). Never
  calls persistence, cache-refresh, or the authentication client.
- `index.js` updated to compose the production singleton
  `export const query = createQueryService({ store: inMemoryStore })`, alongside re-exports of the
  new factories. The `query = { name: 'query' }` marker is removed (superseded by the real
  implementation, matching how `inMemoryStore`/`persistence`/`cacheRefresh` graduated already).

### 2.3 Filtered-manifest ETag policy (explicit decision)

**Decision: one ETag per active manifest revision, shared by the full and every filtered view.**
Rationale: this repository's manifest model treats `manifestId`+`version` as a single indivisible
revision identifier (Step 11/Step 04 invariant), there is no existing per-projection ETag utility,
and introducing one would require a combinatorial cache keyed by filter set for no confirmed
client requirement. A client that only ever requests a stable filtered subset will still benefit
from `304` as long as the _active manifest_ (not just its subset) is unchanged; a change to an
excluded dataset does invalidate the filtered client's cached ETag too, which is accepted as the
simpler, safer default (fail-refresh rather than fail-stale). The manifest ETag is computed
deterministically from `sha256(manifestId:version)` only — never `generatedAt`, request time,
correlation id, or object identity.

### 2.4 Controller (`src/reference-data/controller/`)

- `manifest-controller.js` — `createManifestController({ query, authenticationClient })` →
  `{ handler }`. The handler: extracts a bearer token from `Authorization`, calls
  `authenticationClient.authenticate({ token, correlationId })`, then
  `requireAuthenticatedActor` + `requireReadPermission` (both throw the standard error model on
  failure, handled globally by `error-response.js`), calls `query.getManifest({ include:
request.query.include })`, and returns `200`/`304` with `ETag` and `Cache-Control` headers
  (reusing `matchesIfNoneMatch` and `CACHE_CONTROL.REFERENCE_DATA_READ` from Step 13). No
  try/catch — errors propagate to the existing global error-response plugin.
- `index.js` keeps the existing `controller = { name: 'controller' }` boundary marker (still
  accurate — it identifies the module, not a single route) and additionally re-exports
  `createManifestController`.
- `src/routes/manifest.js` (new, following the existing thin `routes/health.js` /
  `routes/readiness.js` convention) composes the production route object from
  `MANIFEST_ROUTE_PATH`, the production `query` singleton, and the production
  `authenticationClient` singleton.
- `src/plugins/router.js` updated to register `manifest` alongside `health`/`readiness`.

### 2.5 Error-code decision

No dedicated `invalid_query_parameter` code exists in `SERVICE_ERROR_CODES`. Per the master plan's
"reuse existing approved code" fallback, `parseIncludeFilter` uses
`SERVICE_ERROR_CODES.INVALID_REQUEST` (→ `400`, code `invalid_request` in the public envelope),
consistent with how the existing route-validation failures are reported.

### 2.6 `map-ports` manifest decision

Omitted entirely, per the existing, already-enforced schema rule (`manifestDatasetEntrySchema`
rejects `dataset: 'map-ports'`) and the master plan's explicit statement that `map-ports` must
never appear in the manifest.

## 3. Files created

- `src/common/domain/route-paths.js` (+ test)
- `src/reference-data/query/manifest-include-filter.js` (+ test)
- `src/reference-data/query/manifest-projection.js` (+ test)
- `src/reference-data/query/query-service.js` (+ test)
- `src/reference-data/controller/manifest-controller.js` (+ test)
- `src/routes/manifest.js` (+ test)

## 4. Files modified

- `src/reference-data/query/index.js` — composes the real `query` singleton.
- `src/reference-data/controller/index.js` — re-exports `createManifestController`.
- `src/plugins/router.js` — registers the manifest route.
- `src/reference-data/reference-data-components.test.js` — replaces the `query` placeholder
  assertion with a dedicated contract-shape test.
- `src/server.test.js` — regression check that existing common-API-behaviour tests are
  unaffected (read-only verification, no edits expected unless a conflict is found).

## 5. Files intentionally left unchanged

- `src/common/domain/manifest.js` — stale JSDoc property names are a pre-existing, out-of-scope
  documentation gap (see §1); fixing it is not required to implement the runtime behaviour and
  touching it risks an unrelated diff.
- `src/reference-data/cache-refresh/**` — no behavioural change needed; the Query Module only
  reads what it already publishes to the store.

## 6. Test approach

- Unit: include-filter parsing/validation, manifest projection (ordering, URL mapping, format
  branching, ETag stability/sensitivity, ETag independent of filter/correlation/time), query
  service (unavailable manifest, successful retrieval, no cross-component calls), controller
  (200/304/401/403 paths, header behaviour) — all with in-memory/stub dependencies, no Hapi
  server required.
- Integration: `createServer()` + `server.inject`, registering the manifest route built from a
  stubbed `query`/`authenticationClient` pair (mirrors the existing `server.test.js` pattern of
  injecting test-only routes into a real server), covering `200`, filtered `200`, `400` (invalid
  include), `304`, `401`/`403`, and `503` (unavailable manifest) end-to-end through the real
  Hapi pipeline (correlation header, error envelope, Cache-Control).
- Regression: existing `npm test` suite re-run in full (Docker-free); no Floci dependency is
  introduced by this step.

## 7. Security & performance

- No S3/Floci access from the Query Module or Controller (verified by the existing
  `architecture-boundaries.test.js`, unaffected by this step).
- Bearer token never logged; only forwarded to `authenticationClient.authenticate`.
- `include` length/count are bounded before any dataset-registry lookup; no dynamic
  `import()`/object-path construction from user input.
- No S3/Floci calls, no full-collection scans, no manifest ETag recomputation cost beyond a
  single SHA-256 over two short strings; `304` responses never serialise a body.

## 8. Assumptions / deferred

- Authentication Service integration remains provisional (Step 12 decision); this step is simply
  its first real caller.
- OpenAPI/documentation artefacts are deferred to Step 31 (no OpenAPI spec exists in this
  repository yet); README will get a short Manifest API section instead, without inventing a new
  documentation format for this step alone.
