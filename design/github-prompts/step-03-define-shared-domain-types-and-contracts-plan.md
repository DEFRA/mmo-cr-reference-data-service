# Plan: Step 03 — Define Shared Domain Types and Contracts

## Repository inspection summary

- Plain JS/ESM, no TypeScript, no type-checker. Path alias `#/*` -> `./src/*`.
- Step 02 established `src/reference-data/{controller,validation,query,command,normalisation,in-memory-store,cache-refresh,persistence}/index.js` component markers, and `src/common/helpers/convict/*` custom Joi-backed formats.
- Conventions: named `const`/function exports, vitest `describe`/`test`/`test.each`, one `.test.js` per source file, kebab-case filenames, camelCase exports.
- No existing shared domain/constants/contracts modules to reuse or conflict with.

## Decisions

1. Domain shapes with no fixed vocabulary yet (`collections`, `manifest`, `query`, `upload`) are documented as JSDoc-typedef-only modules — no runtime constants/factories, since the repo has no type-checking pipeline to enforce them and inventing shapes now would be speculative ahead of Step 04's schemas.
2. Domain items with concrete vocabulary given in the prompt (`datasets`, `representations`, `validation` severity, `errors` codes, `authentication` permissions) become real frozen constants/enums with helper functions.
3. The four external-boundary contracts (Persistence repository, In-Memory store, Authentication client, canonical-to-mobile projector) use a `create*Contract(overrides)` factory whose default methods throw `"<method> is not implemented"` — never dummy data — allowing overrides for test doubles per the substitutability requirement.
4. `errors.js` gets real behaviour (`createServiceError`, `toPublicServiceError`) because required tests 15–16 explicitly need to prove `cause` is excluded from public serialisation.

## Steps

**Phase A — Domain constants and typedefs (`src/common/domain/`)**

1. `datasets.js` — `DATASETS`, `DATASET_FORMAT`, `DATASET_CAPABILITIES`, `isSupportedDataset`, `getDatasetCapabilities`, `isUploadableDataset`, `isQueryableDataset`, `isPersistedDataset`, `isDerivedDataset`. + `datasets.test.js`.
2. `representations.js` — `REPRESENTATIONS`, `isSupportedRepresentation`. + `representations.test.js`.
3. `collections.js` — JSDoc typedefs only: `JsonValue`, `CollectionEnvelope`, `CollectionMetadata`.
4. `manifest.js` — JSDoc typedefs only: `Manifest`, `ManifestDatasetEntry`.
5. `validation.js` — `VALIDATION_SEVERITY` enum + JSDoc typedefs `ValidationIssue`, `ValidationResult`. + `validation.test.js`.
6. `query.js` — JSDoc typedefs only: `QueryRequest`, `QueryFilters`, `PaginationRequest`, `SortingRequest`, `QueryResult`, `QueryMetadata`.
7. `upload.js` — JSDoc typedefs only: `UploadCommand`, `UploadResult`, `PreviousCollectionMetadata`, `UploadWarning`, `OptimisticConcurrencyInfo`.
8. `errors.js` — `SERVICE_ERROR_CODES`, `createServiceError`, `toPublicServiceError`. + `errors.test.js`.

**Phase B — External-boundary contracts (`src/common/contracts/`)** _(independent of Phase A)_ 9. `reference-data-repository.js` — `createReferenceDataRepositoryContract`. 10. `in-memory-data-store.js` — `createInMemoryDataStoreContract`. 11. `authentication-client.js` — `PERMISSIONS`, `createAuthenticationClientContract`. 12. `reference-data-projector.js` — `createReferenceDataProjectorContract`. 13. `contracts.test.js` — proves default-throw behaviour and override substitutability for all four.

**Phase C — Cross-cutting import test** _(depends on A & B)_ 14. `src/common/domain-and-contracts.test.js` — imports every new module in one file, proving no circular-import failures.

**Phase D — Documentation** _(depends on A & B)_ 15. Edit `README.md` — add a "Reference Data Domain Model" section covering datasets/capabilities, canonical vs mobile, GUID vs business identifiers, collection meaning, S3-as-durable-store vs in-memory cache, explicit no-database/no-Redis statement, and the four external-boundary contracts.

**Phase E — Save plan & verify** 16. Save this plan (this file) — first implementation action. 17. Run `npm run lint`, `npm run format:check`, `npm test`; start the app and confirm `/health` still responds.

## Relevant files

- New: `src/common/domain/{datasets,representations,collections,manifest,validation,query,upload,errors}.js` (+ tests where noted), `src/common/contracts/{reference-data-repository,in-memory-data-store,authentication-client,reference-data-projector}.js` + `contracts.test.js`, `src/common/domain-and-contracts.test.js`, this plan file.
- Modified: `README.md`.
- Unchanged: everything from Steps 01/02 (server, config, component markers, compose, Dockerfile).

## Out of scope

S3/repository implementation, in-memory store implementation, Authentication Service HTTP calls, canonical dataset schemas, GeoJSON schemas, normalisation, search/pagination, cache refresh, manifest API, upload parsing, OpenAPI.
