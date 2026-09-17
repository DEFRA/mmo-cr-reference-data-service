# Step 22 — Implement Atomic Full Collection Replacement: Implementation Plan

Treated as already approved per the Step 22 prompt's operating rules. Repository-specific,
based on the actual code found in this repository.

## 1. Repository state discovered

- **Persistence Module** (`src/reference-data/persistence/reference-data-repository.js`,
  Step 07) already implements everything this step needs at the S3 layer:
  - `writeCollection({ dataset, collectionVersion, content })` — writes an **immutable**
    object (`IfNoneMatch: '*'` + a Floci-safe HeadObject pre-check) and throws
    `collection_version_exists` (409) if the key already exists, regardless of content.
  - `writeManifest({ manifest, expectedEtag })` — conditional write (`IfMatch`) that
    throws `collection_modified` (409) on a stale/mismatched ETag, or writes
    unconditionally when `expectedEtag` is omitted (first-ever manifest).
  - `readManifest()` — throws `dataset_not_found` when no manifest object exists yet
    (this is how "no active collection yet" is detected, not a special first-run flag).
  - `getObjectMetadata`/`objectExists` — HEAD-only, no checksum (checksum requires a full
    GET); not used by this step's common path (see §6 idempotency).
  - Object keys are centrally built and validated (`object-keys.js`): safe collection
    version pattern, no path traversal, dataset must be persisted.
  - Error mapping (`error-mapping.js`) already distinguishes `NoSuchBucket` from
    `NoSuchKey`/`NotFound`, precondition failures, throttling, credentials, etc. — all
    reused as-is.
- **Manifest schema** (`common/schemas/v1/manifest.js`): top-level
  `{ manifestId, version, generatedAt, datasets[] }`; each entry:
  `{ dataset, collectionId, schemaVersion, version, format, etag, checksum, itemCount,
sizeBytes, lastModified, objectRef? }`. `version` (not `collectionVersion`) is the
  field name inside a manifest entry — the Persistence Module's own return shape uses
  `collectionVersion`/`lastModifiedAt`, so the Command Module must map field names when
  building a manifest entry.
- **In-Memory Data Store** (Step 05, `in-memory-store/in-memory-data-store.js`):
  `setCollection(dataset, collection, metadata)` / `setManifest(manifest)` are already
  synchronous, defensively-cloning, and independently swappable per dataset — exactly
  the "atomic local publish" primitive this step needs. No extension required.
- **Query Module** (Step 15/18) computes every collection ETag deterministically as
  `calculateDeterministicEtag({ collectionId, version, ... })` from
  `store.getCollectionMetadata(dataset)` — **not** a separately stored ETag string. This
  means: as soon as the Command Module calls `store.setCollection()` with a metadata
  object containing the new `collectionId`/`version`, every read API and the Manifest
  API automatically reflect the new active state and produce new ETags. No Query Module
  changes are needed at all.
- **Cache Refresh Module** (Step 11) owns hydration/scheduled refresh only; its
  `refresh()` re-reads from persistence and would redundantly re-download the object we
  just wrote. Per the plan's own performance guidance ("avoid downloading the newly
  written collection when a safe canonical value is already available"), the Command
  Module publishes directly to the shared `inMemoryStore` singleton instead of calling
  into Cache Refresh — this is explicitly one of the two options the step prompt
  offers ("Preferred approach: ... OR avoid immediately redownloading").
- **Step 21** (`command/validate-collection-upload.js`) already implements the
  structural → normalise → business pipeline and deliberately does **not** return the
  normalised collection (privacy safeguard for the validation-only response). Step 22
  needs the actual normalised value to persist it, so the function gains one new
  optional parameter (`includeNormalisedCollection`, default `false`) that includes
  `result.collection` only when explicitly requested — Step 21's own controller/tests
  are unaffected (default unchanged).
- The upload route (`routes/upload-validation.js`) and controller
  (`controller/upload-validation-controller.js`) currently hard-require
  `validateOnly=true` (Step 21 scope). This step extends the _same_ route/controller
  (rather than adding a second one) to also support `validateOnly=false`/absent for full
  replacement, per the Step 22 prompt's explicit instruction to "extend the collection
  upload route."
- No existing GUID-generation helper exists elsewhere for manifest IDs; `node:crypto`
  `randomUUID()` is used directly (already an implicit Node global, no new dependency).
- No OpenAPI file exists in the repo (confirmed again; deferred to Step 31, same as
  Steps 14 and 21).

## 2. Gaps against Step 22

No manifest-construction, activation, in-memory-publication, concurrency, idempotency,
or conflict-detection code exists yet. No `PUT` route currently supports anything other
than `validateOnly=true`.

## 3. Proposed `If-Match` / manifest-concurrency policy (documented decision, not blocking)

Two independent concurrency layers, both implemented:

1. **Client-facing, optional `If-Match`** on the active _collection's_ deterministic
   ETag (the same value returned by every read endpoint). If supplied and it does not
   match the currently active entry's `calculateDeterministicEtag({collectionId,
version})`, fail fast with `409 collection_modified` before any I/O. If the dataset
   has no active collection yet and `If-Match` is supplied, also `409` (nothing to
   match). If omitted, no client-level precondition is enforced.
2. **Internal, always-enforced manifest-level optimistic concurrency**: the active
   manifest is read once at the start of the workflow; its ETag is passed as
   `expectedEtag` to the final `persistence.writeManifest()` call. Because Persistence
   Module's conditional `PutObject` (`IfMatch`) is evaluated by S3 _at write time_, this
   correctly rejects the "Writer A activates between Writer B's read and write" race
   without needing a second manual re-read — this is the real correctness guarantee,
   independent of whether the client supplied `If-Match` at all.

`If-Match` is therefore **not required** to prevent lost updates (that's the manifest
ETag's job) — it is an optional, best-effort, client-convenience precondition. This is
a documented simplification of the prompt's "preferred policy" (which described
requiring `If-Match` for existing collections) because no API design document or owner
confirmation exists specifying it as mandatory, and the mandatory manifest-level check
already guarantees correctness regardless. Flagged here, not treated as blocking.

## 4. Idempotency / version-conflict policy

- If the dataset's currently **active** manifest entry has the same `version` as the
  upload **and** the same content checksum → return a successful idempotent response
  (`idempotent: true`), performing **no** object write, **no** new manifest revision,
  and **no** in-memory republish.
- If the active entry has the same `version` but a **different** checksum → `409
collection_version_exists` (reusing the existing error code — the version is already
  taken by different content).
- An inactive/orphaned object that happens to already exist at the same key (never
  previously activated, or superseded by a later version) is **not** specially
  reconciled in this step — `persistence.writeCollection()`'s existing immutable-write
  guard will throw `collection_version_exists` in that case too, which is a safe,
  conservative (if slightly less precise) outcome. Fine-grained reuse of an inactive
  object is explicitly deferred to the rollback/recovery step (§17).

## 5. Manifest construction

- `manifestId`: preserved from the current active manifest; a new `randomUUID()` only
  when no manifest exists yet.
- `version`/`generatedAt`: both set to the injected clock's current ISO timestamp at
  activation time (`clock.now()` — same pattern as Cache Refresh Module's own
  `DEFAULT_CLOCK`). Simple, monotonic under a real clock, deterministic under a fake one
  in tests. Manifest `version` and collection `version` are stored as clearly distinct
  fields (`manifest.version` vs `datasets[].version`) exactly as the schema already
  requires.
- Entries are rebuilt as `[...unrelated entries, new/updated target entry]`, then sorted
  into the canonical `DATASETS` enum order (same determinism convention already used by
  `in-memory-data-store.js`'s `listLoadedDatasets()`), not insertion order.
- The rebuilt manifest is validated with the existing `validateManifest()` (Step 11)
  before being persisted — a defensive check that the Command Module never activates a
  structurally invalid manifest.
- `map-ports` can never appear (it is not in `isPersistedDataset`'s list, so it is
  already excluded from `DATASET_ROUTE_PATHS`/the uploadable-dataset Joi list upstream).

## 6. Metadata mapping (Persistence Module result → manifest entry)

`persistence.writeCollection()` returns `{ dataset, collectionVersion, objectKey,
format, contentType, etag, checksum, checksumAlgorithm, sizeBytes, lastModifiedAt }`.
The Command Module maps this to the manifest-entry shape: `version` ←
`collectionVersion`, `lastModified` ← `lastModifiedAt`, `collectionId` ← the _content's
own_ `collectionId` field (preserved GUID, never generated), `itemCount` ← counted from
the normalised collection's `items`/`features` length, `schemaVersion` ← the resolved
upload schema version. `objectKey`/`objectRef`/bucket name are never included in the
public API response.

## 7. Command Module workflow (`command/replace-collection.js`)

```
validateCollectionUpload (reused, Step 21, includeNormalisedCollection: true)
  -> invalid: return { outcome: 'invalid', stage, errors, warnings } (controller maps to 422)
  -> valid:
     load active manifest (readManifest, tolerating dataset_not_found as "none yet")
     find active entry for this dataset
     enforce optional client If-Match against the active entry's deterministic ETag
     compute canonical checksum of the normalised collection (persistence/checksum.js)
     if active entry version matches upload version:
       same checksum -> idempotent success (no writes)
       different checksum -> 409 collection_version_exists
     else:
       writeCollection (immutable write; throws collection_version_exists on key collision)
       build next manifest (preserve unrredated entries, replace target entry, new id/version)
       validateManifest (defensive)
       writeManifest (expectedEtag = active manifest's etag, or undefined if none existed)
       store.setCollection(dataset, normalised, newEntry)
       store.setManifest(nextManifest)
       return { outcome: 'activated', collection: newEntry, previousCollection: activeEntry, manifest, warnings }
```

A failed `writeCollection` never reaches manifest construction. A failed `writeManifest`
(stale ETag or any other persistence error) never reaches `store.setCollection`/
`setManifest` — the previous in-memory collection and manifest are left completely
untouched. In-memory publication happens only after both persistent writes succeed, and
`setCollection`+`setManifest` both execute synchronously with no `await` in between (no
window where collection data and manifest disagree in memory).

### In-memory publication failure (rare, documented)

If `store.setCollection`/`setManifest` throws after a successful manifest activation
(only possible for a genuinely non-cloneable value, which normalisation/validation
already rule out for real input), the error is re-thrown with `.partialFailure = true`
and `.retryable = true`, `.code = internal_error` — the manifest is already the
persisted source of truth, so the next scheduled Cache Refresh Module cycle (Step 11,
already running in the deployed service) will naturally reconcile process-local state.
No rollback of the already-activated manifest is attempted (rollback is explicitly
deferred to a later recovery step per the prompt).

## 8. Route / controller changes

- `routes/upload-validation.js`: `validateOnly` becomes
  `Joi.string().valid('true', 'false').optional()` (was `required()`/`'true'`-only).
  Absent or `'false'` → full replacement; `'true'` → Step 21 behaviour, unchanged. The
  production route now also injects the shared `persistence` and `inMemoryStore`
  singletons (mirroring how `query`/`cacheRefresh` compose them) and a real clock.
- `controller/upload-validation-controller.js`: branches on the parsed `validateOnly`
  flag. The Step 21 branch is untouched code (just now reached conditionally). The new
  branch calls `replaceCollection()`, maps `outcome: 'invalid'` the same way Step 21
  maps a failed validation (`422`, `schema_validation_failed`/`business_validation_failed`),
  and builds the success/idempotent response body, including the `ETag` response header
  (the same deterministic hash the read APIs use) and `Cache-Control: no-store`.
- `If-Match` request header is read directly (`request.headers['if-match']`), with
  surrounding quotes stripped; no Joi schema needed for it (free-form optional string).

## 9. Success / idempotent / conflict response shapes

Follow the prompt's example shapes closely, using only fields available from the
manifest-entry mapping above (no internal object keys, no bucket names). Idempotent
replies include `idempotent: true` and omit `previousCollection` (there is no
"previous" — the active collection did not change).

## 10. Exact files to create

- `src/reference-data/command/replace-collection.js` (+ `.test.js`)
- `src/reference-data/persistence/checksum.js` reused as-is (no change) — imported
  directly by the Command Module for the pre-write idempotency/conflict checksum
  (a pure function, not an AWS SDK call, so this does not violate "only the
  Persistence Module accesses S3": no S3 call is made here).
- No new controller/route files — `upload-validation-controller.js`/
  `upload-validation.js` are extended in place (see §8).
- `src/reference-data/command/index.js` (modify — export `replaceCollection`)
- `src/reference-data/command/validate-collection-upload.js` (modify — additive
  `includeNormalisedCollection` option)
- `src/reference-data/controller/upload-validation-controller.js` (modify)
- `src/routes/upload-validation.js` (modify)
- Corresponding `.test.js` updates/additions for all of the above, plus a focused
  `src/reference-data/command/replace-collection.floci.test.js` Floci integration test
  (self-skipping like the existing persistence Floci test, per repo convention).

## 11. Files intentionally left unchanged

`reference-data-repository.js`, `object-keys.js`, `error-mapping.js`, `checksum.js`,
`in-memory-data-store.js`, `cache-refresh-service.js`, all Query Module files, all
dataset validators/normalisers — every one of Step 22's needs is already satisfied by
their existing contracts.

## 12. Security, performance, and deferred work

Same authentication/authorisation, upload-size, media-type, and JSON-parsing
protections as Step 21 (fully reused, not duplicated). Checksum/normalisation computed
once and reused for both the idempotency check and the persisted write. No item-level
mutation route is introduced. Orphaned/unreferenced immutable objects, manifest
rollback, and distributed multi-instance cache coordination are explicitly deferred, as
instructed by the prompt.

## 13. Verification commands

`npm run lint`, `npm run format:check`, `npm test`, `npm run test:floci` (for the new
focused Floci test only — the rest of the suite stays Docker-free).
