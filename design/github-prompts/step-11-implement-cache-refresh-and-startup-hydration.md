# Step 11: Implement the Cache Refresh Module and Startup Hydration

## Recommended reasoning effort

- **Planning phase:** High
- **Implementation phase:** High

## Copilot operating mode

Start in **Plan mode** .

Before modifying source files:

1. Inspect the complete repository.
2. Read the approved Reference Data Service design.
3. Read the master implementation plan.
4. Read the approved plans and completion summaries from all completed steps.
5. Inspect the current Persistence Module, Validation Module, Data Normalisation Module, configuration, health and readiness implementation, tests, fixtures, and dependency-injection conventions.
6. Identify any existing in-memory storage, startup hydration, manifest loading, cache refresh, scheduling, or lifecycle code.
7. Produce a repository-specific implementation plan based on the code that actually exists.
   Do not assume that the repository is empty.

Do not duplicate existing suitable functionality.

After completing the plan, save it as:

Plain Text

```text
github-prompts/Step 11-implement-cache-refresh-and-startup-hydration-plan.md
```

Assume the saved plan is approved and continue directly with implementation unless:

- The proposed implementation conflicts with the approved architecture.
- A required upstream contract is missing.
- A schema or lifecycle decision is ambiguous.
- A destructive or incompatible change is required.
- The repository contradicts a material assumption in this prompt.
  The saved plan must be the first file created or modified for this step.

## Objective

Implement the **Cache Refresh Module** and the service's **startup hydration process** .

The implementation must load active reference-data collections from persistent storage into the process-local in-memory data store when the service starts, then periodically detect and refresh collections that have changed.

The implementation must:

- Use the active manifest as the persistent source of truth.
- Access S3 only through the Persistence Module.
- Hydrate mandatory collections before the service becomes ready.
- Validate and normalise persisted collections before making them available.
- Store parsed canonical JSON or GeoJSON objects in process memory.
- Detect changed collections using manifest metadata.
- Download and process only collections that changed.
- Replace each in-memory collection atomically.
- Continue serving the previous valid collection if a refresh fails.
- Prevent concurrent refresh executions.
- Support deterministic testing without waiting for real timers.
- Report readiness, refresh results, and failures accurately.
- Shut down refresh scheduling cleanly.
  This step must not implement public reference-data query endpoints, upload endpoints, mobile projections, authentication integration, or complete collection activation.

## Project context

The Reference Data Service is a Node.js and Hapi.js backend service for the Catch Recording application.

The maintained reference-data domains are:

- Vessels
- Gears
- Ports
- Species
- Map land
- Map statistical areas
  The derived `map-ports` view is not an independently maintained or persisted collection. It will be generated later from the active ports collection.

Reference-data collections are persisted as complete JSON or GeoJSON objects in an S3 bucket.

Local development uses Floci as the S3-compatible emulator.

The service uses process-local memory rather than Redis.

Because the in-memory data is process-local:

- Every service instance must hydrate its own state.
- A service restart clears the in-memory state.
- Startup must reconstruct state from the active manifest and persisted collections.
- Multiple Fargate tasks may refresh independently.
- No assumption may be made that one task's memory is visible to another task.

## Architectural context

The agreed C4 Level 3 architecture includes:

- Reference Data Controller
- Validation Module
- Query Module
- Command Module
- Data Normalisation Module
- Persistence Module
- Cache Refresh Module
- In-Memory Data Store
  Preserve these ownership rules:

1. The **Persistence Module is the only application component permitted to access S3 or Floci** .
2. The Cache Refresh Module must use the Persistence Module's public repository contract.
3. The Validation Module owns structural and business validation.
4. The Data Normalisation Module owns canonical normalisation.
5. The Cache Refresh Module coordinates persistence, validation, normalisation, and in-memory replacement.
6. The In-Memory Data Store owns the active process-local representation.
7. The Validation Module is the only component permitted to call the Authentication Service.
8. Startup hydration and background refresh must not call the Authentication Service.
9. The Reference Data Controller must not perform cache-refresh operations directly.
10. Query behaviour must not read S3 directly.
11. Redis or another external cache must not be introduced.
12. The active manifest remains the persistent source of truth.
13. Persisted collection objects must not become queryable until validation and normalisation succeed.
14. One dataset refresh failure must not corrupt unrelated datasets.
15. The currently active in-memory collection must remain available when a refresh fails.

## Existing decisions to preserve

Preserve these previously approved decisions:

- Local Floci bucket configuration is infrastructure-only.
- The configured local bucket name is supplied through the existing `REFERENCE_DATA_BUCKET` configuration.
- The current local default is: Plain Text 1 mmo-cr-reference-data-service
- Do not introduce a new bucket-name environment variable.
- Keep existing Floci configuration decisions unchanged.
- Normal `npm test` must remain Docker-free.
- Floci integration tests use the existing separate configuration and command: Plain Text 1 npm run test:floci
- Do not silently move Docker-dependent tests into the normal test suite.
- Do not add Redis.
- Do not add item-level reference-data mutations.
- Do not add full seed and reset behaviour if those remain assigned to a later implementation step.
- Specific S3 error-name mapping must continue to take priority over generic HTTP-status mapping.

## Repository assessment

Before preparing the plan, inspect the repository for:

### Persistence

- Repository interface and implementation
- Manifest read operations
- Collection read operations
- Object metadata operations
- ETag and version metadata
- Current object-key conventions
- S3 error mapping
- `NoSuchBucket` , `NoSuchKey` , `AccessDenied` , and transient-failure behaviour
- Floci-specific integration tests
- Existing retry configuration

### Validation and normalisation

- Structural validation entry point
- Business validation entry point
- Dataset-validator registry
- Canonical normalisation entry point
- Dataset-normaliser registry
- Validation issues and warnings
- Normalisation issues and warnings
- JSON and GeoJSON handling
- Supported dataset registry
- Non-uploadable handling for `map-ports`

### Application lifecycle

- Hapi.js server bootstrap
- Plugin registration
- Service startup
- Service stop hooks
- Graceful shutdown
- Health endpoint
- Readiness endpoint
- Existing dependency container
- Existing lifecycle abstractions
- Signal handling
- Startup failure handling

### Configuration

- Refresh interval
- Refresh enablement
- Startup hydration timeout
- Mandatory and optional dataset configuration
- Retry settings
- Logging configuration
- Environment validation
- Test configuration
- Default values

### In-memory state

- Existing in-memory store interface
- Existing collection replacement behaviour
- Metadata storage
- Snapshot behaviour
- Concurrency protection
- Read-only access
- Test reset mechanisms

### Testing

- Test framework and conventions
- Fake timers
- Dependency stubs
- Fixture builders
- Startup integration tests
- Readiness tests
- Persistence tests
- Floci test configuration
- Coverage thresholds
  Document existing conventions in the plan and retain compatible implementations.

## Required lifecycle

Implement the following high-level lifecycle:

Plain Text

```text
construct dependencies
  -> initialise application
  -> read active manifest through Persistence Module
  -> hydrate mandatory collections
  -> hydrate optional collections where configured
  -> publish valid collections atomically to memory
  -> mark service ready
  -> start periodic refresh scheduling
  -> serve requests
  -> stop refresh scheduling during shutdown
```

The background refresh lifecycle is:

Plain Text

```text
refresh triggered
  -> reject or skip overlapping execution
  -> read latest active manifest
  -> compare manifest entries with active in-memory metadata
  -> identify added, changed, and removed datasets
  -> retrieve changed collections through Persistence Module
  -> parse collection
  -> structurally validate collection
  -> canonically normalise collection
  -> business validate normalised collection
  -> atomically replace that dataset in memory
  -> update process-local manifest metadata
  -> retain previous collection if any stage fails
  -> emit refresh summary
```

Do not make an unvalidated persisted object visible to queries.

## In-Memory Data Store

Implement or align an in-process collection store that holds canonical parsed objects.

The store must support operations equivalent to:

Plain Text

```text
get collection by dataset
get collection metadata by dataset
determine whether a dataset is loaded
list loaded datasets
obtain a consistent state snapshot
replace one dataset atomically
replace a startup snapshot atomically
remove a dataset according to an approved policy
reset state for tests
```

Adapt names to repository conventions.

### Stored information

Each active dataset entry should hold concepts equivalent to:

- Dataset identifier
- Canonical parsed collection
- Collection ID
- Schema version
- Collection version
- ETag or checksum
- Persisted object key
- Persisted object version, when available
- Last-modified time, when available
- Hydrated time
- Last successful refresh time
- Item or feature count
  Do not expose mutable internal references when doing so would allow consumers to corrupt cached state.

### Atomicity

Requirements:

- Readers must never observe a partially loaded collection.
- Readers must never observe a partially updated dataset entry.
- A failed refresh must leave the previous entry unchanged.
- Dataset replacement must be atomic from the perspective of asynchronous JavaScript consumers.
- Startup publication must not expose a partially hydrated mandatory dataset set.
- Do not mutate an active collection object in place.
- Do not clear the existing entry before the replacement is ready.
- Do not introduce process-level locks that can deadlock the event loop.
  JavaScript execution is single-threaded within one event loop, but asynchronous interleaving still requires deliberate state-publication boundaries.

### Read-only behaviour

The Query Module will later use the in-memory store.

The store must:

- Provide explicit read methods.
- Avoid exposing internal mutable maps directly.
- Avoid returning a reference that callers can use to replace store metadata.
- Follow the repository's immutability conventions.
- Not perform search, filtering, or mobile projection.
- Not access persistence.
- Not perform validation or normalisation.

## Active manifest

Use the active manifest as the authoritative declaration of active persisted collections.

The manifest is expected to identify concepts such as:

- Dataset
- Collection ID
- Schema version
- Collection version
- Object key or location
- ETag or checksum
- Object version, when present
- Last-modified metadata
- Format
- Item or feature count
  Adapt to the repository's implemented manifest contract.

### Manifest validation

Before using a manifest:

- Verify the manifest can be parsed.
- Apply its structural validation.
- Apply relevant common business validation.
- Verify every configured mandatory dataset has an active entry.
- Reject duplicate dataset entries.
- Reject unsupported maintained datasets.
- Treat a derived `map-ports` entry according to the approved derived-dataset policy.
- Do not infer missing object keys.
- Do not rewrite incompatible schema versions.
- Do not modify the persisted manifest during hydration or refresh.
  A malformed manifest must not replace valid process-local metadata.

## Mandatory and optional datasets

Define the mandatory versus optional dataset policy through central configuration or the existing dataset registry.

Do not scatter mandatory-dataset checks across lifecycle code.

Unless an approved repository decision defines a different policy, treat the maintained datasets as mandatory:

Plain Text

```text
vessels
gears
ports
species
map-land
map-statistical-areas
```

Do not treat `map-ports` as mandatory because it is derived.

If the repository already classifies some map data as optional, preserve that decision and document the resulting readiness behaviour.

### Mandatory dataset behaviour

During initial startup:

- A missing mandatory manifest entry prevents readiness.
- A missing mandatory persisted object prevents readiness.
- An invalid mandatory collection prevents readiness.
- An unsupported schema version prevents readiness.
- Startup must either fail or remain not ready according to existing lifecycle conventions.
- Do not serve a success readiness response while required data is unavailable.
  During a later refresh:

- A failed mandatory dataset refresh must retain the previous valid collection.
- A failed refresh should not make the service unready if the previous valid mandatory collection remains usable.
- If no valid mandatory collection remains, readiness must report failure.

### Optional dataset behaviour

During initial startup:

- Optional dataset failures may be logged and reported without blocking readiness.
- Optional dataset failures must not conceal mandatory failures.
- Missing optional collections must have a defined store representation.
  During refresh:

- Failure must retain the previous valid optional collection.
- Failure of an optional dataset must not make the service unready.

## Startup hydration

Implement startup hydration through an explicit public Cache Refresh Module operation, such as:

Plain Text

```text
hydrate()
```

or an existing repository equivalent.

Hydration must:

1. Read the active manifest through the Persistence Module.
2. Validate the manifest.
3. Determine mandatory and optional active datasets.
4. Retrieve required collection objects.
5. Parse JSON or GeoJSON.
6. Perform structural validation.
7. Perform canonical normalisation.
8. Perform business validation against the normalised value.
9. Collect validation and normalisation summaries.
10. Stage valid dataset entries.
11. Publish mandatory startup state atomically.
12. Publish optional state according to the approved policy.
13. Record hydration metadata.
14. Update readiness state.
15. Return a structured hydration result.
    Do not bypass validation because a collection came from S3.

Persisted content must always be treated as untrusted input.

### Startup concurrency

If multiple startup components request hydration:

- Ensure one hydration execution owns the operation.
- Allow callers to await the same in-flight result where appropriate.
- Do not execute duplicate simultaneous hydration cycles.
- Do not publish multiple competing startup snapshots.

### Startup timeout

Use existing application timeout conventions or introduce a configurable startup hydration timeout.

Requirements:

- A timeout must produce a safe, identifiable failure.
- A timeout must not publish partially staged mandatory data.
- A timed-out operation must not later publish stale data unexpectedly.
- Tests must not rely on real long waits.
- Avoid globally unbounded startup.

## Refresh change detection

Refresh only collections that changed.

Compare the latest manifest entry with active in-memory metadata using the strongest available stable value.

Preferred order:

1. Persisted object version ID, when available and reliable
2. Collection checksum
3. ETag
4. Collection version
5. Last-modified time as a fallback
   Adapt this order to the implemented manifest contract.

Requirements:

- Document the selected comparison precedence.
- Do not rely only on file size.
- Do not rely only on item count.
- Avoid redownloading unchanged collections.
- Treat a changed object key as a change.
- Treat a changed schema version as a change.
- Treat a new dataset as a change.
- Handle a dataset removed from the manifest according to an explicit policy.
- Do not use S3 listing as the primary active-version mechanism when the manifest already identifies active objects.

## Refresh scheduling

Implement a configurable background refresh scheduler.

Configuration should support concepts equivalent to:

Plain Text

```text
REFERENCE_DATA_REFRESH_ENABLED
REFERENCE_DATA_REFRESH_INTERVAL_MS
REFERENCE_DATA_REFRESH_INITIAL_DELAY_MS
```

Reuse existing configuration names where available.

Requirements:

- Validate interval values during startup.
- Provide a safe production default.
- Permit refresh scheduling to be disabled in tests.
- Do not use a hard-coded interval.
- Do not use recursive scheduling that can create uncontrolled overlap.
- Prefer scheduling the next run after the current run completes or use an explicit overlap guard.
- Keep timer implementation behind a lifecycle or scheduler abstraction where useful.
- Unref the timer where consistent with repository conventions.
- Stop scheduling during service shutdown.
- Do not start periodic refresh before startup hydration completes successfully.
- A failed scheduled refresh must not terminate the process.
- Unexpected errors must be logged and converted to a structured refresh failure.

## Overlap prevention

Only one refresh cycle may execute at a time per process.

When a refresh is requested while another refresh is active, use one explicitly documented policy:

- Return the existing in-flight promise, or
- Skip the new refresh and return a structured `already-running` result.
  Prefer returning the existing in-flight result when that fits repository conventions.

Requirements:

- Scheduled and manually invoked refreshes use the same overlap protection.
- Startup hydration and refresh cannot race.
- A failed refresh releases the guard.
- A thrown unexpected error releases the guard.
- Tests verify the overlap behaviour.
- Do not use a boolean guard without safe cleanup in `finally` .

## Manual refresh operation

Expose an application-internal refresh operation suitable for:

- Unit tests
- Integration tests
- Future administrative orchestration
- Controlled operational invocation
  The operation must not be exposed as a public HTTP endpoint in this step.

The manual operation must:

- Use the same logic as scheduled refresh.
- Return a structured result.
- Respect overlap prevention.
- Not require waiting for a timer.
- Not bypass validation or normalisation.
- Support dependency injection for deterministic tests.

## Refresh result model

Implement or align a framework-neutral result equivalent to:

TypeScript

```text
type CacheRefreshResult = {
  status: "completed" | "completed-with-errors" | "skipped";
  startedAt: string;
  completedAt: string;
  manifestChanged: boolean;
  refreshedDatasets: string[];
  unchangedDatasets: string[];
  failedDatasets: CacheRefreshFailure[];
  removedDatasets: string[];
};
```

A dataset failure should include concepts equivalent to:

TypeScript

```text
type CacheRefreshFailure = {
  dataset: string;
  stage:
    | "manifest"
    | "persistence"
    | "parsing"
    | "structural-validation"
    | "normalisation"
    | "business-validation"
    | "publication";
  code: string;
  message: string;
  retryable: boolean;
};
```

Adapt names to existing repository types.

Requirements:

- Results must not contain complete collections.
- Results must not contain credentials.
- Validation issue details may be summarised safely.
- Failures must identify the affected dataset and stage.
- One failed dataset must not remove successful refresh results for another dataset.
- Result ordering must be deterministic.
- Time values must use the repository's UTC convention.
- Inject or abstract the clock where needed for deterministic tests.

## Collection processing pipeline

For each collection loaded during hydration or refresh, use the approved pipeline:

Plain Text

```text
retrieve persisted content
  -> parse
  -> structural validation
  -> canonical normalisation
  -> business validation
  -> stage canonical collection
  -> publish atomically
```

Requirements:

- Structural validation must run before normalisation.
- Business validation must run against the normalised collection.
- Persisted content must not be mutated.
- Validation and normalisation issues must remain distinguishable.
- An invalid collection must not replace valid in-memory data.
- A collection with normalisation warnings may be accepted when no errors exist.
- Normalisation warnings must be summarised in logs and refresh results according to existing contracts.
- Do not persist the normalised output during a refresh.
- Do not rewrite the S3 object during hydration.
- Do not update the active manifest from the Cache Refresh Module.

## Handling removed manifest entries

Define a clear policy for a dataset present in memory but absent from the latest valid manifest.

Preferred policy:

- Mandatory dataset removed from the manifest:
  - Treat the refresh as failed for that dataset.
  - Keep the previous valid in-memory collection.
  - Log and report the manifest inconsistency.
  - Do not silently remove mandatory data.
- Optional dataset removed from the manifest:
  - Remove it from memory only if the approved design explicitly treats manifest removal as deactivation.
  - Otherwise retain it and report the inconsistency.
    Do not infer deletion merely because an S3 listing does not contain an object.

Do not create tombstones unless the manifest design already supports them.

## Failure isolation

The refresh implementation must isolate failures by dataset wherever possible.

Examples:

- If vessels refresh successfully and species fail validation, publish vessels and retain the previous species collection.
- If the latest manifest cannot be read or validated, publish no refresh changes.
- If one object cannot be retrieved, continue processing other changed datasets where safe.
- If normalisation fails, retain the previous dataset entry.
- If publication fails unexpectedly, retain the previous entry and report the failure.
  The startup hydration policy may be stricter because mandatory collections must be available before readiness succeeds.

## Readiness integration

Align startup hydration with the existing readiness endpoint and readiness-state implementation.

Readiness must consider:

- Whether startup hydration completed
- Whether every mandatory dataset has a valid active in-memory entry
- Whether the service is shutting down
- Any existing required dependencies
- Whether a fatal startup hydration failure occurred
  A readiness response should expose only safe summary information.

Do not expose:

- S3 credentials
- Internal stack traces
- Complete manifest contents
- Complete object keys where those are considered internal
- Complete collection content
  The readiness implementation may safely expose:

- Overall ready or not-ready state
- A machine-readable readiness reason
- Missing mandatory datasets
- Failed mandatory datasets
- Last successful hydration time
- Last refresh time, if already part of the approved contract
  Do not change the public readiness response contract incompatibly without documenting the change in the plan.

## Health integration

The health endpoint should continue to represent process liveness rather than reference-data readiness.

Requirements:

- A refresh failure must not make the liveness endpoint fail while the process is functioning.
- Startup hydration failure must be represented through readiness.
- Shutdown behaviour must follow existing health conventions.
- Do not collapse liveness and readiness into one endpoint.

## Shutdown behaviour

Register clean shutdown behaviour through existing application lifecycle hooks.

Shutdown must:

1. Mark readiness as not ready where appropriate.
2. Stop future refresh scheduling.
3. Prevent new refresh cycles from starting.
4. Await or safely terminate the active refresh according to the approved timeout policy.
5. Release timer and scheduler resources.
6. Avoid publishing stale results after shutdown begins.
7. Complete without requiring S3 access.
   Add tests for shutdown during:

- Idle state
- Scheduled waiting
- Active refresh
- Failed refresh
- Startup hydration where practical

## Persistence error handling

Reuse the existing persistence error model.

Preserve specific error mapping behaviour, including:

- `NoSuchBucket` is handled before a generic HTTP `404` .
- A missing bucket is distinct from a missing object.
- Access-denied errors remain distinct.
- Precondition failures remain distinct.
- Non- `412` write failures continue to map correctly.
- Transient storage errors carry a retryable indication where established.
  The Cache Refresh Module must interpret persistence failures without reimplementing low-level S3 error mapping.

Do not inspect raw AWS SDK exceptions outside the Persistence Module.

## Retry policy

Do not add uncontrolled retries.

If the repository already defines an AWS SDK retry strategy, reuse it.

For Cache Refresh Module orchestration:

- Prefer allowing the next scheduled refresh to retry failed datasets.
- Do not create an immediate infinite retry loop.
- If startup hydration retries are approved, make count and delay configurable.
- Bound the number of retries.
- Make retry delays deterministic in tests.
- Avoid retrying structural, validation, or normalisation failures.
- Retry only failures classified as transient.
- Do not retry `NoSuchBucket` , unsupported schema, invalid JSON, or business-validation failures automatically unless an approved policy says otherwise.
  If startup retry behaviour is not already decided, identify it in the plan and implement the smallest safe bounded policy.

## Concurrency and consistency requirements

- Maintain one active refresh execution per process.
- Do not modify active entries in place.
- Stage replacement data before publication.
- Keep comparisons based on one valid manifest snapshot.
- Do not combine entries from two manifest versions in one publication decision.
- Prevent a slower older refresh from overwriting a newer result.
- Use a refresh generation, manifest version, or equivalent publication check if overlapping lifecycle operations could otherwise publish stale data.
- Avoid holding large duplicate collections longer than necessary.
- Ensure failed staged data can be released for garbage collection.
- Do not expose partially constructed GeoJSON structures.

## Security and privacy requirements

Treat persisted reference data and manifest content as untrusted.

Requirements:

- Validate every loaded collection.
- Do not execute persisted content.
- Do not dynamically import modules based on manifest values.
- Validate object keys before passing them to the Persistence Module.
- Reject unsafe object-key patterns according to existing repository policy.
- Do not permit path traversal semantics.
- Do not log complete collection files.
- Do not log credentials or bearer tokens.
- Avoid logging complete vessel identifiers.
- Redact unsafe validation and normalisation values.
- Bound collection sizes using existing configured limits.
- Bound validation issue and warning collection.
- Bound startup hydration time.
- Bound refresh duration where existing lifecycle mechanisms permit it.
- Do not expose internal S3 details through readiness responses.
- Do not use production data in tests.
- Review any new dependency for security, maintenance, and licence impact.

## Performance requirements

Design startup hydration and refresh for complete reference-data collections.

Requirements:

- Download each changed collection no more than once per refresh.
- Do not download unchanged collections.
- Avoid repeated parsing.
- Avoid repeated validation passes without justification.
- Reuse indexes created during business validation where practical.
- Avoid JSON stringification solely to compare complete collections.
- Avoid unnecessary deep copying.
- Avoid holding multiple full copies beyond the staging and active copies required for safe publication.
- Process datasets with controlled concurrency.
- Do not launch unbounded parallel S3 reads.
- Make any concurrency limit configurable or clearly documented.
- Record duration by dataset and refresh cycle.
- Preserve deterministic result ordering regardless of processing concurrency.
  Do not introduce worker threads unless current repository evidence demonstrates a requirement.

## Logging requirements

Follow existing structured logging conventions.

### Startup hydration logs

Include safe summaries such as:

- Hydration started
- Manifest version or identifier where safe
- Mandatory dataset count
- Optional dataset count
- Dataset identifier
- Collection version
- Item or feature count
- Validation result summary
- Normalisation warning count
- Dataset hydration duration
- Total hydration duration
- Readiness transition
- Hydration failure stage and safe code

### Refresh logs

Include safe summaries such as:

- Refresh started
- Refresh trigger type
- Changed datasets
- Unchanged datasets
- Failed datasets
- Removed datasets
- Per-dataset duration
- Total duration
- Previous and new collection version where safe
- Whether a previous collection was retained
- Overlapping refresh decision
- Next scheduled refresh when useful
  Do not log:

- Complete collection contents
- Complete map geometry
- Authentication tokens
- AWS credentials
- Full raw exceptions in ordinary validation failures
- Complete sensitive identifiers
- Entire manifests unless explicitly safe and approved
  Use correlation or operation IDs according to repository conventions.

Scheduled refreshes should have an internally generated operation identifier if no request correlation ID exists.

## Metrics requirements

Use the repository's existing metrics abstraction if present.

Otherwise, prepare clear metric events without introducing a production monitoring vendor unnecessarily.

Metrics should cover concepts such as:

Plain Text

```text
reference_data_hydration_duration
reference_data_hydration_failures
reference_data_refresh_duration
reference_data_refresh_successes
reference_data_refresh_failures
reference_data_refresh_skipped
reference_data_collection_refresh_duration
reference_data_collection_refresh_failures
reference_data_collection_age
reference_data_loaded_collections
reference_data_last_successful_refresh
```

Requirements:

- Dataset labels are acceptable.
- Do not use collection GUIDs or object keys as metric labels.
- Avoid unbounded label values.
- Distinguish failure stages.
- Distinguish startup hydration from scheduled refresh.
  If metrics implementation belongs to a later observability step, add only existing-compatible hooks and document deferred metric export.

## Unit test requirements

Add comprehensive Docker-free unit tests.

### In-Memory Data Store

Test:

- Empty initial state
- Load one dataset
- Load multiple datasets
- Retrieve collection
- Retrieve metadata
- Determine loaded state
- List loaded datasets
- Atomic single-dataset replacement
- Atomic startup snapshot publication
- Previous entry retained on staged failure
- Input collection not mutated
- Internal state not replaceable through returned metadata
- Missing dataset behaviour
- Reset behaviour for tests
- Deterministic dataset ordering where exposed

### Manifest comparison

Test:

- Identical manifest entry
- Changed object version
- Changed checksum
- Changed ETag
- Changed collection version
- Changed object key
- Changed schema version
- New dataset
- Removed dataset
- Missing comparison metadata
- Precedence of comparison fields
- Derived `map-ports` handling
- Mandatory manifest entry missing
- Duplicate manifest entries
- Unsupported dataset entry

### Startup hydration

Test:

- Successful hydration of all mandatory datasets
- Successful hydration with an absent optional dataset
- Manifest read failure
- Invalid manifest
- Missing mandatory manifest entry
- Missing mandatory object
- Invalid JSON collection
- Structural validation failure
- Normalisation failure
- Business validation failure
- Normalisation warnings with successful hydration
- Unsupported schema version
- Atomic publication of mandatory data
- No partially hydrated mandatory state
- Readiness transition after success
- Readiness remains false after failure
- Concurrent hydration calls
- Hydration timeout
- Input persisted collection not mutated

### Refresh

Test:

- No changed datasets
- One changed dataset
- Multiple changed datasets
- New dataset
- One successful and one failed dataset
- Manifest read failure
- Invalid manifest
- Object read failure
- Parsing failure
- Structural validation failure
- Normalisation failure
- Business validation failure
- Publication failure where injectable
- Previous valid entry retained
- Unchanged dataset not downloaded
- Changed dataset downloaded once
- Deterministic result ordering
- Safe failure summaries
- Completion with errors
- Complete success
- Skipped or shared overlapping refresh
- Refresh guard released after failure
- Refresh guard released after unexpected exception
- Older operation cannot overwrite newer valid state

### Scheduling

Test:

- Scheduler disabled
- Scheduler starts only after hydration
- Configured initial delay
- Configured refresh interval
- Manual invocation without timer wait
- Timers do not overlap refresh
- Failed refresh does not stop future scheduling
- Timer stopped during shutdown
- Fake timer tests are deterministic
- No open handles remain after tests

### Readiness and health

Test:

- Health remains live before hydration completes
- Readiness is false before hydration
- Readiness is true after mandatory hydration
- Optional failure does not block readiness
- Mandatory failure blocks readiness
- Failed later refresh retains readiness when previous data remains valid
- Readiness fails if no valid mandatory data remains
- Shutdown makes readiness false
- Public response remains safe

### Architecture boundaries

Test or statically verify:

- Cache Refresh Module uses the repository interface rather than AWS SDK classes.
- In-Memory Data Store performs no persistence calls.
- Validation and normalisation perform no S3 calls.
- Startup hydration performs no Authentication Service calls.
- No Redis dependency is introduced.
- No public refresh HTTP route is introduced.

## Integration test requirements

Add integration tests at the application-module boundary without requiring Docker unless persistence realism is essential.

Use in-memory or stubbed Persistence Module implementations for normal lifecycle integration tests.

Verify:

1. Startup invokes manifest retrieval.
2. Active persisted collections pass through parsing, structural validation, normalisation, and business validation.
3. Valid collections are published atomically.
4. Invalid collections are not published.
5. Readiness changes only after mandatory hydration.
6. Periodic refresh detects a changed manifest entry.
7. Only changed datasets are retrieved.
8. A failed changed dataset retains the previous entry.
9. A successful changed dataset replaces the previous entry.
10. One dataset failure does not block unrelated successful refreshes.
11. Shutdown stops future refreshes.
12. Reinitialisation rebuilds the store from the active manifest.
13. Validation and normalisation warnings remain distinguishable.
14. `map-ports` is not independently hydrated.
15. No direct S3 client is used outside persistence.
    Normal `npm test` must remain Docker-free.

## Floci integration tests

Add or extend Floci integration tests only where required to prove persistence interactions used by hydration and refresh.

Use the separate Floci configuration and command:

Plain Text

```text
npm run test:floci
```

Potential Floci tests include:

- Read active manifest
- Retrieve a referenced collection
- Read collection metadata
- Change one persisted manifest entry
- Confirm the module detects changed metadata
- Confirm the changed collection can be hydrated
- Confirm an unchanged collection is not unnecessarily retrieved where observable
- Confirm missing bucket and missing object remain distinguishable
  Do not duplicate the entire unit suite in Floci tests.

Do not make `npm test` require Docker.

Do not implement full seed/reset ownership if that remains assigned to a later step. Create isolated test resources through existing fixture mechanisms and clean them up appropriately.

## Test-data requirements

Use small deterministic fixtures.

Requirements:

- Use fixed valid GUIDs.
- Keep GUIDs separate from business identifiers.
- Use fictional or approved reusable values.
- Use valid canonical JSON and GeoJSON.
- Include targeted invalid fixtures.
- Do not use production data.
- Do not include personal information.
- Do not include large map datasets.
- Prevent tests from sharing mutable in-memory objects.
- Keep dataset versions explicit.
- Keep comparison metadata explicit.
- Ensure manifest references resolve in valid fixtures.

## Configuration requirements

Add or align typed configuration equivalent to:

Plain Text

```text
REFERENCE_DATA_REFRESH_ENABLED
REFERENCE_DATA_REFRESH_INTERVAL_MS
REFERENCE_DATA_REFRESH_INITIAL_DELAY_MS
REFERENCE_DATA_HYDRATION_TIMEOUT_MS
REFERENCE_DATA_REFRESH_CONCURRENCY
REFERENCE_DATA_MANDATORY_DATASETS
```

Do not introduce duplicate settings if the repository already has equivalents.

Requirements:

- Validate boolean and numeric values.
- Reject negative intervals and timeouts.
- Reject an empty mandatory dataset list unless explicitly supported.
- Reject unsupported mandatory datasets.
- Reject derived `map-ports` as a mandatory persisted dataset.
- Use deterministic test defaults.
- Do not use test defaults in production.
- Document defaults and units.
- Avoid parsing configuration inside business logic.

## Documentation requirements

Update the appropriate repository documentation with:

- Purpose of the in-memory data store
- Process-local memory limitation
- Startup hydration lifecycle
- Active manifest as persistent source of truth
- Mandatory and optional dataset behaviour
- Validation and normalisation pipeline
- Change-detection precedence
- Refresh schedule
- Overlap prevention
- Atomic replacement
- Failure isolation
- Removed-entry policy
- Readiness behaviour
- Health behaviour
- Shutdown behaviour
- Retry policy
- Configuration reference
- Logging and metric summaries
- Security considerations
- Performance considerations
- Docker-free tests
- Floci integration tests
- Troubleshooting startup hydration failures
- Troubleshooting stale collections
- Troubleshooting manifest inconsistencies
- Work deferred to later steps
  Include a Mermaid lifecycle diagram where useful.

## Explicit exclusions

Do not implement:

- Public collection-query endpoints
- Public manifest endpoint
- Search and pagination
- Mobile response projections
- Public manual-refresh endpoint
- Multipart upload routes
- Full collection upload API
- Atomic manifest activation by the Command Module
- Rollback orchestration for uploads
- Authentication Service integration
- Item-level mutations
- Redis
- Distributed cache coordination
- Cross-task memory sharing
- S3 event notifications
- SQS refresh notifications
- EventBridge scheduling
- Production IAM resources
- Fargate deployment
- API Gateway deployment
- Full observability platform integration if assigned to a later step
- Full seed and reset workflows if assigned to a later step
- Persisting normalised data during hydration
- Rewriting invalid persisted collection files
- Deriving and storing `map-ports`

## Required plan content

The implementation plan must include:

1. Current repository lifecycle structure.
2. Current Persistence Module contract.
3. Current manifest contract.
4. Current validation and normalisation entry points.
5. Current readiness and health behaviour.
6. Current configuration conventions.
7. Existing in-memory state implementation, if any.
8. Existing scheduler or timer abstraction, if any.
9. Existing conventions to retain.
10. Gaps against this step.
11. Proposed Cache Refresh Module responsibilities.
12. Proposed In-Memory Data Store responsibilities.
13. Proposed module and file structure.
14. Proposed startup hydration lifecycle.
15. Proposed refresh lifecycle.
16. Proposed mandatory and optional dataset policy.
17. Proposed manifest validation.
18. Proposed change-detection precedence.
19. Proposed overlap-prevention mechanism.
20. Proposed atomic-publication mechanism.
21. Proposed removed-dataset policy.
22. Proposed failure-isolation behaviour.
23. Proposed retry policy.
24. Proposed readiness integration.
25. Proposed health integration.
26. Proposed shutdown behaviour.
27. Proposed configuration changes.
28. Proposed result and failure types.
29. Proposed logging and metrics.
30. Exact files to create.
31. Exact files to modify.
32. Files intentionally left unchanged.
33. Unit-test approach.
34. Application integration-test approach.
35. Floci integration-test approach.
36. Documentation updates.
37. Security and privacy considerations.
38. Performance considerations.
39. Verification commands.
40. Assumptions and unresolved ambiguities.
41. Work explicitly deferred to later steps.

## Expected deliverables

- Approved plan saved as: Plain Text 1 github-prompts/Step 11-implement-cache-refresh-and-startup-hydration-plan.md
- Cache Refresh Module.
- Process-local In-Memory Data Store or alignment of the existing implementation.
- Startup hydration operation.
- Validated active-manifest processing.
- Mandatory and optional dataset handling.
- Collection processing through validation and normalisation.
- Atomic startup-state publication.
- Changed-collection detection.
- Per-dataset atomic refresh.
- Previous-collection retention after failure.
- Refresh overlap prevention.
- Configurable scheduler.
- Manual internal refresh operation.
- Refresh result and failure contracts.
- Readiness integration.
- Graceful scheduling shutdown.
- Structured lifecycle logging.
- Metrics hooks aligned with repository conventions.
- Docker-free unit tests.
- Docker-free application integration tests.
- Focused Floci integration tests where justified.
- Updated documentation.
- Step completion report.

## Acceptance criteria

- The plan is saved before implementation changes begin.
- The active manifest is used as the persistent source of truth.
- Startup hydration reads persistence only through the Persistence Module.
- Cache refresh reads persistence only through the Persistence Module.
- No raw AWS SDK exception handling is added outside persistence.
- Persisted collections pass through parsing, structural validation, canonical normalisation, and business validation.
- Business validation runs against normalised data.
- Invalid collections never replace valid in-memory collections.
- Startup does not publish partially hydrated mandatory state.
- Every configured mandatory collection is available before readiness succeeds.
- Optional collection failures follow the documented policy.
- Startup hydration failures are reported through readiness rather than liveness.
- Health continues to represent process liveness.
- Unchanged collections are not downloaded.
- Changed collections are downloaded and processed only once per refresh.
- New collections are handled according to the dataset policy.
- Removed manifest entries follow the documented policy.
- Each dataset replacement is atomic.
- Readers do not observe partially updated data.
- A failed refresh retains the previous valid dataset.
- One failed dataset does not corrupt unrelated datasets.
- A manifest-level failure publishes no changes.
- Only one refresh runs per process at a time.
- Overlap protection is safely released after success or failure.
- Manual and scheduled refreshes use the same implementation.
- The scheduler starts only after successful startup hydration.
- The refresh interval is configurable.
- Tests can invoke refresh without waiting for a real timer.
- Scheduling stops during shutdown.
- A stale operation cannot overwrite newer valid state.
- Valid GUIDs remain unchanged.
- Business identifiers remain separate from GUIDs.
- JSON and GeoJSON collections are supported.
- `map-ports` is not independently hydrated.
- No Redis dependency is introduced.
- No public refresh endpoint is introduced.
- No upload endpoint is implemented.
- Normal tests remain Docker-free.
- Floci tests remain under the separate Floci command.
- Existing persistence tests continue to pass.
- Existing S3 error precedence remains correct.
- Type checking passes.
- Linting passes, or pre-existing failures are documented separately.
- The build passes.
- Documentation matches the implemented lifecycle.
- Work outside this step remains deferred.

## Verification

Use the repository's actual package manager, module system, test configuration, and scripts.

Run the applicable equivalents of:

Plain Text

```text
install dependencies
run type checking
run linting
run in-memory store unit tests
run startup hydration unit tests
run cache refresh unit tests
run scheduler unit tests
run readiness and health tests
run application lifecycle integration tests
run the complete Docker-free test suite
run persistence regression tests
run the build
run focused Floci integration tests with npm run test:floci
```

Explicitly verify:

Plain Text

```text
successful mandatory startup hydration
mandatory manifest entry missing
mandatory persisted object missing
optional dataset missing
invalid active manifest
invalid persisted JSON
structural validation failure
canonical normalisation failure
business validation failure
normalisation warning with successful hydration
readiness before hydration
readiness after hydration
health during hydration
one changed collection
multiple changed collections
no changed collections
new dataset
removed mandatory dataset
one successful and one failed dataset
previous valid collection retained
atomic dataset replacement
atomic startup snapshot publication
unchanged collection not downloaded
overlapping refresh requests
refresh guard cleanup after failure
manual refresh without timer wait
scheduled refresh after initial hydration
failed scheduled refresh followed by later retry
shutdown while idle
shutdown while scheduler is waiting
shutdown during an active refresh
stale refresh cannot overwrite newer state
no direct S3 access outside Persistence Module
no Authentication Service calls
no Redis dependency
map-ports is not independently hydrated
```

Record:

- Exact commands
- Exit codes
- Test counts
- Coverage results
- Build result
- Type-check result
- Lint result
- Floci result, if run
- Pre-existing failures
- New warnings
- Open handles or lifecycle leaks
  If verification reveals a pre-existing issue outside this step:

1. Record the exact failing command.
2. Identify the likely pre-existing cause.
3. Explain whether the issue blocks Step 11.
4. Do not expand scope silently.
5. Do not weaken a test to produce a passing result.
6. Ask for clarification if resolving the issue requires an architectural, schema, readiness, or lifecycle decision.

## Completion response

Provide a concise implementation report containing:

- Repository state discovered
- Saved plan filename
- Startup hydration approach
- Refresh scheduling approach
- Change-detection precedence
- Mandatory and optional dataset policy
- Atomic-publication approach
- Failure-isolation behaviour
- Removed-dataset policy
- Retry policy
- Readiness and health integration
- Shutdown behaviour
- Files created
- Files modified
- Files deliberately left unchanged
- Configuration added or changed
- Tests added
- Exact verification commands and results
- Coverage results
- Floci verification results, if run
- Security and privacy controls
- Performance safeguards
- Approved deviations
- Existing issues not introduced by this step
- Work deferred to later steps
- Remaining risks, assumptions, or owner decisions
  if you reach any ambiguity ask me to clarify
