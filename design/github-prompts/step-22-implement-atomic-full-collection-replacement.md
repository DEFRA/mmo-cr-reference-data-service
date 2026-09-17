# Step 22: Implement Atomic Full Collection Replacement

## Recommended reasoning effort

- **Planning phase:** High
- **Implementation phase:** High
- **Verification phase:** High

## Copilot operating mode

Start in **Plan mode** .

Before changing any source file:

1. Inspect the complete repository.
2. Read the approved Reference Data Service design and API design.
3. Read the master implementation plan.
4. Read the approved plans and completion summaries from all completed steps.
5. Read the Step 21 implementation, tests, plan, and completion summary.
6. Inspect the Command Module, Persistence Module, Validation Module, Data Normalisation Module, In-Memory Data Store, Cache Refresh Module, active manifest model, authentication boundary, common API behaviour, tests, and documentation.
7. Inspect the implemented S3 object-key conventions, optimistic concurrency controls, error mapping, ETag handling, and manifest write behaviour.
8. Produce a repository-specific implementation plan based on the code that actually exists.
   Do not assume the repository is empty.

Reuse the Step 21 upload parsing, authentication, validation, normalisation, warning, and error-handling pipeline.

After producing the plan, save it as:

Plain Text

```text
github-prompts/Step 22-implement-atomic-full-collection-replacement-plan.md
```

The saved GitHub-generated plan must be treated as **already approved** .

After saving the plan, continue directly with implementation without requesting plan approval unless:

- The implementation conflicts with the approved Reference Data Service design.
- A required upstream contract is missing.
- The active-manifest or object-key contract is materially ambiguous.
- The repository cannot provide the required optimistic concurrency behaviour.
- A destructive or incompatible change is required.
- A security, retention, or recovery decision requires owner input.
- The implementation would require work explicitly assigned to a later rollback or recovery step.
  The plan must be saved before implementation begins.

## Objective

Implement atomic replacement of a complete active reference-data collection.

Extend the collection upload route to support:

HTTP

```text
PUT /api/v1/reference-data/{dataset}
```

A successful request must:

1. Authenticate and authorise the caller.
2. Parse the complete uploaded collection.
3. Structurally validate the collection.
4. Canonically normalise the collection.
5. Business-validate the normalised collection.
6. calculate stable collection metadata.
7. Persist a new immutable collection object through the Persistence Module.
8. Atomically update the active manifest using optimistic concurrency.
9. Refresh or directly replace the corresponding process-local in-memory collection.
10. Return the new active collection metadata and previous active collection metadata.
    The active collection must not change unless the complete workflow reaches the activation point successfully.

This step must not introduce item-level mutation endpoints.

## Supported datasets

Support complete replacement for maintained uploadable datasets:

Plain Text

```text
vessels
gears
ports
species
map-land
map-statistical-areas
```

Reject the derived dataset:

Plain Text

```text
map-ports
```

`map-ports` remains derived from the active ports collection and must not be independently uploaded, persisted, activated, or versioned.

Use the central dataset registry.

## Architectural boundaries

Preserve these responsibilities:

1. The **Reference Data Controller** owns HTTP request and response mapping.
2. The **Command Module** orchestrates complete collection replacement.
3. The **Validation Module** owns structural and business validation.
4. The **Data Normalisation Module** owns canonical normalisation.
5. The **Persistence Module is the only component permitted to access S3 or Floci** .
6. The **Validation Module is the only component permitted to call the Authentication Service** .
7. The **In-Memory Data Store** owns process-local active collection state.
8. The **Cache Refresh Module** owns hydration and refresh coordination.
9. The controller must not access S3, update the manifest, or replace in-memory state directly.
10. The Command Module must use Persistence Module contracts rather than AWS SDK classes.
11. The Command Module must not contain dataset-specific validation or normalisation rules.
12. Common API behaviour from Step 13 owns correlation, errors, headers, and safe unexpected-error handling.
13. Redis or another external cache must not be introduced.

## Existing decisions to preserve

Preserve all approved decisions:

- GUIDs are stable technical identifiers.
- Valid supplied GUIDs must be preserved.
- Invalid or missing GUIDs must not be automatically replaced.
- Business identifiers remain separate from GUIDs.
- Leading zeros in business identifiers must be preserved.
- Canonical schemas remain aligned with legacy schemas wherever practical.
- Collection updates replace complete collection files.
- Item-level mutations are not supported.
- The active manifest is the persistent source of truth.
- Persisted collection revisions are immutable.
- The Persistence Module is the only S3 integration point.
- Invalid uploads must not affect the active collection.
- A failed activation must not expose a partial collection.
- Process-local memory must reflect only a valid active collection.
- Normal tests remain Docker-free.
- Floci integration tests use the existing separate command.
- Specific persistence errors must be checked before generic HTTP status values.
- `NoSuchBucket` must remain distinct from a missing object.
- Step 21 validation-only mode must remain non-persistent.
- Successful administrative responses must not be publicly cached.

## Endpoint behaviour

### Atomic replacement

Implement:

HTTP

```text
PUT /api/v1/reference-data/{dataset}
```

The request uses the upload format implemented in Step 21.

### Validation-only mode

Preserve:

HTTP

```text
PUT /api/v1/reference-data/{dataset}?validateOnly=true
```

Requirements:

- `validateOnly=true` executes Step 21 behaviour only.
- It must not persist, activate, or update memory.
- An absent `validateOnly` value executes full replacement.
- `validateOnly=false` should execute full replacement only if that behaviour is consistent with the approved request-validation policy.
- Invalid boolean representations return `400` .
- The validation-only and replacement paths must share the same parsing, validation, and normalisation pipeline.
- Do not duplicate validation logic.

## Authentication and authorisation

Require:

Plain Text

```text
reference-data.write
```

Requirements:

- Missing or invalid authentication returns `401` .
- Insufficient permission returns `403` .
- Read permission alone is insufficient.
- The controller and Command Module must not call the Authentication Service directly.
- Use the existing Validation Module or Hapi.js authentication strategy.
- Do not trust uploader identity supplied in the payload.
- Obtain the actor identity from authenticated context.
- Never log access tokens.

## Precondition and concurrency control

Support optimistic concurrency through:

HTTP

```text
If-Match: "<active-collection-etag>"
```

The exact required or optional policy must follow the approved API design and repository conventions.

Preferred policy:

- Require `If-Match` when replacing an existing active collection.
- Allow a documented initial-creation condition where no active collection exists.
- Reject a stale ETag before activation.
- Recheck manifest concurrency during the manifest update.
- Do not rely only on the early collection ETag check because another writer may activate a new manifest between validation and activation.
  Use the active manifest ETag or version as the final activation precondition.

### Concurrency scenario

The implementation must prevent this sequence:

Plain Text

```text
Writer A reads active version 1
Writer B reads active version 1
Writer A writes collection version 2 and activates it
Writer B writes collection version 3 using stale version 1
Writer B overwrites Writer A's activation
```

Writer B must fail with the approved conflict or precondition response.

### Failed precondition

Use the repository's approved public status:

Plain Text

```text
409 Conflict
```

or:

Plain Text

```text
412 Precondition Failed
```

Do not introduce inconsistent mappings.

Use a stable error code equivalent to:

Plain Text

```text
collection_modified
etag_mismatch
precondition_failed
```

The plan must document the selected public status and code.

## Collection version rules

Validate collection version according to the approved contracts.

Requirements:

- The uploaded collection version must be present.
- It must conform to the approved version format.
- It must not silently replace an existing immutable object revision with different content.
- Reusing an existing version with different content must fail.
- Reusing an existing version with identical content must follow one documented idempotency policy.
- Do not generate a business collection version automatically.
- Do not derive the version from the current time.
- Manifest version and collection version remain separate.
- The API response must clearly distinguish them.
  Preferred idempotency behaviour:

- If the same dataset version and checksum already identify the active collection, return a successful idempotent result without rewriting or refreshing.
- If the same version exists with different content, return `409` .
- If the same immutable object already exists but is not active, follow the repository's approved recovery policy rather than overwriting it.

## Collection metadata

Calculate or obtain stable metadata equivalent to:

Plain Text

```text
dataset
collectionId
schemaVersion
version
checksum
etag
sizeBytes
itemCount or featureCount
contentType
uploadedAt
uploadedBy
objectKey
objectVersion
status
```

Requirements:

- Preserve the uploaded collection GUID.
- Use canonical normalised content for checksum calculation.
- Use deterministic serialisation where checksum calculation requires it.
- Keep checksum and HTTP ETag concepts distinct where the repository distinguishes them.
- Do not expose internal object keys in the public response.
- Do not trust client-supplied technical metadata such as checksum, object key, upload time, or uploader.
- Use the authenticated actor for `uploadedBy` .
- Use an injected or existing clock for `uploadedAt` .
- Keep tests deterministic.

## Object-key structure

Use the approved Persistence Module key convention.

Expected conceptual structure:

Plain Text

```text
collections/vessels/{collection-version}.json
collections/gears/{collection-version}.json
collections/ports/{collection-version}.json
collections/species/{collection-version}.json
collections/map/land/{collection-version}.geojson
collections/map/statistical-areas/{collection-version}.geojson
```

Requirements:

- Use the Persistence Module's key builder or repository contract.
- Do not construct arbitrary S3 keys from untrusted filenames.
- Validate version values before using them in a key.
- Prevent path traversal.
- Do not expose object keys publicly.
- Do not overwrite an immutable object silently.
- Use the correct JSON or GeoJSON content type.

## Atomic activation workflow

Implement a Command Module workflow equivalent to:

Plain Text

```text
authorise request
  -> parse upload
  -> structural validation
  -> canonical normalisation
  -> business validation
  -> resolve active manifest and current collection metadata
  -> verify request precondition
  -> calculate canonical checksum and metadata
  -> detect idempotent or conflicting version
  -> write immutable collection object
  -> build next active manifest
  -> conditionally write next manifest
  -> publish new collection to process-local memory
  -> return activation result
```

### Activation point

The active manifest update is the persistent activation point.

Requirements:

- Writing the immutable collection object alone must not activate it.
- A failed collection-object write must not alter the manifest.
- A failed conditional manifest update must not activate the new collection.
- A failed manifest update must leave the previous active collection in memory.
- In-memory publication occurs only after successful manifest activation.
- A process restart must reconstruct active state from the activated manifest.
- Do not modify the existing manifest object in place.
- Build a new manifest revision.
- Preserve unrelated active dataset entries.
- Update only the target dataset entry.
- Use deterministic manifest entry ordering.
- Generate or assign the next manifest identity and version according to the approved manifest contract.

## Manifest update

The next active manifest must:

- Preserve all unrelated active dataset entries.
- Replace only the target dataset's active entry.
- Reference the new immutable collection object.
- Include the new collection metadata.
- Use a new manifest revision identity where required.
- Use a new manifest version.
- Use a deterministic generation timestamp from the injected clock.
- Preserve maintained-versus-derived dataset rules.
- Not add an independently active `map-ports` object.
- Pass manifest structural and business validation before persistence.
- Be conditionally written using the expected active manifest ETag or version.
  Do not activate a manifest that points to a collection object that failed to persist.

## Persistence interactions

Use the Persistence Module only.

Expected operations may include:

Plain Text

```text
read active manifest
read active collection metadata
check immutable object existence
write immutable collection object
conditionally write active manifest
read persisted activation result where required
`
```

Requirements:

- Do not import AWS SDK classes into Command Module or controller code.
- Do not inspect raw AWS SDK errors outside the Persistence Module.
- Reuse stable persistence error types.
- Preserve specific error-name precedence.
- Map precondition failures distinctly.
- Map storage unavailability safely.
- Keep persistence interactions mockable.
  If existing Persistence Module contracts are insufficient, extend them minimally and document the changes in the plan.

## In-memory publication

After successful persistent activation, update the process-local state.

Preferred approach:

- Use an explicit Cache Refresh Module activation or publication operation that accepts the already validated canonical collection and activated metadata.
- Avoid immediately redownloading the same object from S3 when the exact activated canonical value is already available.
- Preserve Cache Refresh Module ownership of runtime publication rules.
- Ensure the new manifest and collection state are published consistently.
  Requirements:

- Publish the collection and matching metadata atomically.
- Do not expose collection data with old metadata.
- Do not expose new metadata with old collection data.
- Do not mutate the previous collection.
- A successful response must not be returned before process-local publication succeeds unless the approved architecture explicitly permits eventual local refresh.
- Other service instances will discover the activation through their normal manifest refresh cycle.
- Do not attempt to update memory in other Fargate tasks directly.
- Do not introduce distributed cache coordination.

## In-memory publication failure

A failure after manifest activation but before local memory publication is a critical partial-failure condition.

For this step:

1. Record the activated manifest as the persistent source of truth.
2. Return or log an explicitly classified activation/publication failure according to the approved recovery policy.
3. Trigger or schedule a controlled local rehydration if an existing safe mechanism is available.
4. Ensure readiness reflects whether mandatory active data is usable.
5. Do not attempt to roll back the manifest unless rollback behaviour is already approved.
6. Do not hide the partial failure.
7. Make recovery possible through startup hydration or the Cache Refresh Module.
   If the exact client response for this condition is not defined, ask for clarification during planning.

Detailed rollback and partial-failure recovery may be implemented in the following dedicated step. Do not invent a risky rollback mechanism here.

## Per-dataset replacement

The workflow must support:

- Vessels
- Gears
- Ports
- Species
- Map land
- Map statistical areas
  Use dataset-specific validators and normalisers through existing registries.

Do not implement dataset-specific update logic inside the controller.

### Ports and derived map ports

When ports are activated:

- Activate only the ports collection.
- Update the in-memory ports collection.
- Derived `map-ports` responses must reflect the new active ports snapshot.
- Do not persist a new `map-ports` object.
- Ensure any derived map-port ETag changes according to the active ports revision.

### Map collections

For map data:

- Persist canonical GeoJSON.
- Preserve WGS84 coordinates.
- Preserve feature GUIDs.
- Use the correct GeoJSON content type.
- Do not simplify or repair geometry during replacement beyond approved canonical normalisation.
- Do not generate new feature GUIDs.

## Success response

Return:

HTTP

```text
200 OK
Content-Type: application/json
Cache-Control: no-store
X-Correlation-Id: <correlation-id>
ETag: "<new-active-collection-etag>"
```

Use a response equivalent to:

JSON

```text
{
  "dataset": "species",
  "collectionId": "13caf795-a8fc-4679-bc1c-d9cc7ce62b57",
  "schemaVersion": "1.0",
  "version": "2026.09.11.1",
  "status": "active",
  "itemCount": 938,
  "etag": "\"sha256-765974...\"",
  "checksum": "765974...",
  "sizeBytes": 682145,
  "uploadedAt": "2026-09-11T08:32:14Z",
  "uploadedBy": "29afebbb-b03e-491d-8201-cb31d9f72461",
  "manifest": {
    "manifestId": "c7b49c26-d6c0-4ab1-9318-cd1c862f4768",
    "version": "2026.09.11.3"
  },
  "previousCollection": {
    "collectionId": "4302cd01-8af7-47f4-bb74-60581e0f393f",
    "version": "2026.08.15.1",
    "etag": "\"sha256-a94513...\""
  },
  "warnings": []
}
```

Adapt to existing approved contracts.

### Success-response rules

- Clearly identify the new active collection.
- Include previous collection metadata when one existed.
- Include safe normalisation warnings.
- Do not include the complete collection.
- Do not expose internal object keys.
- Do not expose bucket names.
- Do not expose raw S3 object-version values unless approved.
- Do not include undefined properties.
- Use `no-store` .
- Return the new active collection ETag.
- Do not return success if manifest activation failed.
- Do not imply all service instances have refreshed immediately.

## Idempotent success

If the request is detected as an approved idempotent replay, return a successful response that clearly indicates no new activation occurred.

The response may include:

JSON

```text
{
  "status": "active",
  "idempotent": true
}
```

Use existing repository conventions.

Requirements:

- Do not create another immutable object.
- Do not create another manifest revision unnecessarily.
- Do not refresh memory unnecessarily.
- Return the current active metadata.
- Preserve no-store behaviour.
- Record an audit event indicating idempotent replay.

## Error behaviour

Use the Step 13 standard error envelope.

### Invalid request

Return `400` for:

- Unsupported dataset
- Invalid upload request
- Missing file
- Malformed JSON
- Dataset mismatch where treated as a request failure
- Invalid `validateOnly` value
- Invalid `If-Match` syntax

### Unauthorised

Return `401` .

### Forbidden

Return `403` .

### Conflict or precondition failure

Return the approved `409` or `412` for:

- Stale active collection ETag
- Stale manifest ETag
- Existing collection version containing different data
- Concurrent activation
- Immutable object conflict

### Too large

Return `413` .

### Unsupported media type

Return `415` .

### Validation or normalisation failure

Return `422` .

### Persistence unavailable

Return `503` for temporary S3 unavailability.

### Unexpected failure

Return safe `500` .

Requirements:

- Do not expose raw AWS errors.
- Do not expose object keys.
- Do not expose stack traces.
- Include the correlation trace ID.
- Include retryable status only when meaningful.
- Include `Retry-After` only when justified.
- Do not publicly cache error responses.

## Version conflict response

Use a response equivalent to:

JSON

```text
{
  "error": {
    "code": "collection_modified",
    "message": "The active collection changed after the upload was prepared.",
    "traceId": "284090ed-c909-4bbe-8866-f40e09388a0d",
    "dataset": "species",
    "retryable": false,
    "details": [
      {
        "code": "etag_mismatch",
        "providedEtag": "\"sha256-old-version\"",
        "currentEtag": "\"sha256-current-version\"",
        "currentVersion": "2026.09.11.1"
      }
    ]
  }
}
```

Only expose current ETag and version if approved and safe.

Do not expose internal manifest object keys or S3 object versions.

## Audit behaviour

A complete collection replacement is an administrative state-changing action.

Produce or invoke an audit event according to existing conventions.

Include safe concepts such as:

- Action
- Dataset
- Actor identifier
- Correlation ID
- Previous collection ID and version
- New collection ID and version
- Previous and new manifest version
- Result
- Warning count
- Timestamp
- Duration
- Idempotent replay indicator
- Failure stage when unsuccessful
  Do not audit:

- Complete uploaded collection
- Full vessel identifiers
- Tokens
- Credentials
- Complete GeoJSON geometry
- Raw error objects
  Audit logging must distinguish:

- Validation failure
- Persistence failure
- Concurrency conflict
- Activation success
- In-memory publication failure
- Idempotent replay

## Logging

Use existing structured logging.

Safe logs may include:

- Correlation ID
- Dataset
- Collection ID
- Collection version
- Previous active version
- New manifest version
- File size
- Item or feature count
- Validation duration
- Persistence duration
- Activation duration
- Publication duration
- Warning count
- Result
- Failure stage
- Error code
- Retryable status
  Do not log:

- Complete uploaded content
- Authentication tokens
- Credentials
- Internal bucket names unnecessarily
- Complete object keys
- Full business identifiers
- Complete geometry
- Raw multipart bodies
- Stack traces for expected failures
  Unexpected internal errors may include protected diagnostic stacks according to repository conventions.

## Metrics

Use existing metrics hooks where available.

Prepare or emit bounded metrics equivalent to:

Plain Text

```text
reference_data_collection_replacement_requests_total
reference_data_collection_replacement_duration
reference_data_collection_replacement_successes_total
reference_data_collection_replacement_failures_total
reference_data_collection_replacement_conflicts_total
reference_data_collection_replacement_idempotent_total
reference_data_collection_activation_duration
reference_data_collection_publication_failures_total
```

Acceptable bounded labels include:

- Dataset
- Result
- Failure stage
- Status code
  Do not use:

- Collection GUIDs
- Actor IDs
- Correlation IDs
- Collection versions
- Object keys
- Business identifiers
  as metric labels.

## Security and privacy requirements

Treat uploads and metadata as untrusted.

Requirements:

- Require write authorisation.
- Apply upload-size limits.
- Accept exactly one complete file.
- Reject unsupported media types.
- Do not trust filenames.
- Do not use filenames as object keys.
- Validate dataset and version before key construction.
- Defend against path traversal.
- Defend against prototype pollution.
- Bound parsing, validation, normalisation, and issue collection.
- Do not execute uploaded content.
- Do not expose stack traces.
- Do not expose raw dependency errors.
- Do not log complete collections.
- Do not log tokens or credentials.
- Do not return internal persistence paths.
- Use optimistic concurrency.
- Do not weaken S3 access controls.
- Do not make objects public.
- Preserve immutable collection revisions.
- Clean up local temporary files.
- Use no-store response caching.
- Review any new dependency for security, maintenance, and licence impact.

## Performance requirements

- Parse only once where practical.
- Validate and normalise only once.
- Reuse the canonical normalised value for persistence and in-memory publication.
- Avoid unnecessary deep cloning.
- Avoid repeatedly serialising large collections.
- Use deterministic serialisation for checksums.
- Avoid downloading the newly written collection when a safe canonical value is already available.
- Keep persistence calls bounded.
- Avoid unbounded retries.
- Avoid unbounded concurrent activation.
- Enforce one activation operation per relevant concurrency scope where needed.
- Preserve process responsiveness within configured file-size limits.
- Record stage durations.
- Do not block the event loop unnecessarily.
- Do not attempt to synchronously update every service instance.

## Retry policy

Do not add uncontrolled retries.

Requirements:

- Do not retry validation, normalisation, or concurrency failures.
- Reuse existing AWS SDK retry behaviour for transient persistence failures.
- Do not retry manifest precondition failures.
- Do not retry immutable version conflicts.
- If a transient collection-object write fails, allow bounded underlying persistence retry.
- If manifest activation fails due to a transient service failure, report failure rather than performing an unsafe blind retry.
- If retrying a conditional manifest write is approved, reread active state and re-evaluate the entire precondition before retrying.
- Never retry using a stale expected ETag.

## Temporary and orphaned objects

A collection object may be written successfully before manifest activation fails.

For this step:

- Treat the object as an unreferenced immutable revision.
- Do not delete it immediately unless the approved persistence policy guarantees safe ownership and cleanup.
- Do not activate it implicitly.
- Record enough internal information for later reconciliation.
- Ensure startup hydration ignores objects not referenced by the active manifest.
- Document orphan cleanup as deferred if assigned to a later recovery step.
  Do not broaden this step into a full lifecycle cleanup implementation unless already approved.

## Unit test requirements

Add comprehensive Docker-free unit tests.

### Command orchestration

Test:

- Successful replacement sequence
- Exact pipeline ordering
- Structural failure stops normalisation and persistence
- Normalisation failure stops business validation and persistence
- Business-validation failure stops persistence
- Object write occurs before manifest write
- Manifest activation occurs before memory publication
- Successful memory publication
- Previous metadata returned
- No previous collection
- Normalisation warnings preserved
- Input not mutated
- Actor and clock metadata applied
- Unexpected stage failure mapped safely

### Preconditions

Test:

- Matching collection ETag
- Missing required `If-Match`
- Malformed `If-Match`
- Stale collection ETag
- Matching manifest precondition
- Manifest changed concurrently
- Conditional manifest write failure
- Specific precondition error mapping
- No generic `404` or `500` masking
- No activation after failed precondition

### Version and idempotency

Test:

- New collection version
- Same active version and same checksum
- Same active version and different checksum
- Existing inactive immutable version with same checksum
- Existing inactive immutable version with different checksum
- Manifest version distinct from collection version
- Idempotent replay does not rewrite object
- Idempotent replay does not create manifest revision
- Idempotent replay does not refresh memory unnecessarily

### Persistence interaction

Test:

- Correct dataset-specific key
- Correct content type
- Canonical data persisted
- Raw uploaded data not persisted
- Immutable-write options
- Collection-object write failure
- Manifest read failure
- Manifest write failure
- Access denied
- Missing bucket
- Timeout
- Transient failure
- No raw AWS errors outside persistence
- Unrelated manifest entries preserved

### Manifest construction

Test:

- Target dataset entry replaced
- Unrelated entries preserved
- Deterministic ordering
- New manifest ID where required
- New manifest version
- Generated-at timestamp
- Collection metadata included
- Derived `map-ports` not added as persisted entry
- Valid manifest produced
- Input manifest not mutated

### In-memory publication

Test:

- Collection and metadata published atomically
- Previous data visible until publication
- New data visible after publication
- Publication uses activated metadata
- Publication failure classified
- Readiness response according to approved policy
- Rehydration or recovery hook invoked where approved
- Other datasets unchanged
- Ports activation changes derived map-port results
- Failed activation leaves query results unchanged

### Validation-only regression

Test:

- `validateOnly=true` performs no persistence
- `validateOnly=true` performs no manifest update
- `validateOnly=true` performs no memory update
- `validateOnly=true` performs no cache refresh
- Validation-only responses remain unchanged
- Full replacement and validation-only share validation logic

### Dataset coverage

Test successful and failed replacements for:

- Vessels
- Gears
- Ports
- Species
- Map land
- Map statistical areas
- Rejected map ports

### Architecture boundaries

Verify:

- Controller does not import AWS SDK.
- Command Module does not import AWS SDK.
- Only Persistence Module accesses S3.
- Authentication Service is not called outside Validation Module.
- Dataset rules remain in validators and normalisers.
- No Redis dependency is introduced.
- No item-level mutation route is introduced.

## Integration test requirements

Use Hapi.js `server.inject` or the existing Docker-free application test approach with mocked or in-memory persistence.

Verify:

1. Full replacement route registration.
2. Successful vessel replacement.
3. Successful gear replacement.
4. Successful port replacement.
5. Successful species replacement.
6. Successful map-land replacement.
7. Successful map-statistical-areas replacement.
8. Rejected map-ports replacement.
9. Authentication failure.
10. Authorisation failure.
11. Invalid upload.
12. Validation failure.
13. Normalisation failure.
14. Stale `If-Match` .
15. Version conflict.
16. Persistence failure.
17. Conditional manifest conflict.
18. Successful active-manifest change.
19. Successful in-memory change.
20. Existing read API returns new data.
21. Manifest API returns new version.
22. Old active collection remains after failed replacement.
23. Validation-only mode remains non-persistent.
24. Success response includes previous and new metadata.
25. Response uses no-store.
26. ETag is the new active collection ETag.
27. Standard error envelope is used.
28. Unexpected errors produce a safe `500` .
29. Normal tests remain Docker-free.

## Floci integration tests

Use:

Plain Text

```text
npm run test:floci
```

Add focused Floci tests for real S3-compatible behaviour:

- Write immutable collection object.
- Read the written object.
- Confirm correct content type.
- Confirm object versioning behaviour where supported.
- Conditionally update active manifest.
- Reject stale manifest condition.
- Preserve unrelated manifest entries.
- Verify the active manifest references the new collection.
- Verify failed conditional activation leaves the previous manifest active.
- Verify missing bucket mapping.
- Verify access or persistence error mapping where supported.
- Verify an unreferenced object is not treated as active.
- Verify service hydration uses only the active manifest.
  Keep normal tests Docker-free.

Do not duplicate the complete application suite in Floci tests.

## End-to-end state verification

After a successful replacement, verify:

Plain Text

```text
upload response
  -> active manifest API
  -> affected collection read API
  -> individual item or search API where applicable
  -> derived map-port response after ports activation
```

All responses must reflect one consistent active revision.

After a failed replacement, verify:

Plain Text

```text
active manifest unchanged
affected collection response unchanged
collection ETag unchanged
other datasets unchanged
readiness unaffected when previous data remains valid
`
```

## Regression test requirements

Run existing tests for:

- Step 21 validation-only mode
- Structural validation
- Business validation
- Canonical normalisation
- Persistence
- In-Memory Data Store
- Cache Refresh Module
- Startup hydration
- Common API behaviour
- Manifest API
- Shared query engine
- Vessel read API
- Gear read API
- Port read API
- Species read API
- Map-location read API
- Health and readiness
  Explicitly confirm:

- Specific persistence error mapping remains ahead of generic status mapping.
- `NoSuchBucket` remains distinct from `NoSuchKey` .
- Precondition failures remain distinct.
- Read APIs reflect successful activation.
- Read APIs remain unchanged after failed activation.
- Manifest ETag changes only after successful activation.
- A ports replacement changes derived map-port output.
- Normal tests remain Docker-free.
- Floci tests remain separate.

## OpenAPI documentation

If the repository contains OpenAPI, document:

HTTP

```text
PUT /api/v1/reference-data/{dataset}
```

Include:

- Dataset path parameter
- Optional `validateOnly`
- Authentication requirement
- Write permission
- `If-Match`
- Correlation header
- Upload media types
- Request metadata
- Maximum upload size
- Success response
- Idempotent response
- Previous collection metadata
- Normalisation warnings
- `200`
- `400`
- `401`
- `403`
- `409` or `412`
- `413`
- `415`
- `422`
- `500`
- `503`
  Clearly state:

- The operation replaces a complete collection.
- It does not update individual records.
- Activation is atomic through the active manifest.
- A failed request leaves the previous active collection in place.
- `map-ports` cannot be uploaded.
- Other service instances may observe the change through their normal refresh cycle.

## Documentation requirements

Update repository documentation with:

- Complete collection replacement workflow
- Supported datasets
- Validation-only versus replacement mode
- Authentication and permission
- `If-Match` and optimistic concurrency
- Version-conflict behaviour
- Idempotency policy
- Immutable collection objects
- Active manifest as activation point
- Object-key convention
- Checksum and ETag policy
- Manifest update behaviour
- In-memory publication
- Multi-instance refresh behaviour
- Success response
- Failure responses
- Partial-failure behaviour
- Unreferenced-object behaviour
- Audit events
- Security considerations
- Performance considerations
- Docker-free tests
- Floci tests
- Operational verification
- Work deferred to rollback and recovery
  Include a Mermaid sequence diagram showing:

Plain Text

```text
Client
Controller
Validation Module
Command Module
Normalisation Module
Persistence Module
S3
Cache Refresh Module
In-
```

## Explicit exclusions

Do not implement:

- Item-level create, update, patch, or delete
- Partial collection upload
- `map-ports` upload
- Manual editing of active manifest entries
- Public rollback endpoint
- Full orphan-object cleanup
- Historical collection browsing API
- Immediate refresh of every service instance
- Distributed locking service
- Redis
- SQS or EventBridge notifications
- API Gateway deployment
- Fargate deployment
- Production IAM changes
- Automatic generation of item GUIDs
- Automatic generation of business collection versions
- Silent overwrite of immutable collection objects
- Risky rollback after manifest activation
- Changes to unrelated read API contracts

## Required plan content

The GitHub-generated plan must include:

1. Current upload and validation-only implementation.
2. Current Command Module structure.
3. Current Persistence Module contract.
4. Current active-manifest contract.
5. Current object-key convention.
6. Current ETag and checksum behaviour.
7. Current In-Memory Data Store publication contract.
8. Current Cache Refresh Module integration.
9. Current authentication and authorisation behaviour.
10. Current API error behaviour.
11. Existing Floci tests.
12. Existing conventions to retain.
13. Gaps against Step 22.
14. Proposed full replacement route behaviour.
15. Proposed `validateOnly` compatibility.
16. Proposed `If-Match` policy.
17. Proposed final manifest concurrency control.
18. Proposed collection-version conflict policy.
19. Proposed idempotency policy.
20. Proposed metadata calculation.
21. Proposed immutable object-write behaviour.
22. Proposed active-manifest construction.
23. Proposed activation sequence.
24. Proposed in-memory publication.
25. Proposed publication-failure handling.
26. Proposed unreferenced-object handling.
27. Proposed success response.
28. Proposed conflict and failure responses.
29. Proposed logging, audit, and metrics.
30. Exact files to create.
31. Exact files to modify.
32. Files intentionally left unchanged.
33. Unit-test approach.
34. Docker-free integration-test approach.
35. Floci integration-test approach.
36. End-to-end state-verification approach.
37. Regression-test approach.
38. OpenAPI updates.
39. Documentation updates.
40. Security and privacy considerations.
41. Performance considerations.
42. Verification commands.
43. Assumptions and unresolved ambiguities.
44. Work explicitly deferred to rollback and recovery.

## Expected deliverables

- GitHub-generated plan saved as: Plain Text 1 github-prompts/Step 22-implement-atomic-full-collection-replacement-plan.md
- Full collection replacement route.
- Strict dataset and request validation.
- Write-permission enforcement.
- `If-Match` handling.
- Command Module replacement orchestration.
- Shared validation-only and replacement pipeline.
- Canonical checksum and metadata calculation.
- Immutable collection-object write.
- Conditional active-manifest update.
- Collection-version conflict detection.
- Idempotency behaviour.
- Atomic process-local publication.
- Previous and new collection response metadata.
- Normalisation warning response.
- No-store caching.
- Structured logs.
- Audit events or hooks.
- Metrics hooks.
- Docker-free unit tests.
- Docker-free application integration tests.
- Focused Floci integration tests.
- Read API and Manifest API state verification.
- Regression verification.
- OpenAPI updates where present.
- Developer, consumer, and operational documentation.
- Step completion report.

## Acceptance criteria

- The plan is saved before implementation begins.
- The saved plan is assumed approved.
- Copilot continues without requesting plan approval.
- Full replacement is available through: Plain Text 1 PUT /api/v1/reference-data/{dataset}
- Step 21 validation-only mode remains available.
- Full replacement requires write permission.
- All maintained uploadable datasets are supported.
- `map-ports` is rejected.
- The uploaded collection passes parsing, structural validation, canonical normalisation, and business validation.
- Business validation runs against normalised data.
- Valid GUIDs are preserved.
- Invalid or missing GUIDs are not replaced.
- Business identifiers remain distinct from GUIDs.
- Leading zeros are preserved.
- Canonical normalised content is persisted.
- Raw unnormalised input is not activated.
- The Persistence Module is the only S3 integration point.
- Collection objects are immutable.
- The active manifest is the persistent activation point.
- Unrelated manifest entries are preserved.
- Manifest updates use optimistic concurrency.
- Stale writers cannot overwrite newer activation.
- Collection and manifest versions remain distinct.
- Version conflicts are handled deterministically.
- Idempotent replay behaviour is documented and tested.
- A failed collection-object write leaves the active manifest unchanged.
- A failed manifest write leaves the previous active collection unchanged.
- In-memory publication occurs only after manifest activation.
- Collection data and metadata are published atomically.
- Successful replacement is visible through the corresponding read API.
- Successful replacement is visible through the Manifest API.
- A ports replacement affects derived map-port output.
- Failed replacement leaves read APIs unchanged.
- Validation-only mode performs no persistence or state change.
- Success identifies new and previous collection metadata.
- Success does not expose internal object keys or bucket names.
- Administrative success responses use `no-store` .
- Conflict, validation, persistence, and unexpected errors use the standard envelope.
- Raw AWS SDK errors are not exposed.
- Specific persistence errors remain ahead of generic status mapping.
- Complete uploads are not logged.
- Audit events identify state-changing outcomes safely.
- No item-level mutation endpoint is introduced.
- No Redis or distributed lock service is introduced.
- Normal tests remain Docker-free.
- Floci tests remain separate.
- Unit, integration, and Floci tests pass.
- Existing read API tests pass.
- Manifest, cache, and persistence regression tests pass.
- Type checking passes.
- Linting passes, or pre-existing issues are documented.
- The build passes.
- Documentation matches the implementation.
- Detailed rollback and orphan cleanup remain deferred where assigned to a later step.

## Verification

Use the repository's actual package manager, module system, scripts, and test configuration.

Run the applicable equivalents of:

Plain Text

```text
install dependencies
run type checking
run linting
run Step 22 unit tests
run Command Module replacement tests
run manifest concurrency tests
run in-memory publication tests
run Hapi.js replacement integration tests
run Step 21 validation-only regression tests
run read API regression tests
run Manifest API tests
run Cache Refresh Module tests
run Persistence Module tests
run the complete Docker-free test suite
run the build
run focused Floci tests with npm run test:floci
```

Explicitly verify:

Plain Text

```text
plan saved
successful vessel replacement
successful gear replacement
successful port replacement
successful species replacement
successful map-land replacement
successful map-statistical-areas replacement
map-ports rejected
write permission required
validation-only mode unchanged
matching If-Match
missing required If-Match
stale If-Match
concurrent manifest change
new collection version
duplicate version with same checksum
duplicate version with different checksum
canonical content persisted
immutable object not overwritten
correct JSON content type
correct GeoJSON content type
active manifest updated conditionally
unrelated manifest entries preserved
new manifest version
collection version kept distinct
successful in-memory publication
read API returns new collection
Manifest API returns new collection metadata
Manifest ETag changes after activation
ports replacement changes map-ports
object-write failure leaves active state unchanged
manifest-write failure leaves active state unchanged
publication failure classification
unreferenced object remains inactive
safe conflict response
safe validation response
safe persistence response
safe unexpected 500
no internal object key in response
no bucket name in response
no raw AWS error
no stack trace
no item-level mutation route
no Redis dependency
```

Record:

- Exact commands
- Exit codes
- Test counts
- Coverage results
- Type-check result
- Lint result
- Build result
- Floci results
- Regression results
- Pre-existing warnings or failures
- Approved deviations
  If verification reveals a pre-existing issue outside this step:

1. Record the exact failing command.
2. Identify the likely pre-existing cause.
3. Explain whether the issue blocks Step 22.
4. Do not expand scope silently.
5. Do not weaken tests to obtain a passing result.
6. Ask for clarification if resolution requires an activation, concurrency, versioning, recovery, security, or architecture decision.

## Completion response

Provide a concise implementation report containing:

- Repository state discovered
- Saved plan filename
- Replacement endpoint implemented
- Supported datasets
- Validation-only compatibility
- Authorisation behaviour
- `If-Match` policy
- Manifest concurrency strategy
- Collection-version conflict policy
- Idempotency policy
- Immutable object-write behaviour
- Active-manifest activation sequence
- In-memory publication behaviour
- Publication-failure handling
- Unreferenced-object handling
- Success and error response contracts
- Files created
- Files modified
- Files intentionally left unchanged
- Tests added
- Exact verification commands and results
- Coverage results
- Floci results
- Regression results
- Security and privacy controls
- Performance safeguards
- Audit and metrics behaviour
- Approved deviations
- Existing issues not introduced by Step 22
- Work deferred to rollback and recovery
- Remaining assumptions, risks, or owner decisions
  if you reach any ambiguity ask me to clarify
