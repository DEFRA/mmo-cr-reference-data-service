# Plan: Step 05 — Implement the In-Memory Data Store

## Repository inspection summary

- `src/reference-data/in-memory-store/index.js` was a stub (`{ name: 'in-memory-store' }`).
- Step 03 contract (`src/common/contracts/in-memory-data-store.js`) defines the exact method
  set to implement: `setCollection`, `getCollection`, `getCollectionMetadata`, `hasCollection`,
  `listLoadedDatasets`, `removeCollection`, `setManifest`, `getManifest`, `clear`. No changes
  needed to this contract.
- `src/common/domain/datasets.js` provides `DATASETS`, `isSupportedDataset`, `isDerivedDataset`
  — reused directly rather than creating a second dataset registry.
- `src/common/domain/errors.js` provides `SERVICE_ERROR_CODES`; existing repo convention
  (`getDatasetCapabilities`, schema registry) throws plain `Error` objects for internal guard
  conditions rather than throwing `createServiceError(...)` objects directly. Followed that
  convention, attaching `code`/`dataset`/`retryable`/`cause` properties to the thrown `Error`.
- Node engine is `>=24`, so `structuredClone` is available and used for all defensive cloning
  (write and read paths) — deep, type-preserving, no JSON round-trip data loss.
- `src/reference-data/reference-data-components.test.js` asserted every component stub equals
  `{ name: '<component>' }`; updated only the `inMemoryStore` assertion since its shape changed
  from a marker object to a real store implementation.

## Decisions

1. `createInMemoryDataStore()` is an explicit factory (no module-level singleton state inside
   the implementation file itself); `index.js` acts as the production composition root and
   exports one singleton (`inMemoryStore`) for the app, consistent with the Step 02 component
   boundary convention. Tests always create isolated instances via the factory.
2. The concrete implementation is built by passing real method implementations into
   `createInMemoryDataStoreContract({ ... })`, guaranteeing the returned object's shape always
   matches the Step 03 contract exactly.
3. "Not loaded" is represented as `undefined` (for collections, metadata, and manifest),
   distinguishable from a validly stored `null` or empty collection.
4. `listLoadedDatasets()` filters the canonical `Object.values(DATASETS)` order rather than
   relying on `Map` insertion order, giving a stable, documented ordering.
5. `setCollection` is both the initial-store and atomic-replace operation (the contract has no
   separate replace method). Atomicity is achieved by cloning the supplied collection and
   metadata into local variables first; the internal `Map` is only mutated after both clones
   succeed, so a cloning failure leaves any previous entry completely unchanged.
6. A light consistency check rejects `setCollection` calls where `metadata.dataset` (when
   present) does not match the `dataset` argument, protecting the store's own invariants without
   duplicating full schema/business validation (out of scope, Steps 08/09).

## Steps

1. `src/reference-data/in-memory-store/in-memory-data-store.js` — factory implementation.
2. `src/reference-data/in-memory-store/in-memory-data-store.test.js` — unit tests for
   construction, store/retrieve, loaded-state, atomic replacement, removal, manifest,
   listLoadedDatasets ordering, clear, and defensive-access (mutation protection).
3. `src/reference-data/in-memory-store/index.js` — export `createInMemoryDataStore` and the
   production `inMemoryStore` singleton.
4. `src/reference-data/reference-data-components.test.js` — updated `inMemoryStore` assertion.
5. `README.md` — new "In-Memory Data Store" section (purpose, process-local/non-durable, no
   DB/Redis, atomic replacement meaning, defensive-access strategy, loaded-state distinction,
   stable ordering, `map-ports` rejection, test-isolation guidance).
6. This plan file.

## Relevant files

- New: `src/reference-data/in-memory-store/in-memory-data-store.js`,
  `src/reference-data/in-memory-store/in-memory-data-store.test.js`, this plan file.
- Modified: `src/reference-data/in-memory-store/index.js`,
  `src/reference-data/reference-data-components.test.js`, `README.md`.
- Unchanged: Step 03/04 contracts, domain types, and schemas.

## Out of scope

S3/Floci access, cache hydration/refresh, Authentication Service integration, API routes,
querying/filtering, validation, normalisation, upload handling, manifest persistence to S3,
seed data, database or Redis of any kind.

## Verification

- `npx vitest run src/reference-data/in-memory-store src/reference-data/reference-data-components.test.js` — 47 passed.
- `npm test` (full suite + coverage) — 308 passed; `in-memory-store` at 100% line/function coverage.
- `npm run lint` — no issues.
- `npx prettier --check` on all changed files — pass.
