# Step 23 — Add Seed Reference Data and Deterministic Local Bootstrap: Implementation Plan

Treated as already approved per the Step 23 prompt's operating rules. Repository-specific,
based on the actual code found in this repository (not an empty template).

## 1. Current repository state discovered

- No seed/bootstrap resources or scripts existed anywhere in the repo prior to this step.
- **Persistence Module** (Step 07) already provides everything a bootstrap needs:
  `writeCollection` (immutable, throws `collection_version_exists` on key collision),
  `writeManifest({manifest, expectedEtag})` (conditional `IfMatch`, unconditional when
  `expectedEtag` omitted), `readManifest()` (throws `dataset_not_found` when absent).
  Bucket creation is **already** handled automatically by the existing Floci init script
  (`compose/floci/start.d/10-setup-resources.sh`, runs on every `floci:up`) — bootstrap
  does not need its own bucket-creation logic.
- **Step 22** (`command/replace-collection.js`) already implements the complete
  structural→normalise→business→persist→activate-manifest→publish-to-store workflow,
  per dataset, with correct optimistic concurrency and idempotency
  (same version + same checksum ⇒ no-op; same version + different checksum ⇒ `409`).
- `SEED_SCHEMA_VERSION`/object-key conventions/manifest schema are all unchanged and
  reused exactly as implemented in Steps 04/07/11.
- Existing single-item fixtures under `src/common/schemas/fixtures/valid/*.json` are
  already canonical and deterministic but are **test-only** fixtures (one record each,
  used to exercise schema/business-validator edge cases) — not representative enough
  for exercising read APIs (search, radius, bounding-box, name-resolution fallback,
  vessel-length bands, etc.), and the Step 21/22 plans already established the
  convention that runtime code must never import test-fixture paths. New, dedicated
  seed resources were created instead, per the prompt's own preferred structure.

## 2. Key design decision: no hand-authored `manifest.json` seed file

The prompt's suggested file listing includes a committed `manifest.json`. This is
**not** created. Rationale: the manifest schema requires `etag`/`checksum`/`sizeBytes`/
`lastModified` per dataset entry, and these values are only meaningful as the output of
an actual persistence write of the actual canonical (post-normalisation) bytes — hand
computing and committing them would be fragile (any accidental serialisation
difference invalidates them) and would violate "the Persistence Module owns
serialisation" boundary. Instead, **the bootstrap orchestrator calls the existing,
already-tested `replaceCollection()` (Step 22) once per maintained dataset**, in a
fixed order, with a fixed injected clock and a fixed manifest-ID fallback (see §3).
This produces a fully deterministic manifest as a natural _consequence_ of six
deterministic collection replacements — reusing 100% of Step 22's tested activation
logic (persist → conditionally activate manifest → publish locally) rather than
building a second, parallel manifest-construction path. This satisfies every manifest
requirement in the prompt (deterministic references, correct counts, correct object
keys, no `map-ports` entry) without the impossibility of committing pre-computed
checksums.

## 3. Minimal additive change to Step 22 (`replace-collection.js`)

`replaceCollection()` gained one new optional parameter, `manifestId`, used **only** as
a fallback when no active manifest exists yet (`activeManifest?.manifestId ??
manifestId ?? randomUUID()`). Existing callers (the real upload/replacement API route)
never pass it and are completely unaffected — they still get a random UUID on a true
first-ever manifest creation. The bootstrap orchestrator passes a fixed
`SEED_MANIFEST_ID` so that even a completely fresh bucket (e.g. after `floci:reset`)
always produces the same manifest identity, satisfying the "fixed valid GUIDs...
Manifest ID" requirement without ever needing to destructively pre-seed/overwrite an
existing manifest (unrelated pre-existing dataset entries are always preserved, exactly
as Step 22 already guarantees per-dataset).

## 4. Real bug found and fixed while Floci-testing this step

`reference-data-repository.js`'s `putCollection`/`putManifest` built their returned
metadata's `lastModifiedAt` from the AWS SDK response's `LastModified` field — but
`PutObjectCommand` responses **never include `LastModified`** (only `GetObject`/
`HeadObject` do). This previously produced `lastModifiedAt: null`, which fails the
manifest entry schema's `required()` `lastModified` timestamp field. This was invisible
to every existing Step 22 unit test because they use a fake persistence double that
always returns a fixed string. It only surfaced when this step's real Floci
integration test ran `replaceCollection()` against genuine S3-compatible responses.
Fixed by capturing an upload timestamp immediately before each `PutObjectCommand` call
and using it as a fallback when the SDK response omits `LastModified`. This is a
pre-existing Step 22/07 defect, not new Step 23 scope creep — necessary for Step 23's
own required Floci verification to pass, and it also fixes the real production
full-replacement API path (Step 22), which had the identical latent bug. A regression
unit test was added for both `writeCollection` and `writeManifest`.

## 5. Deterministic identifiers and versions

- All fixed GUIDs use the pattern `00000000-0000-4000-8000-{12-hex-digit sequential
counter}` (valid v4-shaped, unique by construction, easy to audit for collisions).
- Manifest ID: `00000000-0000-4000-8000-000000000001` (`SEED_MANIFEST_ID`).
- Every seed collection's `version` is the fixed string `"local-seed-1"`.
- Every seed collection's `generatedAt` and the manifest's `version`/`generatedAt` are
  the fixed timestamp `"2026-01-01T00:00:00Z"` (`SEED_TIMESTAMP`), supplied via an
  injectable fixed `clock` — never `Date.now()`/`new Date()`.
- `schemaVersion` is the fixed, currently-supported `"1.0"` (`SEED_SCHEMA_VERSION`).

## 6. Seed resources created (`resources/reference-data/seed/`)

- `vessels.json` — 3 vessels: distinct natural identifiers (CFR/MMSI/externalMark/
  registrationNumber), one under-10m, one 10-to-12m, one over-12m, one `inactive`
  status, valid `activeFrom`/`activeTo` ranges.
- `gears.json` — 2 categories, 2 characteristics (`dataType: "number"`), 3 gear items
  covering all three vessel-length bands, both `pairFishing` values, and both `true`/
  `false` combinations of `fixed`/`required`.
- `ports.json` — 3 ports: one with coordinates (map-port eligible), one with a
  leading-zero code (`GB007`) and coordinates, one without coordinates (valid in the
  JSON API, excluded from the derived map-port projection).
- `species.json` — 3 species demonstrating three different points in the mobile
  name-resolution fallback chain: an official `en-GB` local name, a common-name-only
  species, and a species with no common/local names at all (falls back to scientific
  name/FAO code).
- `map-land.geojson` — 2 small synthetic closed Polygon features.
- `map-statistical-areas.geojson` — 3 features: one parent area and two child areas
  with matching `parentCode` links, unique codes, closed rings.
- No `map-ports` file exists (derived dataset, never independently persisted).

All six files were verified against the real `validateCollectionUpload()` pipeline
(structural → normalise → business) during planning: every file is valid, and
normalisation makes **zero** changes to any of them (already fully canonical).

## 7. Bootstrap orchestration (`src/reference-data/command/`)

- `seed-loader.js` — fixed, allowlisted `dataset → filename` mapping (no dynamic path
  construction, no traversal); `loadSeedCollection(dataset)`/`getSeedFilePath(dataset)`/
  `SEED_DATASET_ORDER` (the canonical processing/manifest-entry order).
- `bootstrap-local-reference-data.js` — `bootstrapLocalReferenceData(deps)`:
  1. `assertLocalBootstrapAllowed(config)` — requires `cdpEnvironment === 'local'`,
     `NODE_ENV !== 'production'`, and a non-empty `aws.endpointUrl` (all three existing
     config values; no new environment variable; never inferred from the bucket name
     or a CLI flag alone).
  2. Sequentially (never concurrently — each `replaceCollection` call depends on
     reading the manifest state left by the previous one) calls `replaceCollection()`
     once per `SEED_DATASET_ORDER` entry, with the fixed clock/manifestId above.
  3. Classifies each outcome as `created`/`unchanged`/`replaced` and appends to the
     dataset-ordered summary; on the first `invalid` result or thrown error, stops
     immediately (no further datasets attempted) and marks `status: 'failed'` — because
     each already-completed dataset's manifest entry is already a fully independent,
     valid activation, a failure never leaves the manifest referencing anything
     unwritten or partial.
  4. Never touches the shared production `inMemoryStore` singleton — uses a fresh,
     throwaway `createInMemoryDataStore()` per invocation (the CLI process's own,
     isolated store; the _real_ running server always still needs its own normal
     `cacheRefresh.hydrate()` startup cycle to see the seeded data — bootstrap does not
     and cannot substitute for that).
- `bootstrap-cli.js` — thin explicit entry point, only ever invoked via
  `npm run reference-data:bootstrap`; never imported by application/server code.

## 8. Bucket / replacement / idempotency policy (resolving the prompt's flagged ambiguities)

- **Bucket creation**: already handled by the existing Floci init script; bootstrap
  only ever reads/writes objects through the existing Persistence Module contract.
- **Existing-object replacement policy**: policy 3 ("fail if an existing object
  differs") for collection objects — this is exactly Step 22's existing, unmodified
  immutable-write guard; no new logic needed. For the manifest specifically,
  unrelated pre-existing dataset entries are always preserved (Step 22 guarantee); our
  own six entries are replaced deterministically and safely via the existing
  optimistic-concurrency conditional write.
- **Additive vs reset-based**: additive. Bootstrap never wipes an existing valid
  manifest's other entries; it only ever creates/updates its own six maintained
  dataset entries.
- **Automatic startup seeding**: explicitly rejected. Bootstrap is only reachable via
  the explicit `npm run reference-data:bootstrap` command; ordinary server startup
  (`startCacheRefreshLifecycle()`) is completely unmodified and still expects the
  bucket/manifest to already exist.

## 9. Local-only safety

`assertLocalBootstrapAllowed` throws (caught by the CLI, `process.exitCode = 1`) unless
all three of: `cdpEnvironment === 'local'`, `NODE_ENV !== 'production'`, and
`aws.endpointUrl` is set (i.e. a local S3-compatible override is configured — real AWS
deployments leave this unset by design, per the existing Step 02 config doc comment).
No HTTP route exposes bootstrap. No credentials are logged (the CLI only logs the
returned summary object and safe `.message` strings from caught errors).

## 10. Files created

- `resources/reference-data/seed/{vessels.json,gears.json,ports.json,species.json,
map-land.geojson,map-statistical-areas.geojson}`
- `src/reference-data/command/seed-loader.js` (+ `.test.js`)
- `src/reference-data/command/bootstrap-local-reference-data.js` (+ `.test.js`,
  `.floci.test.js`)
- `src/reference-data/command/bootstrap-cli.js`
- `src/reference-data/command/seed-resources.test.js` (comprehensive per-dataset seed
  assertions: fixed GUIDs/versions/timestamps, structural/business validity, no
  normalisation drift, no collisions, no secrets, vessel-length-band coverage,
  fallback-chain coverage, closed/valid geometry, code/parent-code consistency)

## 11. Files modified

- `src/reference-data/command/replace-collection.js` — additive `manifestId` fallback
  parameter (§3).
- `src/reference-data/persistence/reference-data-repository.js` — `lastModifiedAt`
  fallback bug fix (§4), plus one new regression test each in
  `reference-data-repository.test.js` for `writeCollection`/`writeManifest`.
- `src/reference-data/command/index.js` — exports the new bootstrap/seed-loader
  functions and constants.
- `package.json` — new `reference-data:bootstrap` script; `test:floci` extended to
  also run the new bootstrap Floci test file.

## 12. Files intentionally left unchanged

Canonical schemas, dataset validators/normalisers, In-Memory Data Store, Cache Refresh
Module, Query Module, Authentication/Validation Module, Step 21/22 controller/route —
none required any change for this step beyond the one persistence bug fix above.

## 13. Test approach

- Docker-free unit tests: `seed-loader.test.js`, `seed-resources.test.js` (49+ dataset-
  specific assertions per §"Required unit tests" in the prompt),
  `bootstrap-local-reference-data.test.js` (local-only guard rejections, full
  activation, idempotent replay, unrelated-manifest-entry preservation, fail-fast on
  invalid seed data, no `map-ports` writes) — all using a lightweight fake persistence
  double (same pattern as `replace-collection.test.js`), never Floci/Docker.
- Floci integration test: `bootstrap-local-reference-data.floci.test.js` — self-skips
  when Floci is unreachable; verifies the real activation, idempotent replay, object
  readability, and startup-hydration-equivalent reconstruction against genuine
  S3-compatible responses. Its `beforeAll` only resets the active manifest to an empty,
  valid baseline when the current one is missing/structurally invalid — it never
  discards an already-valid manifest (so repeated `npm run test:floci` invocations
  within a single Floci lifetime stay purely idempotent).
- **Known, documented, pre-existing limitation**: the sibling
  `reference-data-repository.floci.test.js` file's own "manifest can be written and
  read back" test unconditionally overwrites the shared active manifest with a
  non-GUID `manifestId` and an empty `datasets` array. If that test runs _after_ this
  step's bootstrap Floci test in the same bucket lifetime, a subsequent bootstrap
  Floci run will detect the resulting manifest as invalid, reset to empty, and then
  collide with the (immutable, already-written) seed collection objects from the
  earlier run. This is **not** a Step 23 defect — it is pre-existing cross-suite
  behaviour in a test file this step did not modify. Documented as a troubleshooting
  note: run `npm run floci:reset` before `npm run test:floci` for a guaranteed-clean
  verification run (already true of this repo's Floci tests in general).

## 14. Verification commands

`npm run lint`, `npm run format:check`, `npm test` (Docker-free, 1352 passed / 10
skipped), `npm run floci:reset && npm run test:floci` (10/10 passed).

## 15. Deferred / out of scope

Production seeding, public bootstrap/reset endpoints, orphaned-object cleanup beyond
what Step 22 already guarantees, scheduled/automatic re-seeding, and anything else
explicitly excluded by the prompt's "Out of scope" section.
