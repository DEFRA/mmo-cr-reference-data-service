# Step 23: Add Seed Reference Data and Deterministic Local Bootstrap

## Recommended reasoning effort

- Planning phase: High
- Implementation phase: High
- Verification phase: High

## Role

Act as a senior Node.js backend engineer implementing the Reference Data Service for the Catch Recording application.

Implement seed reference data and deterministic local bootstrap exactly as defined by Step 23 of the approved Reference Data Service implementation plan.

Do not change, reorder, expand, reduce, or reinterpret the approved implementation plan.

## Approved objective

Provide representative, deterministic reference-data collections and a repeatable local bootstrap process that prepares the local S3-compatible environment for development and testing.

The bootstrap process must:

- Create or verify the configured local reference-data bucket.
- Load deterministic maintained reference-data collections.
- Store collections using the existing Persistence Module conventions.
- Create or replace the active manifest deterministically.
- Produce a local state that can be consumed by startup hydration.
- Support repeatable execution.
- Avoid generating different identifiers or versions on each run.
- Avoid requiring manual object creation.
- Avoid introducing production bootstrap behaviour.

## Approved dependencies

Before implementation, verify the required earlier steps are complete, including:

- Canonical schemas
- In-Memory Data Store
- Floci or approved local S3-compatible environment
- Persistence Module
- Structural and business validation
- Dataset-specific validation
- Canonical normalisation
- Cache Refresh Module and startup hydration
- Common API behaviour
- Full collection replacement where required by the approved step sequence
  Do not silently implement missing functionality belonging to another step.

If Step 22 has not been completed and Step 23 depends materially on its collection-replacement orchestration, stop and report the dependency rather than reimplementing Step 22 inside Step 23.

## Mandatory ambiguity rule

If any ambiguity, conflict, missing contract, missing fixture requirement, or inconsistency is discovered:

1. Stop the current planning or implementation activity.
2. Describe the exact ambiguity.
3. Identify the affected requirement, file, schema, contract, or previous step.
4. Show the relevant current implementation.
5. Present the smallest viable options.
6. Recommend one option with technical rationale.
7. Explain the impact of each option.
8. Ask me to clarify.
9. Wait for my response before proceeding.
   Do not resolve ambiguity through an undocumented assumption.

In particular, ask for clarification if the approved design or repository does not define:

- Whether bootstrap creates a missing bucket.
- Whether bootstrap may replace an existing active manifest.
- Whether existing local objects are deleted.
- Whether bootstrap is additive or reset-based.
- Whether bootstrap runs automatically or only through an explicit command.
- Whether startup hydration invokes bootstrap.
- Which datasets are mandatory.
- The exact seed collection versions.
- The exact seed manifest version.
- Whether seed data must demonstrate inactive records.
- Whether seed map data may use simplified synthetic geometry.
- Whether existing fixture files can be reused directly.
- Whether bootstrap validates and normalises seed files before persistence.
- Whether the process must work against AWS S3 or only the approved local emulator.
- Whether local authentication configuration is required.
- Whether object versioning is enabled locally.
- Whether ETags, checksums, or version IDs must be asserted.
- Whether a reset command is part of Step 23.
- Whether bootstrap must preserve unrelated objects in the bucket.
- Whether failures are atomic at the manifest level.
- Whether the operation is safe to run while the service is active.
  Do not invent these behaviours.

## Required working mode

Start in Plan mode.

Before changing source files:

1. Inspect the complete repository.
2. Read the approved Reference Data Service design.
3. Read the master implementation plan.
4. Read the approved prompts, saved plans, and completion summaries for all completed steps.
5. Inspect the current Git working tree:
   Shell

```text
git status --short
git diff --stat
git diff --name-only
```

1. Inspect:

- Floci configuration
- Docker Compose configuration
- Local environment configuration
- Bucket configuration
- Persistence Module interface and implementation
- Object-key conventions
- Active manifest contract
- Collection manifest-entry contract
- Startup hydration
- Cache refresh
- Canonical schemas
- Validators
- Normalisers
- Existing fixtures
- Existing package scripts
- Existing local-development scripts
- Existing test setup and teardown conventions

2. Determine whether seed files or bootstrap scripts already exist.
3. Verify existing files against Step 23 before replacing or duplicating them.
4. Identify all ambiguities before completing the plan.
   Do not modify source files during planning.

Produce a concise, repository-specific, file-by-file implementation plan.

Save the GitHub-generated plan as:

Plain Text

```text
design/github-prompts/Step 23-add-seed-reference-data-and-deterministic-local-bootstrap-plan.md
```

If the repository uses `github-prompts` at its root rather than `design/github-prompts` , use the established repository location while preserving the exact plan filename.

The saved GitHub-generated plan must be treated as already approved.

After saving the plan, continue directly with implementation without requesting plan approval.

Only stop when a material ambiguity, conflict, missing dependency, security concern, or incompatible bootstrap decision requires clarification.

The plan must be saved before implementation begins.

## Supported seed datasets

Create representative seed collections for all maintained datasets:

Plain Text

```text
vessels
gears
ports
species
map-land
map-statistical-areas
```

Do not create an independently persisted seed collection for:

Plain Text

```text
map-ports
```

`map-ports` remains derived from the active canonical ports collection.

Use the central dataset registry and capability definitions.

Do not duplicate the maintained dataset list unnecessarily.

## Seed-data principles

Seed data must be:

- Deterministic
- Synthetic
- Structurally valid
- Business-valid
- Canonically normalised
- Small enough for local development
- Representative enough to exercise read APIs
- Stable across bootstrap executions
- Safe to commit to the repository
- Free from real personal information
- Free from production reference data unless explicitly approved
- Free from credentials and secrets
  Do not use random identifiers, current timestamps, or generated versions.

## Deterministic identifiers

Use fixed valid GUIDs for:

- Collection IDs
- Manifest ID
- Vessel records
- Gear records
- Gear categories
- Gear characteristics
- Gear-to-characteristic relationships
- Port records
- Species records
- Species common names
- Species local names
- Land features
- Statistical-area features
  Requirements:

- Each GUID must remain stable across executions.
- GUIDs must satisfy the repository’s approved GUID format.
- GUIDs must be unique according to existing validation rules.
- Business codes must remain separate from GUIDs.
- Do not derive GUIDs from business codes.
- Do not generate GUIDs during bootstrap.
- Do not reuse one nested species-name GUID across common and local names.
- Do not reuse relationship GUIDs for entity GUIDs.

## Deterministic versions and timestamps

Use fixed approved values for:

- Manifest version
- Manifest generation timestamp
- Collection versions
- Collection generation timestamps
- Effective dates
- Active dates
- Last-modified metadata only where controlled by the seed contract
  Requirements:

- Do not use `Date.now()` .
- Do not use the current date.
- Do not use random version suffixes.
- Repeated bootstrap runs must use the same source versions.
- The active manifest must reference the seeded collection versions exactly.
- Tests must run deterministically under `TZ=UTC` .
  If S3-compatible last-modified timestamps are generated by the emulator, do not treat those values as deterministic seed inputs.

## Seed vessels

Provide a focused vessel collection that exercises:

- Stable vessel GUIDs
- Vessel names
- `namePln`
- CFR
- UVI where appropriate
- MMSI as a string
- IRCS where appropriate
- External mark
- Registration number
- Registration country code
- Vessel type
- Positive vessel length
- Active dates
- Active-state behaviour where supported
- Mobile projection behaviour
- Search behaviour
  Requirements:

- Preserve leading zeros in identifiers where meaningful.
- Include only synthetic vessel data.
- Do not include owner data.
- Do not infer home ports.
- Ensure every vessel has at least one approved natural identifier.
- Ensure natural identifiers satisfy uniqueness rules.
- Ensure date ranges are valid.

## Seed gears

Provide a focused gear collection that exercises:

- Gear GUIDs
- Gear codes
- Gear names
- Gear categories
- Category GUID relationships
- Characteristic definitions
- Characteristic GUID relationships
- Approved characteristic data type
- Units
- Minimum and maximum values
- Pair-fishing behaviour
- `fixed`
- `required`
- Vessel-length applicability
  Use the approved characteristic data type:

Plain Text

```text
number
```

Use the exact approved canonical vessel-length bands:

Plain Text

```text
under-10m
10-to-12m
over-12m
``
```

Requirements:

- Every category reference resolves.
- Every characteristic reference resolves.
- Minimum values do not exceed maximum values.
- Applicable characteristics contain approved length bands.
- Preserve `fixed` and `required` independently.
- Include enough data to exercise the mobile gear projection.
- Do not introduce unapproved characteristic data types.

## Seed ports

Provide a focused port collection that exercises:

- Port GUIDs
- Port codes as strings
- Leading-zero port codes
- Port names
- Country codes
- Valid coordinates
- A valid port without coordinates, if allowed
- Active-state behaviour where supported
- General search
- Radius search
- Bounding-box map projection
  Requirements:

- Valid coordinates must use canonical named latitude and longitude properties.
- Coordinates must remain inside WGS84 ranges.
- Do not infer coordinates.
- Do not create a persisted `map-ports` collection.
- Ensure at least one port can be projected into the derived map-port layer.
- Ensure a port without coordinates remains valid in the standard JSON API but is omitted from map projection.

## Seed species

Provide a focused species collection that exercises:

- Species GUIDs
- FAO codes
- Scientific names
- Country-scoped common names
- Local names
- Language codes
- Official-name indicators
- The complete mobile name-resolution fallback sequence where practical
- General search
- Country-code filtering
- Language-code filtering
  Requirements:

- FAO codes must be unique according to approved rules.
- Nested-name GUIDs must satisfy the approved collection-wide uniqueness rule.
- Official-name combinations must satisfy Step 09 validation.
- Include synthetic names that are safe for local development.
- Do not translate or generate names during bootstrap.
- Preserve source-array ordering where name resolution relies on canonical order.

## Seed map land

Provide a small synthetic GeoJSON `FeatureCollection` for:

Plain Text

```text
map-land
```

Requirements:

- Use valid feature GUIDs.
- Use approved Polygon or MultiPolygon geometry.
- Use numeric WGS84 coordinates.
- Use longitude-first coordinate order.
- Use closed polygon rings.
- Use non-empty geometry.
- Keep the fixture small.
- Do not use production coastline data.
- Do not copy licensed external map data.
- Ensure the geometry supports the approved bounding-box tests and local API demonstrations.

## Seed statistical areas

Provide a small synthetic GeoJSON `FeatureCollection` for:

Plain Text

```text
map-statistical-areas
```

Requirements:

- Use valid feature GUIDs.
- Use unique statistical-area codes.
- Include names and area types where required.
- Include optional parent codes where useful.
- Do not require a parent feature to exist in the same collection unless the approved model has changed.
- Use valid Polygon or MultiPolygon geometry.
- Use numeric WGS84 coordinates.
- Use longitude-first coordinate order.
- Use closed rings.
- Use non-empty geometry.
- Keep fixtures synthetic and small.
- Ensure data supports code, parent-code, and bounding-box queries.

## Canonical seed files

Store seed collections as declarative JSON or GeoJSON files according to repository conventions.

Preferred structure:

Plain Text

```text
resources/
  reference-data/
    seed/
      vessels.json
      gears.json
      ports.json
      species.json
      map-land.geojson
      map-statistical-areas.geojson
      manifest.json
```

Adapt this structure to the existing repository.

Do not embed large seed collections directly in executable JavaScript.

Requirements:

- Use lowercase kebab-case filenames.
- Keep files formatted consistently.
- Ensure each seed file passes its canonical schema.
- Avoid duplicate fixture content where existing canonical fixtures can be safely reused.
- Do not make runtime code import test-only fixture paths.
- Separate committed seed resources from transient test output.
- Do not include `.meta.md` or conversation artifacts as bootstrap inputs.

## Manifest seed

Create a deterministic active manifest referencing all maintained seed collections.

The manifest must include the fields required by the implemented manifest contract, such as:

- Manifest GUID
- Manifest version
- Generated timestamp
- Dataset entries
- Collection GUIDs
- Schema versions
- Collection versions
- Object keys
- Formats
- Counts
- Checksums or ETags where the contract requires them
- Size metadata where required and deterministically available
  Requirements:

- Use the existing manifest contract exactly.
- Use the existing object-key builder.
- Do not invent a second manifest format.
- Do not include `map-ports` as a persisted collection.
- Ensure every manifest object key resolves to a seeded object.
- Ensure every configured mandatory dataset is represented.
- Ensure metadata matches the corresponding seed collection.
- Do not hardcode object-key logic independently from the Persistence Module conventions.

## Bootstrap operation

Implement an explicit local bootstrap operation equivalent to:

Plain Text

```text
bootstrapLocalReferenceData(options)
```

The operation must:

1. Verify that execution is allowed in the local environment.
2. Load the committed deterministic seed files.
3. Parse the files safely.
4. Validate structural conformance.
5. Canonically normalise the seed data.
6. Run common and dataset-specific business validation.
7. Verify counts and metadata.
8. Create or verify the configured local bucket according to the approved policy.
9. Write collection objects through the Persistence Module or approved local infrastructure boundary.
10. Write the active manifest only after all required collection objects are available.
11. Return a structured bootstrap summary.
12. Fail safely without publishing a partial active manifest.
13. Avoid modifying the process-local In-Memory Data Store directly.
14. Allow normal startup hydration to load the seeded active state.
    Do not bypass validation merely because seed files are committed to the repository.

## Explicit command

Expose bootstrap through an explicit package command.

Use a name consistent with repository conventions, equivalent to:

Shell

```text
npm run reference-data:bootstrap
`
```

If a bootstrap or seed script already exists, align with it rather than adding a competing command.

Requirements:

- The command must exit non-zero on failure.
- The command must provide concise safe output.
- The command must not display complete seed files.
- The command must not display credentials.
- The command must be deterministic.
- The command must be suitable for local developer use.
- The command must not run silently as part of ordinary production startup.

## Automatic startup behaviour

Do not automatically seed local data during ordinary service startup unless the approved design explicitly requires it.

Preferred policy:

- Bootstrap is an explicit local-development command.
- Startup hydration expects the bucket and active manifest to exist.
- Local setup documentation instructs developers to start Floci and run the bootstrap command.
- Re-running bootstrap restores the approved deterministic local state.
  If automatic bootstrap is required, it must be:

- Explicitly enabled through local-only configuration.
- Disabled by default.
- Prohibited in production.
- Idempotent.
- Safe against accidental data replacement.
  Do not introduce automatic production seeding.

## Local-only protection

Bootstrap must not run against production inadvertently.

Implement safeguards using existing environment and endpoint configuration.

Requirements:

- Require an approved local-development environment.
- Reject production mode.
- Reject non-local endpoints unless explicitly approved.
- Do not rely only on bucket name as a safety check.
- Do not log credentials.
- Do not weaken TLS or credential validation globally.
- Do not add a production route that triggers bootstrap.
- Do not expose bootstrap through the public Reference Data API.
- Do not infer local safety from a caller-provided command-line flag alone.
  If reliable environment detection is unavailable, stop and ask for clarification.

## Bucket handling

Use the existing configured bucket name:

Plain Text

```text
REFERENCE_DATA_BUCKET
```

Preserve the previously approved local default where present.

Do not introduce another bucket-name environment variable.

Use the existing local S3-compatible endpoint and credential configuration.

The bucket policy must be explicit:

- Create the missing local bucket if approved.
- Treat an existing bucket as reusable.
- Do not recreate an existing bucket unnecessarily.
- Do not delete the bucket.
- Do not modify unrelated bucket configuration.
- Do not create a production bucket.
- Distinguish `NoSuchBucket` from missing objects.
  Use existing persistence or local-infrastructure helpers.

Do not spread raw AWS SDK bucket operations through application code.

## Idempotency

Bootstrap must be safe to run repeatedly.

For the same committed seed resources and configuration, repeated executions must produce the same logical active state:

- Same manifest GUID
- Same manifest version
- Same collection GUIDs
- Same collection versions
- Same object keys
- Same collection contents
- Same active dataset selection
  Requirements:

- Do not generate random identifiers.
- Do not generate timestamps.
- Do not append duplicate manifest entries.
- Do not create a new collection version on each run.
- Do not rely on S3 listing order.
- Do not fail merely because objects already exist when they match the deterministic seed state.
- Detect or replace divergent local objects according to the approved policy.
- Return a summary distinguishing created, unchanged, and replaced objects.
  Physical S3-compatible metadata such as last-modified timestamps may differ after replacement, but logical active state must remain deterministic.

## Replacement policy

The plan must inspect and document the approved behaviour when deterministic object keys already exist.

Possible policies include:

1. Verify and retain matching objects, but replace divergent objects.
2. Always overwrite seed object keys.
3. Fail if an existing object differs.
4. Use a separate explicit reset mode.
   Do not select a destructive policy silently.

Use the existing persistence precondition and ETag behaviour where applicable.

Do not weaken optimistic concurrency protections globally.

## Atomic manifest publication

The active manifest must be written only after every required seed collection has been successfully:

- Parsed
- Validated
- Normalised
- Serialised
- Written or verified
  Requirements:

- Do not publish a manifest referencing missing objects.
- If collection preparation fails, write no active manifest.
- If one collection write fails, do not publish the new manifest.
- Preserve an existing valid manifest where possible when bootstrap fails.
- Use the existing Persistence Module manifest write operation.
- Preserve its concurrency and error-mapping behaviour.
- Do not inspect raw AWS SDK exceptions outside persistence.
- Do not expose partially prepared state as active.
  If full rollback of newly written inactive objects is not supported, report possible orphan objects safely and defer cleanup according to the approved architecture.

## Validation and normalisation

Every seed collection must pass the same pipeline used for externally supplied collections:

Plain Text

```text
parse
  -> structural validation
  -> canonical normalisation
  -> business validation
  -> persistence
```

Requirements:

- Do not create a special permissive seed validator.
- Do not skip dataset-specific rules.
- Do not automatically repair invalid seed data during bootstrap.
- Treat normalisation warnings according to the approved policy.
- Prefer committing already canonical seed files.
- Fail bootstrap when committed seed data is invalid.
- Report dataset and validation stage safely.
- Do not persist invalid seed content.

## Persistence integration

Use the existing Persistence Module contract for:

- Collection writes
- Collection reads where verification is required
- Manifest writes
- Manifest reads
- Object metadata where required
  Only the Persistence Module may interact with S3 or Floci.

The bootstrap orchestration must not:

- Import AWS SDK commands directly.
- Interpret raw AWS SDK errors.
- Duplicate object-key construction.
- Duplicate persistence serialisation.
- Bypass concurrency controls.
- Write arbitrary local file paths as object keys.
  If bucket creation remains an infrastructure responsibility outside the Persistence Module, use the existing approved local infrastructure helper and keep it separate from application persistence.

## Startup hydration verification

After bootstrap succeeds, verify that the existing startup hydration process can:

1. Read the active manifest.
2. Retrieve all mandatory collections.
3. Parse the seeded objects.
4. Validate and normalise them.
5. Publish them atomically to the In-Memory Data Store.
6. Mark readiness as ready.
7. Serve existing manifest and read APIs.
   Do not add special seed-only hydration behaviour.

The seeded persisted data must be indistinguishable from valid active data created through the approved replacement workflow.

## Bootstrap result

Return or print a safe structured summary equivalent to:

JSON

```text
{
  "status": "completed",
  "bucket": "mmo-cr-reference-data-service",
  "manifestVersion": "local-seed-1",
  "createdDatasets": [
    "vessels",
    "gears",
    "ports",
    "species",
    "map-land",
    "map-statistical-areas"
  ],
  "unchangedDatasets": [],
  "replacedDatasets": [],
  "failedDatasets": []
}
```

Adapt to repository conventions.

Requirements:

- Use deterministic dataset ordering.
- Do not include credentials.
- Do not include complete object contents.
- Avoid exposing internal endpoints.
- Include failure stage and safe error code when unsuccessful.
- Do not claim completion if the manifest was not published.
- Do not include `map-ports` as persisted data.

## Logging

Use existing structured logging conventions.

Safe bootstrap logs may include:

- Operation ID
- Environment
- Bucket identifier where approved
- Dataset
- Collection version
- Manifest version
- Object status
- Validation result
- Normalisation warning count
- Duration
- Final status
- Failure stage
- Safe error code
  Do not log:

- Credentials
- Access keys
- Secret keys
- Complete seed collections
- Complete GeoJSON geometry
- Complete vessel identifiers
- Raw AWS SDK errors
- Internal stack traces in ordinary expected failures
- Full endpoint URLs containing credentials

## Security requirements

- Restrict bootstrap to approved local environments.
- Do not expose bootstrap through an HTTP endpoint.
- Do not include secrets in seed files.
- Do not log credentials.
- Do not use production data.
- Do not use personal data.
- Do not use unapproved copyrighted map data.
- Validate every seed collection.
- Do not permit path traversal through seed-file configuration.
- Use an allowlisted seed-file mapping.
- Do not dynamically execute seed files.
- Do not dynamically import arbitrary paths.
- Do not accept arbitrary bucket names from untrusted runtime input.
- Preserve existing S3 endpoint and credential validation.
- Do not disable TLS verification globally.
- Do not weaken persistence error handling.
- Do not introduce public reset or seed routes.
- Review new dependencies for maintenance, security, and licensing.

## Performance requirements

Seed data is intentionally small and representative.

Requirements:

- Read each seed resource once per bootstrap.
- Parse each collection once where practical.
- Avoid unnecessary deep clones.
- Validate and normalise through existing pipelines.
- Write each required object no more than necessary.
- Use controlled concurrency.
- Preserve deterministic result ordering.
- Avoid unbounded parallel operations.
- Do not load production-scale map files into seed resources.
- Keep bootstrap completion time suitable for local development.
- Record dataset and total duration.
  Do not introduce worker threads, streaming infrastructure, or external orchestration without evidence that the deterministic local seed set requires them.

## Required unit tests

Testing is part of Step 23 and must be completed during this step.

Add Docker-free unit tests using test doubles for persistence and bucket preparation.

### Seed-resource tests

Verify:

- Every required seed file exists.
- Every filename follows repository conventions.
- Every collection parses.
- Every collection declares the expected dataset.
- Every collection ID is a valid fixed GUID.
- Every collection version is fixed.
- Every collection timestamp is fixed.
- Every collection passes structural validation.
- Every collection passes canonical normalisation.
- Every collection passes business validation.
- Seed data is already canonical where expected.
- No seed resource contains secrets.
- No `map-ports` seed file exists.
- Deterministic identifiers do not collide.

### Vessel seed tests

Verify:

- Valid vessel GUIDs
- Required natural identifiers
- Identifier uniqueness
- MMSI remains a string
- Leading zeros are preserved where applicable
- Positive vessel lengths
- Valid date ranges
- Representative search fields
- Mobile projection compatibility

### Gear seed tests

Verify:

- Valid gear GUIDs
- Unique gear codes
- Valid category references
- Valid characteristic references
- Approved `number` data type
- Valid numeric ranges
- `fixed` and `required` preserved
- All approved vessel-length bands represented
- Mobile projection compatibility

### Port seed tests

Verify:

- Valid port GUIDs
- Unique port codes
- Port codes remain strings
- Leading-zero code preserved
- Valid country codes
- Valid coordinate ranges
- Coordinate pair completeness
- Port without coordinates where allowed
- Derived map-port compatibility
- Radius and bounding-box query compatibility

### Species seed tests

Verify:

- Valid species GUIDs
- Unique FAO codes
- Scientific names
- Country-scoped common names
- Local names
- Valid language codes
- Nested-name GUID uniqueness
- Official-name constraints
- Mobile fallback compatibility

### Map seed tests

Verify:

- Valid `FeatureCollection` roots
- Valid feature GUIDs
- Unique statistical-area codes
- Polygon and MultiPolygon support where represented
- Numeric coordinates
- Longitude-first order
- WGS84 ranges
- Closed rings
- Non-empty geometry
- Bounding-box query compatibility
- No production or licensed external map data

### Manifest seed tests

Verify:

- Manifest parses.
- Manifest ID is a fixed valid GUID.
- Manifest version is fixed.
- Manifest timestamp is fixed.
- Every mandatory maintained dataset is present once.
- `map-ports` is absent.
- Every object key follows existing conventions.
- Every referenced collection ID and version matches its seed resource.
- Formats match JSON or GeoJSON datasets.
- Item and feature counts match seed data.
- Dataset ordering is deterministic.
- No object reference is missing.

### Bootstrap orchestration tests

Verify:

- Local environment accepted.
- Production environment rejected.
- Missing bucket follows approved creation policy.
- Existing bucket is reused.
- Every seed collection is validated.
- Invalid seed data prevents persistence.
- Collections are written before the manifest.
- Manifest is written last.
- One collection failure prevents manifest publication.
- Existing valid manifest remains unchanged after failure where supported.
- Successful result identifies created datasets.
- Matching existing objects are identified as unchanged.
- Divergent objects follow the approved replacement policy.
- `map-ports` is never written.
- Persistence errors remain mapped through the existing error model.
- Input resources are not mutated.

### Idempotency tests

Verify two sequential bootstrap executions produce the same logical state:

- Same manifest ID
- Same manifest version
- Same collection IDs
- Same collection versions
- Same object keys
- Same serialised canonical contents
- No duplicate manifest entries
- No new version generated
- Correct created, unchanged, or replaced summary
- Deterministic dataset ordering

### Safety tests

Verify:

- No production bootstrap.
- No public route registration.
- No direct AWS SDK access outside approved boundaries.
- No arbitrary seed path loading.
- No path traversal.
- No credential logging.
- No complete collection logging.
- No direct In-Memory Data Store mutation.
- No automatic production startup seeding.
- No Redis dependency.

## Local Floci integration tests

Use the repository’s separate Floci test configuration and command:

Shell

```text
npm run test:floci
```

Do not add Docker requirements to ordinary `npm test` .

Add focused integration tests covering:

1. Start with the approved local Floci environment.
2. Bootstrap creates or verifies the configured bucket according to policy.
3. Bootstrap writes all six maintained collections.
4. Bootstrap writes the active manifest last.
5. Every manifest object key can be read.
6. Seeded objects deserialize correctly.
7. A second bootstrap execution succeeds.
8. Logical state after the second run is unchanged.
9. `map-ports` is not persisted.
10. Startup hydration loads the seeded collections.
11. Readiness succeeds after hydration.
12. The Manifest API returns seeded metadata.
13. Vessel read API returns seeded vessel data.
14. Gear read API returns seeded gear data.
15. Port read and map-port APIs use seeded ports.
16. Species read API uses seeded species data.
17. Map APIs return seeded GeoJSON.
18. Missing bucket remains distinguishable from missing object.
19. Failure before manifest publication does not activate partial data.
20. Test resources are isolated and cleaned up according to existing conventions.
    Do not duplicate the complete unit suite in Floci tests.

## Regression testing

Run existing tests for:

- Persistence
- Floci integration
- Structural validation
- Dataset-specific validation
- Canonical normalisation
- In-Memory Data Store
- Startup hydration
- Cache refresh
- Authentication
- Common API behaviour
- Manifest API
- Shared query engine
- Vessel API
- Gear API
- Port API
- Species API
- Map API
- Full collection validation mode
- Full collection replacement where already implemented
- Health and readiness
  Confirm:

- Existing object-key conventions remain unchanged.
- Existing S3 error precedence remains unchanged.
- `NoSuchBucket` remains distinct from missing object.
- Normal tests remain Docker-free.
- Floci tests remain separate.
- Seed bootstrap does not change production startup.
- No `map-ports` object exists.
- Query APIs use the hydrated seeded canonical collections.
- Active manifest entries and API metadata agree.

## Defra SonarCloud review

After implementation and tests pass, review every Step 23 source, script, fixture-related test, and configuration change against the configured Defra SonarCloud rules.

Use the repository’s configured SonarCloud project and:

Plain Text

```text
https://sonarcloud.io/organizations/defra/rules
```

Review especially for:

- Hardcoded credentials
- Secrets in seed resources
- Unsafe filesystem paths
- Path traversal
- Dynamic code execution
- Direct AWS SDK access outside approved boundaries
- Broad catch blocks
- Swallowed exceptions
- Unhandled promises
- Non-deterministic code
- Random identifiers
- Current-time dependencies
- Duplicate literals
- Magic numbers
- Excessive cognitive complexity
- Resource leaks
- Incomplete cleanup
- Sensitive-data logging
- Weak test assertions
- Large declarative data in executable JavaScript
- Mutable shared fixtures
- Unbounded concurrency
- Production environment bypass
- Public bootstrap exposure
  Use JSON and GeoJSON files for substantial declarative seed content.

Do not:

- Disable Sonar rules globally.
- Add broad suppression comments.
- Exclude bootstrap files.
- Weaken tests.
- Remove assertions.
- Commit secrets.
- Change approved persistence behaviour silently.
  If a Sonar finding requires a bootstrap-policy, security, persistence, or architecture decision, stop and ask for clarification.

If SonarCloud runs only in CI, report that final verification remains pending CI.

## Documentation requirements

Update focused local-development documentation covering:

- Purpose of deterministic seed data
- Supported seed datasets
- Absence of persisted `map-ports`
- Seed resource locations
- Fixed identifiers and versions
- Starting Floci
- Required local environment variables
- Running the bootstrap command
- Re-running bootstrap
- Approved replacement or reset behaviour
- Verifying bucket contents safely
- Running startup hydration
- Verifying readiness
- Testing Manifest API
- Testing each read API
- Running Floci integration tests
- Troubleshooting missing bucket
- Troubleshooting missing manifest
- Troubleshooting invalid seed data
- Troubleshooting bootstrap failure
- Local-only safety controls
- Work deferred to later steps
  Do not include real credentials.

Use placeholders for local credentials where necessary and follow existing repository conventions.

## Out of scope

Do not implement:

- Production data seeding
- Production bucket creation
- Public seed endpoints
- Public reset endpoints
- Automatic production bootstrap
- Item-level mutations
- New canonical schemas
- New validation rules
- New normalisation rules
- New query behaviour
- Independent `map-ports` persistence
- External data download
- Production map data import
- Database functionality
- Redis
- LocalStack
- MinIO
- New persistence providers
- Production IAM
- API Gateway changes
- Fargate changes
- Deployment automation
- Scheduled seed refresh
- Runtime synchronisation with external reference-data sources
- Destructive deletion of unrelated local bucket objects without explicit approval

## Required plan content

The GitHub-generated plan must include:

1. Current local-infrastructure setup.
2. Current Floci configuration.
3. Current bucket configuration.
4. Current Persistence Module interface.
5. Current object-key conventions.
6. Current manifest contract.
7. Current startup hydration behaviour.
8. Current seed or fixture resources.
9. Current package scripts.
10. Current test configurations.
11. Existing conventions to retain.
12. Gaps against Step 23.
13. Proposed seed-resource structure.
14. Proposed deterministic GUID strategy.
15. Proposed deterministic version and timestamp strategy.
16. Proposed vessel seed coverage.
17. Proposed gear seed coverage.
18. Proposed port seed coverage.
19. Proposed species seed coverage.
20. Proposed map-land seed coverage.
21. Proposed statistical-area seed coverage.
22. Proposed manifest seed.
23. Proposed bootstrap command.
24. Proposed local-only safeguards.
25. Proposed bucket handling.
26. Proposed existing-object replacement policy.
27. Proposed manifest publication order.
28. Proposed failure and partial-write behaviour.
29. Proposed validation and normalisation pipeline.
30. Proposed bootstrap result.
31. Proposed startup-hydration verification.
32. Exact files to create.
33. Exact files to modify.
34. Files intentionally left unchanged.
35. Docker-free unit-test approach.
36. Floci integration-test approach.
37. Regression-test approach.
38. Documentation updates.
39. Security considerations.
40. Performance considerations.
41. Defra SonarCloud review approach.
42. Verification commands.
43. Assumptions and unresolved ambiguities.
44. Work explicitly deferred.

## Expected deliverables

1. GitHub-generated plan saved as:
   Plain Text

```text
design/github-prompts/Step 23-add-seed-reference-data-and-deterministic-local-bootstrap-plan.md
```

1. Deterministic vessel seed collection.
2. Deterministic gear seed collection.
3. Deterministic port seed collection.
4. Deterministic species seed collection.
5. Deterministic map-land seed collection.
6. Deterministic map-statistical-areas seed collection.
7. Deterministic active manifest.
8. Explicit local bootstrap command.
9. Local-only execution safeguards.
10. Bucket creation or verification according to approved policy.
11. Seed validation and normalisation pipeline.
12. Collection persistence through approved boundaries.
13. Manifest-last publication.
14. Idempotent repeated execution.
15. Safe bootstrap summary.
16. Docker-free unit tests.
17. Focused Floci integration tests.
18. Startup-hydration verification.
19. Read API verification.
20. Regression verification.
21. Defra SonarCloud review.
22. Updated local-development documentation.
23. Step completion report.

## Acceptance criteria

- The plan is saved before implementation.
- The saved plan is treated as approved.
- Copilot does not request plan approval.
- All six maintained datasets have deterministic seed collections.
- `map-ports` has no persisted seed collection.
- Seed GUIDs are fixed and valid.
- Seed versions are fixed.
- Seed timestamps are fixed.
- Seed files contain no secrets or personal data.
- Seed map data is synthetic.
- Every seed file parses.
- Every seed file passes structural validation.
- Every seed file is canonical or normalises deterministically.
- Every seed file passes business validation.
- Every manifest reference resolves.
- Manifest counts match collection contents.
- Object keys use existing persistence conventions.
- Bootstrap is exposed through an explicit local command.
- Bootstrap is prevented from running in production.
- Bootstrap does not expose an HTTP endpoint.
- The configured local bucket is used.
- No duplicate bucket environment variable is introduced.
- Collection objects are written before the manifest.
- The active manifest is written last.
- A failed collection operation does not publish a partial manifest.
- Repeated bootstrap execution produces the same logical active state.
- No new random identifiers or timestamps are generated.
- Existing objects follow the documented replacement policy.
- `map-ports` is never written to persistence.
- Startup hydration can load all seeded mandatory collections.
- Readiness succeeds after hydration.
- Manifest and read APIs expose the seeded active data.
- Ordinary tests remain Docker-free.
- Floci tests remain under the separate command.
- Persistence error semantics remain unchanged.
- No database or Redis is introduced.
- No production seeding is introduced.
- Tests, coverage, linting, formatting, and build pass.
- Step 23 changes are reviewed against Defra SonarCloud rules.
- Documentation describes the complete deterministic local workflow.
- Work outside Step 23 remains deferred.

## Verification

Use the repository’s actual scripts.

Run the applicable equivalents of:

Shell

```text
npm test -- <seed-resource-tests>
npm test -- <bootstrap-unit-tests>
npm test -- <manifest-seed-tests>
npm test -- <startup-hydration-tests>
npm test -- <read-api-regression-tests>
npm test
npm run test:coverage
npm run lint
npm run format:check
npm run build
npm run test:floci
```

Run the repository’s Sonar or static-analysis command if available.

Explicitly verify:

Plain Text

```text
Step 23 plan saved
all seed resources present
all seed GUIDs fixed
all seed versions fixed
all seed timestamps fixed
vessel seed valid
gear seed valid
port seed valid
species seed valid
map-land seed valid
map-statistical-areas seed valid
map-ports seed absent
manifest seed valid
manifest references resolve
manifest counts match
local environment accepted
production environment rejected
missing local bucket policy
existing local bucket policy
collections written before manifest
manifest written last
failure prevents manifest publication
first bootstrap succeeds
second bootstrap succeeds
logical state identical after rerun
no duplicate manifest entries
no random identifiers
no current timestamps
startup hydration succeeds
readiness succeeds
manifest API returns seeded metadata
vessel API returns seeded data
gear API returns seeded data
port API returns seeded data
species API returns seeded data
map APIs return seeded GeoJSON
derived map-ports uses seeded ports
no persisted map-ports object
no direct AWS SDK access outside approved boundary
NoSuchBucket remains distinct from missing object
normal tests do not require Docker
Floci tests remain separate
no credentials logged
no complete seed collections logged
no production bootstrap
no public bootstrap route
```

Record:

- Exact commands
- Exit codes
- Test counts
- Coverage
- Type-check result
- Lint result
- Formatting result
- Build result
- Floci result
- Bootstrap output summary
- Idempotency result
- Startup-hydration result
- Read API verification
- Defra SonarCloud result
- Pre-existing failures
- Approved deviations
  If a command produces no output for more than two minutes:

1. Stop the command.
2. Report the exact command.
3. Report its last output.
4. Report whether the process remains active.
5. Wait for instruction before retrying.

## Completion response

After implementation, report:

1. Saved Step 23 plan path.
2. Summary of completed work.
3. Files created.
4. Files modified.
5. Seed-resource locations.
6. Seed datasets provided.
7. Deterministic GUID strategy.
8. Deterministic version and timestamp strategy.
9. Active manifest seed.
10. Bootstrap command.
11. Local-only safeguards.
12. Bucket behaviour.
13. Existing-object replacement policy.
14. Manifest publication order.
15. Partial-failure behaviour.
16. Validation and normalisation behaviour.
17. Idempotency verification.
18. Startup-hydration verification.
19. Read API verification.
20. Confirmation that `map-ports` was not persisted.
21. Unit-test results.
22. Floci integration-test results.
23. Complete test-suite result.
24. Coverage result.
25. Lint and formatting results.
26. Build result.
27. Defra SonarCloud review result.
28. Security controls.
29. Existing issues not introduced by Step 23.
30. Confirmation that no production bootstrap was introduced.
31. Confirmation that no database or Redis was introduced.
32. Work deferred to subsequent steps.
33. Remaining assumptions, risks, or owner decisions.
    Do not modify the approved implementation plan.

If you reach any ambiguity, ask me to clarify.
