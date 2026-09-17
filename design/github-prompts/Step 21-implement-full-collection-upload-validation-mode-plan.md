# Step 21 — Implement Full Collection Upload Validation Mode: Implementation Plan

This plan is treated as already approved per the Step 21 prompt's operating rules. It is
repository-specific, based on the actual code found in this repository (not an empty
template).

## 1. Repository state discovered

- **Command Module** (`src/reference-data/command/index.js`) is still the Step 02
  placeholder (`export const command = { name: 'command' }`) — no upload use case exists
  yet.
- **Controller** (`src/reference-data/controller/index.js`) only exports the Step 14
  `createManifestController`; `collection-route-controller.js` /
  `geojson-collection-route-controller.js` are read-only (Steps 15-20); `read-access.js`
  provides `requireReadAccess` but there is **no** `requireWriteAccess` counterpart yet.
- **Validation Module**: `validateCollection()` (`validation/validate-collection.js`) fuses
  structural (Step 04 schema) + common/dataset business validation (Step 08/09) into one
  pass **without** an intervening normalisation stage — it is used only by its own unit
  tests today, nothing else calls it.
- **Cache Refresh Module** (`cache-refresh/dataset-processing.js`) already implements the
  _correct_ stage order required by Step 21: **structural → normalise → business**, via
  `processDatasetCollection()` / `PROCESSING_STAGE`. This is the authoritative existing
  precedent for pipeline order, not `validateCollection()`.
- **Normalisation Module**: `normaliseCollection({ dataset, collection })` →
  `{ value, changed, warnings }`, guards unsupported/derived datasets by throwing (not a
  collection issue).
- **Config**: `referenceData.maxUploadBytes` (default 26,214,400 bytes) already exists
  (Step 02) and is unused until now.
- **Error model**: `SERVICE_ERROR_CODES` already contains every code this step needs
  (`INVALID_REQUEST`, `INVALID_JSON`, `UNAUTHORIZED`, `FORBIDDEN`, `FILE_TOO_LARGE`,
  `UNSUPPORTED_MEDIA_TYPE`, `SCHEMA_VALIDATION_FAILED`, `BUSINESS_VALIDATION_FAILED`), all
  already mapped to the correct HTTP status in `http-status.js`. No new error codes are
  needed.
- **Common API behaviour** (Step 13): errors are thrown as plain `Error` objects with
  `.code`/`.dataset`/`.retryable`/`.details` directly from route handlers — no
  try/catch/boomify needed, `error-response.js`'s global `onPreResponse` +
  `mapErrorToResponse` already do this. `CACHE_CONTROL.NO_STORE` already exists.
  `request.app.correlationId` is already populated by the `correlation` plugin.
- **Authentication** (Step 12): `authenticationClient` singleton + `requireWritePermission`
  already exist in `validation/index.js`; only the read path
  (`controller/read-access.js`) has been wired into a controller so far.
- **No multipart-parsing dependency exists** (no `formidable`/`busboy`/etc. in
  `package.json`). Confirmed empirically (see §4) that Hapi's own built-in
  `payload.multipart` support (`output: 'annotated'`) is sufficient — it returns
  `{ filename, headers, payload }` per file part, auto-parses `application/json` and any
  `+json` content type (so `application/geo+json` parses natively too), and falls back to
  a raw `Buffer` when the declared content-type is JSON-ish but the body fails to parse.
  No new dependency is required or added.
- **No OpenAPI spec file exists anywhere in the repo** (confirmed again for this step;
  deferred to Step 31, per the Step 14 precedent already recorded in repo memory).
- Route param/query validation with Joi + the existing global `failAction` already
  produces the standard `invalid_request` 400 envelope with structured `details` for free
  (`map-error-to-response.js`'s `extractJoiDetails`) — no bespoke query-validation code is
  needed for `dataset`/`validateOnly`.

## 2. Empirical Hapi multipart behaviour (verified against the real `@hapi/hapi` 21.4.10 in

this repo, via disposable local scripts, not committed)

- `payload: { multipart: { output: 'annotated' }, parse: true, allow: 'multipart/form-data', maxBytes }`
- A field with a `filename` in `Content-Disposition` becomes
  `{ filename, headers: { 'content-disposition', 'content-type', ... }, payload }`.
  - `content-type: application/json` or `application/geo+json` (or any `*/*+json`) with
    valid JSON body → `payload` is the parsed JS value (object/array/etc).
  - Same content-type but a body that fails to parse → `payload` is the raw `Buffer`
    (Hapi does **not** throw — this becomes our `invalid_json` signal).
  - Any other content-type (e.g. `text/csv`) → `payload` is the raw `Buffer`/string
    (unparsed) — this becomes our `unsupported_media_type` signal.
- Two parts with the same field name → the value becomes an **array** of the above shape
  (our "multiple files" signal).
- A plain (non-file) field, e.g. `schemaVersion`, stays a plain string — not wrapped.
- Oversized payloads (`maxBytes` exceeded) and disallowed outer content types
  (`allow: 'multipart/form-data'`) are rejected by Hapi itself as Boom `413`/`415` _before_
  the handler runs — already mapped correctly by the existing generic `mapBoomError`
  branches for those two status codes. No bespoke size/media-type-guard code is required
  for the **outer** request; only the **inner** file-part content-type needs an explicit
  check (done in `command/upload-request.js`).

## 3. Gaps against Step 21

- No upload route, no write-access helper, no Command Module upload use case, no
  request/response wiring for validation-only uploads.
- No pipeline function that runs structural → normalise → business specifically for a
  one-shot validation request (as opposed to `processDatasetCollection`, which is shaped
  for the Cache Refresh Module's own `content`/`stage` contract and is not reused
  as-is, to avoid coupling the Command Module to Cache Refresh internals — the same
  underlying primitives are reused instead, see §5).

## 4. Proposed route registration

- New path constant in `src/common/domain/route-paths.js`:
  `UPLOAD_ROUTE_PATH = ${API_BASE_PATH}/{dataset}` (distinct from the existing read
  `DATASET_ROUTE_PATHS`, which use nested map paths like `/map/land` — the upload route
  uses the literal dataset identifier as the path segment, per the approved step scope).
- `src/routes/upload-validation.js`: `PUT {UPLOAD_ROUTE_PATH}` with:
  - `options.validate.params`: `Joi.object({ dataset: Joi.string().valid(...uploadableDatasetIds) })`
    — `uploadableDatasetIds` computed once from `DATASETS`/`isUploadableDataset` (no
    second dataset list). Rejects unknown datasets and `map-ports` alike as `400`
    (`invalid_request`) via the existing Joi→Boom→`mapBoomError` path.
  - `options.validate.query`: `Joi.object({ validateOnly: Joi.string().valid('true').required() })`
    — strict; missing, `'false'`, or any other representation fails Joi validation (`400`).
    Real replacement (`validateOnly=false`/absent) is explicitly out of scope and is left
    for the atomic-replacement step to extend this same route.
  - `options.payload`: `{ multipart: { output: 'annotated' }, parse: true, allow: 'multipart/form-data', maxBytes: config.get('referenceData.maxUploadBytes'), output: 'data' }` (top-level `output` unused when `multipart.output` is set; kept minimal).
  - `handler`: the new `createUploadValidationController` handler.
- Registered in `src/plugins/router.js` alongside the existing routes.

## 5. Proposed Command Module use cases (pure, framework-agnostic, fully unit-testable)

### `src/reference-data/command/upload-request.js`

- `extractSingleUploadedFile(payload)` — validates exactly one `file` part is present
  (missing/array → throws `INVALID_REQUEST`), returns `{ contentType, payload }`.
- `parseUploadedFileContent({ dataset, file })` — compares the file's declared
  content-type (stripped of parameters, case-insensitive) against the dataset's expected
  format (`application/json` for JSON datasets, `application/geo+json` for GeoJSON
  datasets via `getDatasetCapabilities(dataset).format`); throws `UNSUPPORTED_MEDIA_TYPE`
  on mismatch, `INVALID_JSON` when the payload is a `Buffer` (parse failure), throws
  `INVALID_REQUEST` for a structurally empty object (`{}`) as the "empty file" case;
  otherwise returns the parsed collection value unchanged.
- `resolveUploadMetadata({ fields, collection })` — resolves `schemaVersion`/`version`
  from multipart fields vs the collection envelope, throwing `INVALID_REQUEST` on a
  conflict (both supplied and different); validates `effectiveFrom` (ISO-8601) and bounds
  `description` length when supplied; never mutates `collection`.

### `src/reference-data/command/validate-collection-upload.js`

- `validateCollectionUpload({ dataset, schemaVersion, collection, correlationId })` —
  the validation-only pipeline, reusing existing primitives directly (same approach as
  `cache-refresh/dataset-processing.js`, not calling the fused `validateCollection()`):
  1. Guard: `isSupportedDataset`/`isUploadableDataset`/`isSupportedSchemaVersion` →
     stage `PROCESSING_STAGE.STRUCTURAL_VALIDATION` on failure (reusing the enum
     exported from `cache-refresh/dataset-processing.js`, not re-declared).
  2. Structural: `getCollectionSchema` + `validateAgainstSchema`, mapped through
     `mapStructuralIssues` (newly exported from `validate-collection.js`, additive
     change only — see §7).
  3. Normalisation: `normaliseCollection` (Step 10, unchanged) — only runs once
     structural validation passes.
  4. Business: `validateCommonEnvelope` + `resolveDatasetBusinessValidator` (Steps 08/09,
     unchanged) — runs against the **normalised** collection.
  - Issues are collected with `createIssueCollector` (Step 08, unchanged) for
    deterministic ordering, bounding, and truncation — both normalisation warnings and
    business warnings are added via `collector.addWarning` (safe redaction is a bonus:
    only `code`/`message`/`path` survive, matching the plan's example response shape).
  - Returns `{ valid, stage, errors, warnings, receivedCount, normalisedCount, changed }`.
    The normalised collection itself is **never** returned (avoids accidentally exposing
    complete canonical data).

## 6. Proposed Controller

### `src/reference-data/controller/write-access.js`

- `requireWriteAccess(request, authenticationClient)` — mirrors `read-access.js` exactly,
  calling `requireWritePermission` instead of `requireReadPermission`.

### `src/reference-data/controller/upload-validation-controller.js`

- `createUploadValidationController({ authenticationClient })` returns `{ handler }`.
- Sequence: `requireWriteAccess` → `extractSingleUploadedFile` →
  `parseUploadedFileContent` → `resolveUploadMetadata` →
  `validateCollectionUpload` → build response.
- Success (`valid: true`): `200`, `Cache-Control: no-store`, body per the approved
  example shape (`dataset`, `valid`, `schemaVersion`, `version`,
  `receivedItemCount`/`receivedFeatureCount`, `normalisedItemCount`/
  `normalisedFeatureCount` chosen from `getDatasetCapabilities(dataset).format`,
  `changed`, `warnings`).
- Failure (`valid: false`): throws a plain `Error` with
  `.code = SCHEMA_VALIDATION_FAILED` (stage `STRUCTURAL_VALIDATION`) or
  `.code = BUSINESS_VALIDATION_FAILED` (stage `BUSINESS_VALIDATION`), `.dataset`,
  `.retryable = false`, `.details = errors` — the existing global error-response plugin
  produces the standard `422` envelope; no bespoke envelope-building code in the
  controller.
- All other failure modes (`INVALID_REQUEST`/`INVALID_JSON`/`UNSUPPORTED_MEDIA_TYPE`)
  are thrown as plain `Error`s from the command-module helpers and propagate the same way
  (`400`/`415`).

## 7. Exact files to create

- `src/common/domain/route-paths.js` (modify — add `UPLOAD_ROUTE_PATH`)
- `src/reference-data/command/upload-request.js` (new)
- `src/reference-data/command/upload-request.test.js` (new)
- `src/reference-data/command/validate-collection-upload.js` (new)
- `src/reference-data/command/validate-collection-upload.test.js` (new)
- `src/reference-data/command/index.js` (modify — export the two new functions)
- `src/reference-data/controller/write-access.js` (new)
- `src/reference-data/controller/upload-validation-controller.js` (new)
- `src/reference-data/controller/upload-validation-controller.test.js` (new)
- `src/routes/upload-validation.js` (new)
- `src/routes/upload-validation.test.js` (new, Hapi `server.inject` integration tests)
- `src/plugins/router.js` (modify — register the new route)
- `src/reference-data/validation/validate-collection.js` (modify — export the existing
  private `mapStructuralIssues` function; purely additive, no behaviour change, existing
  tests unaffected)

## 8. Files intentionally left unchanged

- `validate-collection.js`'s existing exported `validateCollection()` behaviour (still
  used by its own tests, and still valid for any future caller that genuinely wants the
  fused structural+business-without-normalisation check).
- `cache-refresh/dataset-processing.js` (its `PROCESSING_STAGE` enum is imported/reused,
  not duplicated; its own pipeline logic is not refactored to avoid risking Step 11
  regressions for an unrelated step).
- `normalisation/*`, `validation/datasets/*` dataset-specific rule implementations.
- No OpenAPI file is created (none exists in the repo; deferred to Step 31, as already
  decided for Step 14).

## 9. Unit-test approach

- `upload-request.test.js`: single/missing/multiple file, content-type match/mismatch
  per format, malformed-JSON Buffer fallback, empty-object file, metadata match/conflict
  for `schemaVersion`/`version`, valid/invalid `effectiveFrom`, description length bound,
  no mutation of inputs.
- `validate-collection-upload.test.js`: valid collection for each of the 6 uploadable
  datasets, `map-ports` rejected, unsupported dataset, unsupported schema version,
  structural failure (stage = structural), business failure — duplicate GUID/business
  code/item-count mismatch (stage = business), normalisation warnings surfaced and
  `changed: true`, deterministic/bounded issues, no mutation, no S3/Floci/Authentication
  Service/cache/in-memory-store interaction (asserted by construction — the module
  imports none of those).
- `upload-validation-controller.test.js`: handler-level tests with a fake
  `authenticationClient` and fake `request`/`h`, covering unauthenticated/unauthorised,
  success shape (JSON and GeoJSON dataset), validation-failure shape, no-store header.

## 10. Hapi.js integration-test approach

`upload-validation.test.js` uses `server.inject` with real `multipart/form-data` bodies
(built the same way as the empirical verification scripts) against a test server built
with `createTestAuthenticationClient`, covering: route registration, all 6 uploadable
datasets with valid fixtures, `map-ports` rejected (`400`), missing/empty/multiple file,
malformed JSON, wrong content type, oversized upload (via a small `maxBytes` override),
dataset mismatch, structural/business validation failure, normalisation warnings,
`validateOnly` variants (`true`/`false`/missing/invalid), authentication/authorisation
failure, `Cache-Control: no-store`, standard error envelope shape. Remains fully
Docker-free (no Floci/S3 involved by construction).

## 11. Regression-test approach

Run the full existing suite (`npm test`) to confirm no existing test is affected; the
only modified pre-existing files are `route-paths.js` (additive constant) and
`validate-collection.js` (additive export) and `router.js` (additive route
registration) — all backward compatible.

## 12. Documentation

No OpenAPI file exists to update. A short section will be added to `README.md`
describing the new endpoint, consistent with what previous steps have documented there
(kept concise, per the size of this change).

## 13. Security and privacy considerations

- Write permission (`reference-data.write`) strictly required; read permission alone is
  rejected by `requireWritePermission`'s exact-match check.
- Upload size bounded by Hapi's own `maxBytes` before any buffering completes.
- Exactly one file accepted; arrays (multiple files) rejected.
- Declared media type is validated per dataset format; filenames are never trusted for
  dataset selection or logging.
- No temp files are written to disk (Hapi's `output: 'annotated'` buffers in memory only,
  consistent with the existing bounded `maxBytes`).
- No persistence, in-memory store, cache-refresh, or Authentication Service call other
  than the one write-permission check.
- Full uploaded content is never logged; only safe scalar metadata (dataset, sizes,
  counts, stage, error/warning counts) would be logged if/when structured logging for
  this route is added (Step 25 owns metrics/audit; this step keeps the existing
  `requestLogger` plugin's default safe request logging only).

## 14. Performance considerations

Single JSON parse (performed once, by Hapi itself); no extra deep clones beyond what
`normaliseCollection`/`validateCollection` already do; bounded issue/warning collection
via the existing `createIssueCollector`/`MAX_VALIDATION_ISSUES`.

## 15. Verification commands

`npm run lint`, `npm run format:check`, `npm test` (Docker-free, includes coverage).

## 16. Assumptions and unresolved ambiguities

- The literal Step 21 prompt requires "structural → normalise → business" order as a
  completion criterion, but the only existing fused validator (`validateCollection`)
  does structural+business together with no normalisation step. Resolved by reusing the
  Cache Refresh Module's already-established (Step 11) correct pipeline order/primitives
  directly, rather than the fused function — documented here rather than raised as a
  blocking question, since it is a repository-internal implementation-detail choice, not
  a design conflict, missing contract, or destructive change.
- `schemaVersion`/`version` metadata conflict detection assumes the multipart field
  values are supplied as plain strings (no metadata schema versioning of its own).
- Real full replacement (`validateOnly=false`/absent) remains explicitly out of scope,
  left for the atomic-replacement step to extend the same route registration.

## 17. Work explicitly deferred to Step 22 (complete collection replacement)

Real persistence, manifest activation, in-memory replacement, cache refresh, rollback,
concurrency (`If-Match`) handling, and enabling `validateOnly=false`.
