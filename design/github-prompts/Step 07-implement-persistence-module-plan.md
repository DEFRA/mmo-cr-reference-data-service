# Plan: Step 07 — Implement the Persistence Module

## Repository inspection summary

- `src/reference-data/persistence/index.js` was a stub (`{ name: 'persistence' }`).
- Step 03 contract (`src/common/contracts/reference-data-repository.js`) defines the exact
  method set implemented here: `readCollection`, `writeCollection`, `readManifest`,
  `writeManifest`, `getObjectMetadata`, `objectExists`. No contract changes were needed.
- `src/common/domain/datasets.js` (`isSupportedDataset`, `isPersistedDataset`, `DATASET_FORMAT`,
  `getDatasetCapabilities`) and `src/common/domain/errors.js` (`SERVICE_ERROR_CODES`) already
  provided everything required — reused directly, no second dataset registry or error model.
- `src/config.js` already had `aws.region`, `aws.endpointUrl`, `aws.forcePathStyle`, and
  `referenceData.bucket` (Step 02) — no configuration changes were needed.
- `@aws-sdk/client-s3` was not yet a dependency; added at `3.1119.0` (exact-pinned, matching the
  existing `@aws-sdk/credential-providers` version already in `package.json`).
- Investigated the running Floci container directly (continuing from Step 06) to ground this
  step's implementation in verified behaviour rather than assumptions:
  - AWS CLI v2 and the real AWS SDK v3 S3 client both work against Floci with
    `endpoint`/`forcePathStyle` set; no Floci-specific SDK branches were needed.
  - **Conditional-write limitation confirmed empirically**: Floci does **not** enforce
    `IfNoneMatch`/`IfMatch` on `PutObject` — four manual `aws s3api put-object` calls against a
    running Floci container, including ones that should have failed with `412
PreconditionFailed` on real AWS S3, all succeeded silently. This is exactly the
    "Floci differs from AWS S3" scenario the Step 07 prompt requires handling explicitly (see
    Decisions below).
  - S3-native checksums work: `PutObject --checksum-algorithm SHA256` plus
    `HeadObject`/`GetObject --checksum-mode ENABLED` return a real `ChecksumSHA256` via Floci,
    confirmed empirically.
  - `HeadObject` on a missing key returns a genuine `404`/`NotFound`; a duplicate `CreateBucket`
    (from Step 06 testing) returned `BucketAlreadyOwnedByYou` — both match real, non-`us-east-1`
    S3 semantics.

## Decisions

1. **Conditional-write safety on Floci (documented Floci limitation, smallest compatible fix)**:
   because Floci ignores `IfNoneMatch`/`IfMatch`, `writeCollection` and `writeManifest` perform an
   explicit `HeadObject` existence/ETag pre-check **in addition to** sending the correct
   conditional header. On real AWS S3 the header itself is atomic and authoritative; the pre-check
   is a defence-in-depth measure that also makes local Floci-backed development behave safely
   (non-atomically, but sufficient for a single local developer process). Production safety on
   real S3 is not weakened. Both a pre-check-detected conflict and a genuine S3-level
   `PreconditionFailed` (simulating a real race) map to the same result
   (`collection_version_exists` / `collection_modified`), verified by dedicated unit tests.
2. **Checksums**: SHA-256 is used, preferring the S3-native `ChecksumSHA256` (base64, requested
   via `ChecksumAlgorithm`/`ChecksumMode`) so `getObjectMetadata` can return a checksum without
   downloading the body; a manual `node:crypto` SHA-256 (also base64, for a consistent format) is
   computed as a fallback when reading a body directly or when the object lacks a native
   checksum. ETag is always kept as a separate, never-assumed-to-be-a-checksum field.
3. **Error throwing convention**: matches the Step 05 In-Memory Data Store precedent — thrown
   plain `Error` objects carrying `code`/`dataset`/`retryable`/`cause` (plus an internal
   `isServiceError` marker used only to distinguish already-mapped errors from raw AWS/system
   errors inside the module), rather than inventing a second error-returning model.
4. **Missing-manifest error code**: `SERVICE_ERROR_CODES` has no dedicated "manifest not found"
   code. `dataset_not_found` (with `dataset: null`) is reused for a missing manifest — the
   smallest compatible choice using only existing codes, rather than expanding the Step 03 error
   model without approval.
5. **Metadata shape**: `readCollection`/`readManifest`/`getObjectMetadata` return only
   S3-observable facts (`etag`, `checksum`, `checksumAlgorithm`, `sizeBytes`, `lastModifiedAt`,
   `contentType`, `objectKey`, `format`, `dataset`, `collectionVersion`) — not a fully populated
   Step 03 `CollectionMetadata`/`ManifestDatasetEntry` (business fields like `collectionId`,
   `schemaVersion`, `itemCount` live inside the stored content/manifest itself and are owned by
   later steps, not fabricated here).
6. **Object-key convention**: uses the convention already approved in the master implementation
   plan (`reference-data/manifest.json`, `reference-data/{dataset}/{version}.json`), matching
   Step 06 and this step's own prompt cross-reference to it. No conflict found.
7. Floci integration tests self-skip (`describe.skipIf`) when `http://localhost:4566/_floci/health`
   is unreachable, so `npm test` never requires Docker; `npm run test:floci` runs them explicitly
   (starting Floci first).

## Steps

1. `src/reference-data/persistence/s3-client.js` — S3 client construction (region, optional
   endpoint, path-style, DI of a test/adapter client; no network call on construction).
2. `src/reference-data/persistence/object-keys.js` — manifest/collection key construction, dataset
   and collection-version validation.
3. `src/reference-data/persistence/checksum.js` — SHA-256 checksum calculation and ETag
   normalisation (quote stripping).
4. `src/reference-data/persistence/response-body.js` — safe `GetObject` body handling (missing
   body, malformed JSON, fallback checksum from the raw text).
5. `src/reference-data/persistence/error-mapping.js` — AWS SDK/system error → service-error
   translation; internal `raisePersistenceError`/`mapS3Error` helpers.
6. `src/reference-data/persistence/reference-data-repository.js` — the contract implementation:
   `readCollection`, `writeCollection`, `readManifest`, `writeManifest`, `getObjectMetadata`,
   `objectExists`.
7. `src/reference-data/persistence/index.js` — production composition root wiring config into
   `createReferenceDataRepository`.
8. Unit tests: `s3-client.test.js`, `object-keys.test.js`, `checksum.test.js`,
   `error-mapping.test.js`, `reference-data-repository.test.js` (mocked S3 client).
9. Integration tests: `reference-data-repository.floci.test.js` (real Floci, self-skipping).
10. `src/architecture-boundaries.test.js` — confirms only the Persistence Module imports
    `@aws-sdk/client-s3`.
11. `src/reference-data/reference-data-components.test.js` — updated `persistence` assertion.
12. `package.json` — added `@aws-sdk/client-s3` dependency and a `test:floci` script.
13. `README.md` — new "Persistence Module" section; noted `test:floci` under Testing.
14. This plan file.

## Relevant files

- New: `src/reference-data/persistence/{s3-client,object-keys,checksum,response-body,error-mapping,reference-data-repository}.js`
  and their `*.test.js` files, `reference-data-repository.floci.test.js`,
  `src/architecture-boundaries.test.js`, this plan file.
- Modified: `src/reference-data/persistence/index.js`,
  `src/reference-data/reference-data-components.test.js`, `package.json`, `README.md`.
- Unchanged: Step 03 contracts/domain types, Step 04 schemas, Step 05 In-Memory Data Store,
  Step 06 Floci configuration.

## Out of scope

Cache hydration/refresh, In-Memory Data Store orchestration, validation, normalisation,
authentication, API routes, querying, upload handling, collection-activation workflow, rollback
orchestration, database or Redis of any kind, seed data (Step 23).

## Verification

- Unit tests (mocked S3 client): `npx vitest run src/reference-data/persistence
src/architecture-boundaries.test.js` — 87 passed, 6 skipped (Floci integration file, skips
  cleanly without Docker).
- Floci integration tests: `npm run test:floci` (starts Floci, then runs the `.floci.test.js`
  file against it) — 6/6 passed against a real Floci container.
- Full suite: `npm test` — 402/402 passed (with Floci up so integration tests also execute);
  386/392 passed + 6 skipped when Floci is down — confirming no Docker dependency for the default
  run.
- Coverage: persistence module at 98.46% lines/statements, 100% functions.
- `npm run lint` — no issues. `npx prettier --check` on all touched files — pass.
- Architecture-boundary test passes, confirming `@aws-sdk/client-s3` is imported only under
  `src/reference-data/persistence/`.
