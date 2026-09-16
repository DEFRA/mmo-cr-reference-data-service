# Step 11 Implementation Plan: Cache Refresh Module and Startup Hydration

## 1. Repository state discovered

- `src/reference-data/cache-refresh/index.js` is still the Step 02 placeholder.
- `src/reference-data/in-memory-store/` (Step 05) already provides the exact contract this step
  needs: `setCollection`, `getCollection`, `getCollectionMetadata`, `hasCollection`,
  `listLoadedDatasets`, `setManifest`, `getManifest`, `clear` — all defensively cloned via
  `structuredClone`, and `setCollection`/`setManifest` are already atomic (validate-then-clone
  succeeds fully before the `Map`/variable is mutated, so a failed replacement never touches state).
- `src/reference-data/persistence/` (Step 07) already provides `fetchCollection`, `putCollection`,
  `fetchManifest` returning `{ content, metadata }`, with S3 error names mapped ahead of generic
  status (`NoSuchBucket`, `PreconditionFailed`, etc., verified in `error-mapping.js`).
- `src/reference-data/validation/` (Step 08/09) exposes `validateCollection` (combined structural +
  business) via its boundary `index.js`, but also the finer-grained internals
  `validateCommonEnvelope` and `resolveDatasetBusinessValidator` as plain named exports from their
  own files (not re-exported through `index.js`). `src/reference-data/normalisation/` similarly
  exposes `normaliseCollection`. The Step 10 integration tests already established the sanctioned
  pattern for composing structural → normalise → business manually (see
  `normalisation-integration.test.js`), which this step reuses for manifest/collection processing.
- No manifest structural/business validator exists yet at the Cache Refresh Module level (Step 08
  validated collection envelopes, not the manifest document itself as a stand-alone artefact).
- No readiness route/dependency-status model exists. `GET /health` is a bare liveness stub.
- `server.js` registers `pulse` (hapi-pulse, 10s shutdown timeout) — the existing shutdown hook
  this step's scheduler must register into.
- `config.js` now has (added by this step): `referenceData.refreshEnabled`,
  `.refreshInitialDelayMs`, `.hydrationTimeoutMs`, `.refreshConcurrency`, `.mandatoryDatasets`
  (defaults: enabled, 0ms, 10000ms, 3, all 6 non-derived datasets), reusing the existing
  `referenceData.refreshIntervalMs` (60000ms) for the periodic interval.

## 2. Owner-confirmed decisions

Mandatory datasets = all 6 non-derived datasets; hydration timeout 10000ms; refresh concurrency 3;
periodic interval reuses existing config — all now configurable via `config.js`, not hardcoded
(per owner instruction).

## 3. Proposed file structure

```
src/reference-data/cache-refresh/
  manifest-validation.js         (+ test)  structural + minimal business validation of the manifest document
  manifest-comparison.js         (+ test)  hasManifestEntryChanged(candidate, stored) — checksum > etag > version > lastModified
  dataset-processing.js          (+ test)  structural -> normalise -> business pipeline for one dataset's content
  cache-refresh-result.js        (+ test)  result/failure factories, deterministic ordering
  readiness-tracker.js           (+ test)  pure readiness state machine
  scheduler.js                   (+ test)  interval scheduler: start/stop/initial-delay, unref, no overlap
  cache-refresh-service.js       (+ test)  createCacheRefreshService({ persistence, store, config, logger }) -> { hydrate, refresh, startScheduler, stopScheduler, getReadinessState }
  index.js                       modified: production singleton composition
src/routes/
  readiness.js                   (+ test)  GET /health/ready using the service's readiness tracker
src/plugins/router.js             modified: register the readiness route
server.js                         modified: hydrate + startScheduler on server start, stopScheduler on stop
```

## 4. Startup hydration lifecycle

```
hydrate()
  -> dedupe concurrent callers (single in-flight promise)
  -> fetch + structurally/business validate the manifest (Persistence Module)
  -> for each manifest entry, process the dataset with bounded concurrency (dataset-processing.js)
  -> mandatory dataset failure/missing -> recorded, does not stop other datasets processing
  -> stage all successful entries, then publish atomically (store.setCollection + store.setManifest)
  -> update readiness tracker (ready only if every mandatory dataset has a valid entry)
  -> bounded by config.hydrationTimeoutMs (Promise.race against a timeout that never publishes)
```

## 5. Refresh lifecycle

```
refresh({ trigger })
  -> single in-flight guard (returns existing promise if one is running)
  -> fetch + validate the manifest
  -> compare each entry against the store's stationary metadata copy (manifest-comparison.js)
  -> process only changed/new datasets, concurrency-limited (config.refreshConcurrency)
  -> per-dataset failure retains the previous store entry (never calls setCollection on failure)
  -> per-dataset success replaces the store entry atomically
  -> manifest removed-mandatory-dataset -> treated as a failed dataset, previous entry retained
  -> manifest removed-optional-dataset -> retained (documented conservative policy, no removal)
  -> update readiness tracker only for mandatory-dataset outcomes
  -> returns a deterministic CacheRefreshResult
```

## 6. Contracts

```js
// cache-refresh-result.js
CacheRefreshFailure = { dataset, stage: 'manifest'|'persistence'|'structural-validation'|'normalisation'|'business-validation'|'publication', code, message, retryable }
CacheRefreshResult = { status: 'completed'|'completed-with-errors'|'skipped'|'failed', startedAt, completedAt, manifestChanged, refreshedDatasets: string[], unchangedDatasets: string[], failedDatasets: CacheRefreshFailure[], removedDatasets: string[] }
```

## 7. Readiness integration

`GET /health/ready` returns `200` with `{ ready: true, ... }` once every mandatory dataset is
hydrated, and `503` with `{ ready: false, reason, missingMandatoryDatasets, failedMandatoryDatasets
}` otherwise. `GET /health` (liveness) is left untouched — it never depends on hydration state.

## 8. Explicitly deferred

Authentication Service integration (Step 12), HTTP error-envelope mapping (Step 13), manifest API
(Step 14), query engine, uploads, seed data, metrics export (hooks only, no vendor).

## 9. Verification commands

```
npm run lint
npm test
npm run test:floci   (only if a Floci-specific regression check is needed; not required for new unit coverage)
```
