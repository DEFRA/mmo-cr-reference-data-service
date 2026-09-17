# Step 21: Implement Full Collection Upload Validation Mode

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
5. Inspect the existing Reference Data Controller, Command Module, Validation Module, Data Normalisation Module, Persistence Module, common API behaviour, authentication boundary, request-size configuration, tests, fixtures, and documentation.
6. Inspect the implemented canonical schemas and validation rules for all supported datasets.
7. Identify existing multipart handling, payload parsing, temporary-file handling, upload limits, upload response contracts, and Hapi.js route conventions.
8. Produce a repository-specific implementation plan based on the code that actually exists.
   Do not assume the repository is empty.

Reuse suitable existing validation, normalisation, error handling, correlation, logging, and authentication behaviour.

After producing the plan, save it as:

Plain Text

```text
github-prompts/Step 21-implement-full-collection-upload-validation-mode-plan.md
```

The saved GitHub-generated plan must be treated as **already approved** .

After saving the plan, continue directly with implementation without requesting plan approval unless:

- The implementation conflicts with the approved Reference Data Service design.
- A required upstream contract is missing.
- The upload format or API contract is materially ambiguous.
- An incompatible or destructive repository change is required.
- A security or privacy decision requires owner input.
- The implementation would require work assigned to the atomic replacement step.
  The plan must be saved before implementation begins.

## Objective

Implement the validation-only mode for complete reference-data collection uploads.

Implement:

HTTP

```text
PUT /api/v1/reference-data/{dataset}?validateOnly=true
```

This endpoint must allow an authorised caller to submit a complete JSON or GeoJSON reference-data collection and receive:

- Structural validation results.
- Canonical normalisation results.
- Common business-validation results.
- Dataset-specific business-validation results.
- Counts of received and normalised records or features.
- Safe normalisation warnings.
- A successful confirmation when the complete collection is valid.
  Validation-only mode must not:

- Write the collection to S3.
- Update the active manifest.
- Replace an active collection.
- Modify the In-Memory Data Store.
- Trigger cache refresh.
- Generate or replace missing GUIDs.
- Repair ambiguous business data.
- Perform item-level mutations.

## Supported datasets

Validation-only uploads must support maintained uploadable datasets:

Plain Text

```text
vessels
gears
ports
species
map-land
map-statistical-areas
```

The derived dataset:

Plain Text

```text
map-ports
```

must not be uploadable.

A validation-only request for `map-ports` must return the approved structured client error.

Use the central supported-dataset registry rather than duplicating dataset lists across the route, controller, and Command Module.

## Architectural boundaries

Preserve these responsibilities:

1. The **Reference Data Controller** owns Hapi.js request and response mapping.
2. The **Command Module** coordinates the validation-only use case.
3. The **Validation Module** owns structural and business validation.
4. The **Data Normalisation Module** owns canonical normalisation.
5. The **Validation Module is the only component permitted to call the Authentication Service** .
6. The **Persistence Module is the only component permitted to access S3 or Floci** .
7. Validation-only mode must not call the Persistence Module.
8. Validation-only mode must not modify the In-Memory Data Store.
9. Validation-only mode must not call the Cache Refresh Module.
10. The controller must not contain dataset-specific business rules.
11. The Command Module must not duplicate existing validators or normalisers.
12. Common API behaviour from Step 13 must own error mapping, correlation, headers, and safe unexpected-error handling.
13. Redis or another external cache must not be introduced.

## Required processing pipeline

Implement the validation-only workflow as:

Plain Text

```text
receive complete collection upload
  -> authenticate and authorise
  -> validate route, query, headers, media type, and size
  -> parse JSON or GeoJSON
  -> validate common and dataset-specific structure
  -> canonically normalise structurally usable input
  -> validate common and dataset-specific business rules
  -> calculate safe validation summary
  -> return result
```

The endpoint must not continue to persistence or activation.

The validation and normalisation stages must remain explicit and distinguishable.

### Stage behaviour

- Parsing failures return a request-level error.
- Structural failures prevent unsafe normalisation stages from running.
- Canonical normalisation runs only on structurally usable input.
- Business validation runs against the canonical normalised value.
- Normalisation warnings do not make a collection invalid.
- Validation errors prevent a successful validation result.
- A failure must not affect the currently active collection.

## Endpoint

Implement:

HTTP

```text
PUT /api/v1/reference-data/{dataset}?validateOnly=true
```

### Query parameter

For this step, require:

Plain Text

```text
validateOnly=true
```

Requirements:

- Parse the value strictly.
- Do not use JavaScript truthiness.
- Reject invalid boolean representations.
- Do not treat `validateOnly=false` as validation-only mode.
- If the same route will later support real replacement, leave `validateOnly=false` or an absent value for the later atomic replacement step.
- Do not implement real replacement in this step.
  If route registration requires a temporary constraint while real replacement is not yet implemented, return a clear structured error for requests that do not explicitly request validation-only mode.

## Request format

Use the exact upload contract approved by the repository and API design.

Preferred request format:

HTTP

```text
PUT /api/v1/reference-data/species?validateOnly=true
Authorization: Bearer <access-token>
Content-Type: multipart/form-data
X-Correlation-Id: <optional-guid>
```

Expected multipart fields are equivalent to:

Plain Text

```text
file
schemaVersion
version
effectiveFrom
description
```

The uploaded file contains the complete collection envelope.

If the repository has already approved direct JSON or GeoJSON request bodies instead of multipart uploads, retain that decision and document it in the saved plan.

Do not support multiple competing upload formats without an explicit requirement.

## Uploaded file rules

Requirements:

- Exactly one collection file is accepted.
- The collection file must be complete.
- Empty files are rejected.
- Multiple files are rejected.
- Unsupported file types are rejected.
- The file must not be interpreted as executable content.
- The original filename must not be trusted for dataset selection.
- The original filename must not be used as an S3 object key.
- The dataset is selected from the validated route parameter.
- The declared collection dataset must match the route dataset.
- The file must be processed within configured size limits.
- Complete file contents must not be written to logs.

## Supported media types

Support the media types required by the selected upload mechanism.

For uploaded collection content, recognise:

Plain Text

```text
application/json
application/geo+json
```

If multipart is used, the outer request uses:

Plain Text

```text
multipart/form-data
```

Requirements:

- JSON datasets use the approved JSON media type.
- Map datasets use the approved GeoJSON media type where file-level content types are available.
- Do not trust filename extensions alone.
- Reject unsupported media types with `415` .
- Reject malformed JSON or GeoJSON with `400` .
- Do not accept archives, executable files, YAML, XML, CSV, or arbitrary binary input in this step.

## Upload size limits

Use the central configuration mechanism.

Add or reuse a setting equivalent to:

Plain Text

```text
REFERENCE_DATA_MAX_UPLOAD_BYTES
```

Requirements:

- Validate the configuration during startup.
- Apply the limit at the Hapi.js request boundary.
- Avoid buffering input beyond the configured limit.
- Return `413` for oversized uploads.
- Do not include the rejected file contents in the error response.
- Log only safe size metadata.
- Document the default and units.
- Keep tests deterministic.
  Do not introduce an unbounded upload path.

## Authentication and authorisation

Use the existing authentication integration.

The required permission is:

Plain Text

```text
reference-data.write
```

Requirements:

- Missing or invalid authentication returns `401` .
- Insufficient permission returns `403` .
- Read permission alone must not authorise validation-only uploads.
- Do not call the Authentication Service from the controller or Command Module.
- Use the Validation Module or existing Hapi.js authentication strategy.
- Do not log bearer tokens.
- Do not accept user identity from request payload fields.
- Include the authenticated subject in audit logging only according to the approved security policy.
  If authentication integration is not implemented, preserve the explicit authorisation boundary and stop for clarification before exposing an unprotected write-oriented endpoint.

## Parsing

Implement or reuse safe parsing for uploaded JSON and GeoJSON.

Requirements:

- Parse the document exactly once where practical.
- Reject malformed JSON with a stable request error.
- Reject a non-object root.
- Do not evaluate JavaScript.
- Do not support comments or non-standard JSON unless explicitly approved.
- Defend against prototype-pollution properties.
- Bound nesting and input size according to existing policies.
- Do not mutate the parsed object.
- Keep parsing errors separate from structural-validation errors.
  Malformed JSON should map to:

HTTP

```text
400 Bad Request
```

with a stable error code equivalent to:

Plain Text

```text
invalid_json
```

## Structural validation

Use the structural validators implemented in previous steps.

Validate:

- Common collection envelope.
- Dataset-specific collection shape.
- GUID syntax.
- Required properties.
- Supported schema version.
- Property types.
- Enum values.
- JSON collection structure.
- GeoJSON structure.
- Geometry types and coordinate shape.
- Declared dataset.
- Required nested structures.
  Requirements:

- Use the route dataset as the expected dataset.
- Detect `dataset` mismatch.
- Do not infer a dataset from the filename.
- Do not repair invalid GUIDs.
- Do not proceed to unsafe normalisation after structural failure.
- Preserve deterministic issue ordering.
- Respect the maximum issue count.
- Return safe paths and messages.

## Canonical normalisation

Use the Data Normalisation Module implemented in Step 10.

Requirements:

- Preserve valid GUIDs.
- Preserve business identifiers separately.
- Preserve leading zeros.
- Apply only approved deterministic transformations.
- Do not infer missing identifiers.
- Do not infer vessel home ports.
- Do not translate species names.
- Do not silently redefine gear `fixed` .
- Do not infer map CRS or coordinate ordering.
- Do not mutate input.
- Preserve deterministic warning order.
- Preserve idempotency.
- Do not write normalised data to persistence.
- Do not return the complete normalised collection unless explicitly approved.

## Business validation

Run common and dataset-specific business validation against the normalised collection.

Validate applicable rules including:

- Duplicate GUIDs.
- Duplicate business codes.
- Collection item or feature count consistency.
- Date-range consistency.
- Vessel identifier uniqueness.
- Positive vessel length.
- Gear category relationships.
- Gear characteristic relationships.
- Approved gear data types.
- Vessel-length applicability.
- Port coordinate ranges.
- Species nested-name GUID uniqueness.
- FAO-code uniqueness.
- Statistical-area code uniqueness.
- Map geometry business rules currently approved.
  Preserve prior decisions:

- Statistical-area `parentCode` does not need to resolve within the same collection.
- The only approved gear characteristic `dataType` is `number` .
- Species nested-name GUIDs are unique collection-wide across common and local names.
- Port-code comparison remains exact where previously approved.
- Appropriate alphabetic and alphanumeric business-code comparisons remain case-insensitive according to the approved dataset rules.
- Valid values are not modified solely for comparison.

## Validation-only success response

Return:

HTTP

```text
200 OK
Content-Type: application/json
X-Correlation-Id: <correlation-id>
Cache-Control: no-store
```

Use a response equivalent to:

JSON

```text
{
  "dataset": "species",
  "valid": true,
  "schemaVersion": "1.0",
  "version": "2026.09.11.1",
  "receivedItemCount": 938,
  "normalisedItemCount": 938,
  "changed": true,
  "warnings": [
    {
      "code": "whitespace_trimmed",
      "path": "items[142].scientificName",
      "message": "Leading and trailing whitespace was removed."
    }
  ]
}
```

For GeoJSON, use feature-count properties according to the implemented response contract, such as:

JSON

```text
{
  "dataset": "map-statistical-areas",
  "valid": true,
  "schemaVersion": "1.0",
  "version": "2026.09.11.1",
  "receivedFeatureCount": 3465,
  "normalisedFeatureCount": 3465,
  "changed": false,
  "warnings": []
}
```

Adapt property names to established repository conventions.

### Success-response requirements

- `valid` must be `true` .
- Include the route dataset.
- Include schema version and collection version when structurally available.
- Report received and normalised counts.
- Include whether normalisation changed the document.
- Include safe normalisation warnings.
- Do not include complete canonical data by default.
- Do not expose S3 metadata.
- Do not return an ETag for an inactive uploaded file unless the approved contract explicitly defines a validation checksum.
- Do not imply that the collection was saved or activated.
- Do not return an active collection ID as if the upload replaced it.
- Apply `Cache-Control: no-store` .

## Validation failure response

Return:

HTTP

```text
422 Unprocessable Entity
Content-Type: application/json
Cache-Control: no-store
```

Use the standard Step 13 error envelope.

Example:

JSON

```text
{
  "error": {
    "code": "collection_validation_failed",
    "message": "The uploaded ports collection contains validation errors.",
    "traceId": "ba9d3624-d002-4972-af6b-d44586a5a917",
    "dataset": "ports",
    "retryable": false,
    "details": [
      {
        "path": "items[17].id",
        "code": "invalid_guid",
        "message": "The value must be a valid GUID."
      },
      {
        "path": "items[28].code",
        "code": "duplicate_business_code",
        "message": "The port code appears more than once."
      }
    ]
  }
}
```

Requirements:

- Return multiple safely detectable errors.
- Preserve deterministic detail ordering.
- Bound the detail count.
- Indicate when details were truncated.
- Do not include complete records.
- Do not include unsafe rejected values.
- Do not expose stack traces.
- Do not expose raw Joi errors.
- Do not expose raw normalisation errors.
- Do not expose raw persistence or AWS errors.
- Do not return warnings as validation errors.

## Other error responses

Use the standard error envelope.

### Invalid request

HTTP

```text
400 Bad Request
```

Applicable to:

- Invalid route dataset
- Invalid `validateOnly` value
- Missing file
- Multiple files
- Empty file
- Malformed JSON
- Dataset mismatch where the approved contract treats it as a request error

### Unauthorised

HTTP

```text
401 Unauthorized
```

### Forbidden

HTTP

```text
403 Forbidden
```

### File too large

HTTP

```text
413 Content Too Large
```

### Unsupported media type

HTTP

```text
415 Unsupported Media Type
```

### Structurally or semantically invalid collection

HTTP

```text
422 Unprocessable Entity
```

### Unexpected internal failure

HTTP

```text
500 Internal Server Error
```

Do not return `503` for ordinary invalid uploaded data.

## Command Module use case

Implement or align a use case equivalent to:

Plain Text

```text
validateCollectionUpload(command)
```

The command should contain only approved domain inputs, such as:

Plain Text

```text
expected dataset
parsed collection
upload metadata
authenticated actor context
correlation context
```

The Command Module must:

1. Verify that the dataset is maintained and uploadable.
2. Coordinate structural validation.
3. Coordinate canonical normalisation.
4. Coordinate business validation.
5. Produce a safe validation summary.
6. Keep warnings separate from errors.
7. Avoid persistence.
8. Avoid in-memory publication.
9. Avoid cache refresh.
10. Avoid Hapi.js response creation.
    The Command Module must not:

- Access S3.
- Call Floci.
- Write the active manifest.
- Replace an in-memory collection.
- Generate new item GUIDs.
- Implement dataset-specific rules inline.
- Call the Authentication Service.
- Return raw framework errors.

## Controller responsibilities

The controller must:

- Receive the Hapi.js request.
- Use existing authentication and authorisation context.
- Validate route, query, headers, media type, and payload limits.
- Extract exactly one uploaded file.
- Parse the collection through the approved parsing boundary.
- Construct the validation-only command.
- Call the Command Module.
- Map the result through common API behaviour.
- Return correlation and no-store headers.
  The controller must not:

- Implement business validation.
- Implement normalisation rules.
- Access S3.
- Update memory.
- Trigger refresh.
- Generate item GUIDs.
- Construct raw error envelopes independently of Step 13.

## No persistence guarantee

Add explicit protections proving validation-only mode cannot persist.

Requirements:

- Do not inject the Persistence Module into the validation-only use case unless an existing Command Module composition requires it.
- If persistence is present in a broader service object, verify that no persistence method is called.
- Do not write temporary parsed files to the S3-compatible store.
- Do not update the active manifest.
- Do not calculate an S3 object key.
- Do not create collection versions.
- Do not change active metadata.
- Do not invoke collection replacement.
- Add architecture or interaction tests proving zero persistence calls.
  Local temporary files used by a multipart library must follow safe lifecycle and cleanup rules, but must never become active persistence.

## No runtime-state mutation guarantee

Validation-only mode must not alter:

- Active manifest state.
- In-memory collections.
- Cache-refresh metadata.
- Readiness state.
- Collection ETags.
- Query results.
- Existing active collection versions.
  Add tests comparing runtime state before and after successful and failed validation-only requests.

## Request metadata

Where the upload contract includes metadata fields, validate:

- `schemaVersion`
- `version`
- `effectiveFrom`
- `description`
  Requirements:

- File-envelope values and multipart metadata must agree where both are supplied.
- Do not silently prefer conflicting metadata.
- Reject a conflict using a stable validation issue.
- Bound description length.
- Do not treat description as executable or trusted content.
- Do not require storage-only metadata that is irrelevant to validation.
- Do not generate an upload version automatically.
- Do not check whether a version already exists in persistence during validation-only mode unless the approved API contract explicitly requires that check.
  Preferred behaviour is to avoid S3-dependent conflict checks in validation-only mode.

## Correlation and logging

Use common API behaviour from Step 13.

Safe logs may include:

- Correlation ID
- Route identifier
- Dataset
- Validation-only mode
- File size
- Declared media type
- Collection version when structurally valid
- Received item or feature count
- Error count
- Warning count
- Whether issue output was truncated
- Validation duration
- Response status
  Do not log:

- File contents
- Complete records
- Complete GeoJSON geometry
- Original filenames when they may contain sensitive information, unless safely sanitised
- Credentials
- Tokens
- Full vessel identifiers
- Raw multipart bodies
- Unsafe rejected values
- Stack traces for expected validation failures

## Audit behaviour

Validation-only mode is a protected administrative action even though it does not change active data.

Use existing audit conventions where available.

A safe audit event may include:

- Action: validate reference-data collection
- Dataset
- Authenticated actor identifier according to policy
- Correlation ID
- Collection version when valid
- Result
- Error count
- Warning count
- Timestamp
- Duration
  Do not audit complete uploaded content.

If formal audit-event implementation belongs to a later observability step, preserve an explicit hook and document the deferral.

## Metrics

Use existing metrics hooks where available.

Prepare or emit bounded metrics equivalent to:

Plain Text

```text
reference_data_validation_upload_requests_total
reference_data_validation_upload_duration
reference_data_validation_upload_failures_total
reference_data_validation_upload_warnings_total
reference_data_validation_upload_size_bytes
```

Acceptable bounded labels include:

- Dataset
- Result
- Failure stage
- Status code
  Do not use:

- Collection GUID
- Correlation ID
- Business identifiers
- Original filename
- Raw error message
  as metric labels.

## Security and privacy requirements

Treat uploads as untrusted input.

Requirements:

- Require write authorisation.
- Enforce upload-size limits before unbounded buffering.
- Accept exactly one file.
- Reject unsupported media types.
- Do not execute uploaded content.
- Do not trust filenames.
- Do not use filenames as object paths.
- Do not permit path traversal.
- Do not dynamically import validators based on untrusted values.
- Use the central dataset registry.
- Defend against prototype pollution.
- Bound nested processing.
- Bound validation issues and warnings.
- Avoid catastrophic regular expressions.
- Do not log full uploads.
- Do not expose stack traces.
- Do not expose raw dependency errors.
- Do not persist temporary files longer than required.
- Clean up temporary files following success, validation failure, timeout, and unexpected failure.
- Do not include production personal data in test fixtures.
- Review any multipart dependency for maintenance, security, and licensing.
- Preserve no-store cache behaviour.
- Do not enable wildcard CORS.
- Do not weaken authentication for local development.

## Performance requirements

The endpoint validates complete collections, so processing must be bounded and observable.

Requirements:

- Parse only once where practical.
- Avoid unnecessary deep clones.
- Preserve input immutability.
- Use linear duplicate detection.
- Reuse relationship indexes.
- Avoid repeated complete scans.
- Bound error and warning collection.
- Do not serialise the complete normalised collection into the response.
- Do not calculate persistence checksums unless required by the approved validation response.
- Do not access S3.
- Do not trigger cache refresh.
- Avoid blocking the event loop with unnecessary synchronous operations for very large files.
- Respect request and processing timeouts.
- Record processing duration.
- Document expected file-size limits.
  If streaming structural validation is not already supported, do not introduce it without clear repository evidence that buffered processing within configured limits is insufficient.

## Timeout and cancellation

Use existing request and application timeout conventions.

Requirements:

- A timed-out validation must not persist or publish anything.
- Temporary resources must be cleaned up.
- Do not continue expensive work after a request is known to be cancelled where the framework supports cancellation.
- Return the approved timeout error without exposing internals.
- Keep timeout tests deterministic.
- Do not introduce uncontrolled retries.

## Unit test requirements

Add comprehensive Docker-free tests.

### Route and request validation

Test:

- Supported dataset
- Unsupported dataset
- Derived `map-ports`
- `validateOnly=true`
- Missing `validateOnly`
- `validateOnly=false`
- Invalid boolean representation
- Missing file
- Empty file
- Multiple files
- Unsupported media type
- Oversized file
- Invalid correlation ID policy
- Unknown query parameter policy

### Parsing

Test:

- Valid JSON
- Valid GeoJSON
- Malformed JSON
- Non-object root
- Empty content
- Prototype-pollution payload
- Excessive nesting according to configured policy
- Parser does not mutate source buffers or parsed values

### Pipeline order

Test:

- Parsing before structural validation
- Structural validation before normalisation
- Normalisation before business validation
- Structural failure prevents normalisation
- Normalisation failure prevents business validation
- Business validation receives normalised data
- Warnings remain separate from errors
- Successful result contains expected summary

### Dataset validation

Test validation-only mode for:

- Vessels
- Gears
- Ports
- Species
- Map land
- Map statistical areas
- Rejected map ports
  Use both valid and targeted invalid fixtures.

### Success response

Test:

- `200`
- `valid: true`
- Dataset
- Schema version
- Collection version
- Received count
- Normalised count
- `changed`
- Empty warnings
- Multiple warnings
- Deterministic warning order
- No complete collection returned
- No active-state implication
- Correlation header
- `Cache-Control: no-store`
- JSON content type

### Validation failures

Test:

- Common structural failure
- Dataset structural failure
- Duplicate GUID
- Duplicate business code
- Item-count mismatch
- Invalid date range
- Unresolved gear category
- Unresolved gear characteristic
- Invalid gear data type
- Invalid vessel-length applicability
- Invalid port coordinates
- Species nested-name GUID duplication
- Duplicate FAO code
- Duplicate statistical-area code
- Multiple issues
- Deterministic issue ordering
- Issue-count truncation
- Safe detail redaction
- `422` response
- No warnings incorrectly represented as errors

### Metadata conflicts

Where metadata fields are used, test:

- Matching schema version
- Conflicting schema version
- Matching collection version
- Conflicting collection version
- Valid effective date
- Invalid effective date
- Description length
- Metadata omitted where optional

### Architecture boundaries

Verify:

- No Persistence Module method is called.
- No S3 client is referenced.
- No Floci call occurs.
- No active manifest update occurs.
- No in-memory collection replacement occurs.
- No cache refresh occurs.
- No readiness change occurs.
- No item GUID is generated.
- Authentication Service is not called outside the Validation Module.
- No Redis dependency is introduced.

### State safety

Test:

- Active state unchanged after successful validation.
- Active state unchanged after structural failure.
- Active state unchanged after normalisation failure.
- Active state unchanged after business-validation failure.
- Active state unchanged after unexpected failure.
- Active state unchanged after timeout.
- Existing query results remain unchanged.

### Temporary-resource safety

Where temporary files are used, test cleanup after:

- Success
- Parsing failure
- Validation failure
- Unexpected failure
- Timeout or cancellation

## Integration test requirements

Use Hapi.js `server.inject` or the repository's established Docker-free HTTP integration approach.

Verify:

1. Validation-only route registration.
2. Valid vessel collection.
3. Valid gear collection.
4. Valid port collection.
5. Valid species collection.
6. Valid map-land collection.
7. Valid map-statistical-areas collection.
8. Rejected `map-ports` .
9. Missing file.
10. Malformed JSON.
11. Unsupported media type.
12. Oversized upload.
13. Dataset mismatch.
14. Structural validation failure.
15. Business-validation failure.
16. Normalisation warnings.
17. Multiple validation details.
18. Correlation behaviour.
19. Authentication failure.
20. Authorisation failure.
21. No-store response.
22. Standard error envelope.
23. Safe unexpected `500` .
24. No persistence calls.
25. No in-memory changes.
26. No refresh invocation.
27. Existing read APIs return the same active data after validation.
28. Normal tests remain Docker-free.
    Do not require Floci for validation-only tests because no persistence operation is allowed.

## Regression test requirements

Run existing tests for:

- Structural validation
- Business validation
- Canonical normalisation
- Common API behaviour
- Authentication boundary
- Manifest API
- Shared query engine
- Vessel read API
- Gear read API
- Port read API
- Species read API
- Map-location read API
- In-Memory Data Store
- Cache Refresh Module
- Startup hydration
- Persistence
- Health and readiness
  Explicitly confirm:

- Read APIs remain unchanged after a validation-only request.
- Manifest ETags remain unchanged.
- Collection ETags remain unchanged.
- Persistence methods are never invoked.
- Cache state remains unchanged.
- Validation and normalisation remain deterministic.
- Normal tests remain Docker-free.
- Floci tests remain separate.
- Existing specific S3 error mapping remains unchanged.

## OpenAPI documentation

If the repository contains OpenAPI, document:

HTTP

```text
PUT /api/v1/reference-data/{dataset}?validateOnly=true
```

Include:

- Dataset path parameter
- `validateOnly` query parameter
- Authentication requirement
- Required permission
- Correlation header
- Supported media type
- Multipart fields where applicable
- Maximum file-size behaviour
- JSON and GeoJSON upload expectations
- Successful validation response
- Normalisation warnings
- Standard error envelope
- `200`
- `400`
- `401`
- `403`
- `413`
- `415`
- `422`
- `500`
  Clearly state:

- Validation-only mode does not save the file.
- Validation-only mode does not activate the collection.
- Validation-only mode does not modify active reference data.
- `map-ports` cannot be uploaded.
  Do not document real replacement as implemented by this step.

## Documentation requirements

Update repository documentation with:

- Purpose of validation-only mode
- Supported datasets
- Unsupported derived datasets
- Route and request format
- Authentication and permission
- Upload size limit
- Supported media types
- Parsing behaviour
- Structural validation
- Canonical normalisation
- Business validation
- Stage order
- Warning behaviour
- Error behaviour
- Success response
- Validation-failure response
- No-persistence guarantee
- No-runtime-state-change guarantee
- Temporary-file handling
- Security considerations
- Performance considerations
- Testing commands
- Work deferred to the complete replacement step
  Include concise valid and invalid examples.

## Explicit exclusions

Do not implement:

- Real full collection replacement
- S3 collection writes
- Active manifest writes
- Collection activation
- Rollback orchestration
- Orphan-object cleanup
- Cache refresh after upload
- In-memory replacement
- Item-level create, update, patch, or delete
- `map-ports` uploads
- CSV uploads
- YAML uploads
- XML uploads
- ZIP uploads
- Asynchronous job processing
- Virus-scanning infrastructure unless already approved
- Production deployment changes
- API Gateway changes
- Fargate changes
- IAM changes
- Redis
- Direct Authentication Service calls outside the Validation Module
- Returning the complete normalised collection by default

## Required plan content

The GitHub-generated plan must include:

1. Current upload-related repository structure.
2. Current route and controller conventions.
3. Current Command Module structure.
4. Current validation entry points.
5. Current normalisation entry points.
6. Current authentication and authorisation integration.
7. Current API error behaviour.
8. Current request and payload limits.
9. Existing multipart or body-parsing dependencies.
10. Existing temporary-file behaviour.
11. Existing tests and OpenAPI structure.
12. Existing conventions to retain.
13. Gaps against Step 21.
14. Proposed route registration.
15. Proposed `validateOnly` behaviour.
16. Proposed request format.
17. Proposed media-type handling.
18. Proposed upload-size policy.
19. Proposed parsing boundary.
20. Proposed Command Module use case.
21. Proposed pipeline stage order.
22. Proposed success response.
23. Proposed validation-error response.
24. Proposed warning handling.
25. Proposed metadata-conflict handling.
26. Proposed no-persistence safeguards.
27. Proposed no-runtime-state-mutation safeguards.
28. Proposed temporary-resource cleanup.
29. Proposed authentication and permission enforcement.
30. Proposed logging, audit, and metrics.
31. Exact files to create.
32. Exact files to modify.
33. Files intentionally left unchanged.
34. Unit-test approach.
35. Hapi.js integration-test approach.
36. Regression-test approach.
37. OpenAPI updates.
38. Documentation updates.
39. Security and privacy considerations.
40. Performance considerations.
41. Verification commands.
42. Assumptions and unresolved ambiguities.
43. Work explicitly deferred to the replacement step.

## Expected deliverables

- GitHub-generated plan saved as: Plain Text 1 github-prompts/Step 21-implement-full-collection-upload-validation-mode-plan.md
- Validation-only upload route.
- Dataset path validation.
- Strict `validateOnly` query handling.
- Upload media-type validation.
- Upload size enforcement.
- Safe JSON and GeoJSON parsing.
- Command Module validation-only use case.
- Structural validation integration.
- Canonical normalisation integration.
- Business-validation integration.
- Successful validation summary.
- Normalisation warning response.
- Standard validation-error responses.
- Authentication and write-permission enforcement.
- No-store response behaviour.
- Correlation integration.
- Safe structured logging.
- Audit and metrics hooks where supported.
- No-persistence interaction tests.
- No-runtime-state-mutation tests.
- Temporary-resource cleanup where applicable.
- Docker-free unit tests.
- Docker-free Hapi.js integration tests.
- Regression verification.
- OpenAPI updates where present.
- Developer and consumer documentation.
- Step completion report.

## Acceptance criteria

- The GitHub-generated plan is saved before implementation.
- The saved plan is assumed approved.
- Copilot continues without requesting plan approval.
- Validation-only mode is available through: Plain Text 1 PUT /api/v1/reference-data/{dataset}?validateOnly=true
- Maintained uploadable datasets are supported.
- `map-ports` is rejected as non-uploadable.
- The endpoint requires write permission.
- Read permission alone is insufficient.
- The endpoint accepts exactly one complete collection file.
- File size is bounded.
- Unsupported media types return `415` .
- Oversized uploads return `413` .
- Malformed JSON returns `400` .
- Structurally or semantically invalid collections return `422` .
- Validation errors use the Step 13 standard envelope.
- Successful validation returns `200` .
- Successful responses clearly state `valid: true` .
- Success includes received and normalised counts.
- Success includes safe normalisation warnings.
- Warnings do not make a result invalid.
- Complete canonical data is not returned by default.
- The response does not imply that the collection was activated.
- The response uses `Cache-Control: no-store` .
- The route dataset and declared collection dataset must match.
- Structural validation occurs before normalisation.
- Business validation occurs after normalisation.
- Validation and normalisation remain distinct.
- Valid GUIDs are preserved.
- Invalid or missing GUIDs are not generated or replaced.
- Business identifiers remain separate from GUIDs.
- Leading zeros are preserved.
- Multiple validation errors are returned deterministically.
- Error and warning counts are bounded.
- Unsafe values are redacted.
- No S3 or Floci call occurs.
- No persistence method is invoked.
- No active manifest is changed.
- No in-memory collection is changed.
- No cache refresh is triggered.
- Readiness is unchanged.
- Existing query results remain unchanged.
- Temporary resources are cleaned up.
- Complete uploads are not logged.
- Raw framework and dependency errors are not exposed.
- No item-level mutation endpoint is introduced.
- No Redis dependency is introduced.
- Normal tests remain Docker-free.
- Validation-only tests pass.
- Existing read API tests pass.
- Cache and persistence regression tests pass.
- Type checking passes.
- Linting passes, or pre-existing issues are documented.
- The build passes.
- Documentation matches the implementation.
- Real collection activation remains deferred.

## Verification

Use the repository's actual package manager, module system, scripts, and test configuration.

Run the applicable equivalents of:

Plain Text

```text
install dependencies
run type checking
run linting
run validation-only unit tests
run Command Module tests
run upload request-validation tests
run Hapi.js validation-only integration tests
run structural-validation tests
run business-validation tests
run canonical-normalisation tests
run authentication and authorisation tests
run read API regression tests
run manifest API tests
run In-Memory Data Store tests
run cache-refresh tests
run persistence tests
run the complete Docker-free test suite
run the build
```

Explicitly verify:

Plain Text

```text
plan file saved
supported vessel upload validation
supported gear upload validation
supported port upload validation
supported species upload validation
supported map-land upload validation
supported map-statistical-areas upload validation
map-ports rejected
validateOnly true
validateOnly false behaviour
missing validateOnly behaviour
invalid validateOnly value
missing file
empty file
multiple files
unsupported media type
oversized file
malformed JSON
non-object JSON root
dataset mismatch
unsupported schema version
invalid GUID
duplicate GUID
duplicate business code
item-count mismatch
feature-count mismatch
normalisation warning
normalisation failure
business-validation failure
multiple validation errors
deterministic error ordering
issue-count truncation
safe value redaction
successful validation summary
received and normalised counts
changed flag
no-store header
correlation header
authentication failure
authorisation failure
safe unexpected 500
no stack trace
no raw Joi output
no raw normalisation output
no raw persistence output
no S3 calls
no Floci calls
no active manifest update
no in-memory replacement
no cache refresh
no readiness change
active query results unchanged
temporary-file cleanup
```

Record:

- Exact commands
- Exit codes
- Test counts
- Coverage results
- Type-check result
- Lint result
- Build result
- Regression results
- Pre-existing warnings or failures
- Approved deviations
  If verification reveals a pre-existing issue outside this step:

1. Record the exact failing command.
2. Identify the likely pre-existing cause.
3. Explain whether the issue blocks Step 21.
4. Do not expand scope silently.
5. Do not weaken tests to make them pass.
6. Ask for clarification if resolution requires an upload-contract, schema, authentication, security, or architecture decision.

## Completion response

Provide a concise implementation report containing:

- Repository state discovered
- Saved plan filename
- Validation-only route implemented
- Supported datasets
- Rejected derived datasets
- Request format
- File-size and media-type behaviour
- Authentication and permission enforcement
- Parsing behaviour
- Validation and normalisation pipeline
- Success-response contract
- Warning behaviour
- Error-response behaviour
- No-persistence verification
- No-runtime-state-change verification
- Temporary-resource cleanup
- Files created
- Files modified
- Files intentionally left unchanged
- Tests added
- Exact verification commands and results
- Coverage results
- Regression results
- Security and privacy controls
- Performance safeguards
- Approved deviations
- Existing issues not introduced by Step 21
- Work deferred to complete collection replacement
- Remaining assumptions, risks, or owner decisions
  if you reach any ambiguity ask me to clarify
