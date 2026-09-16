# Step 07: Implement the Persistence Module

## Recommended reasoning effort

- Planning phase: High
- Implementation phase: High

## Role

Act as a senior Node.js backend engineer implementing the Reference Data Service for the Catch Recording application.

Implement the Persistence Module exactly as defined by Step 07 of the approved Reference Data Service implementation plan.

Do not change, reorder, expand, or reinterpret the approved implementation plan.

## Approved objective

Implement the only component allowed to communicate with S3-compatible storage.

## Required working mode

Start in Plan mode.

Before proposing changes:

1. Inspect the complete repository.
2. Read the approved Reference Data Service implementation plan.
3. Read the approved plans for Steps 01 through 06.
4. Inspect the implementations completed in Steps 01 through 06.
5. Inspect the Persistence Module boundary established in Step 02.
6. Inspect the shared Reference Data Repository contract created in Step 03.
7. Inspect the following Step 03 contracts:

- Dataset identifiers
- Dataset capabilities
- Collection envelope
- Collection metadata
- Manifest
- Manifest dataset entry
- Service error

8. Inspect the canonical schemas and schema registry created in Step 04.
9. Inspect the In-Memory Data Store implementation from Step 05, but do not couple persistence to its concrete implementation.
10. Inspect the Floci S3 configuration and object-key convention completed in Step 06.
11. Inspect:

- `package.json`
- `compose.yml`
- `compose/aws.env`
- Floci startup scripts
- Application configuration
- Existing AWS SDK dependencies
- Existing test and mocking conventions

12. Confirm the actual AWS SDK for JavaScript version and available S3 commands.
13. Confirm how host and Docker environments provide the S3-compatible endpoint.
14. Review the current working tree:
    Shell

```text
git status --short
git diff --stat
```

1. Identify any mismatch between the Step 03 repository contract, Step 06 object-key convention, and this approved Step 07 scope.
2. Raise any ambiguity before implementation.
   Do not modify files during planning.

Produce a concise, file-by-file implementation plan and wait for approval.

After the plan is approved, the first implementation action must be to save the approved plan as:

Plain Text

```text
github-prompts/Step 07-implement-persistence-module-plan.md
```

Only after saving the approved plan may source-code implementation begin.

## Approved scope

Implement repository operations for:

- Reading a collection object.
- Writing a new versioned collection object.
- Reading the manifest.
- Writing the manifest.
- Retrieving object metadata.
- Checking whether an object exists.
- Calculating or preserving checksums and ETags.
- Mapping AWS SDK errors to service errors.
- Supporting Floci locally and AWS S3 in deployed environments.
  The module must use dependency injection or configurable client construction to remain testable.

Do not expand this scope without explicit approval.

## Architecture context

The Reference Data Service uses:

- AWS S3 as durable storage in deployed environments.
- Floci as the existing local S3-compatible service.
- Process-local JSON objects as the in-memory cache.
- No database.
- No Redis-backed cache.
  The Persistence Module:

- Owns all direct S3-compatible storage interaction.
- Implements the Reference Data Repository contract from Step 03.
- Serialises and deserialises JSON and GeoJSON collection files.
- Reads and writes the active manifest.
- Retrieves object metadata.
- Translates infrastructure failures into service-level errors.
  The Persistence Module must not:

- Contain Hapi route handlers.
- Make authentication decisions.
- Perform dataset-specific business validation.
- Normalise data.
- Update the In-Memory Data Store.
- Implement cache refresh.
- Activate collections as a business workflow.
- Expose AWS SDK types to other components.

## Mandatory architectural constraints

### Exclusive S3 ownership

Only the Persistence Module may:

- Import the AWS S3 SDK.
- Construct an S3 client.
- Send S3 commands.
- Refer directly to bucket operations.
- Translate S3 errors.
- Read S3 object metadata.
  Search the repository after implementation and confirm that no other application component directly imports the S3 SDK.

Tests may import AWS SDK command classes only where required to verify the Persistence Module.

### No database

Do not introduce:

- MongoDB
- Redis
- DynamoDB
- PostgreSQL
- MySQL
- SQLite
- An ORM or ODM
- Database models
- Database migrations
- Database repositories
- Database connections
- Database transactions
  S3-compatible object storage is the only durable persistence mechanism in this design.

### No cache orchestration

Do not:

- Read from the In-Memory Data Store.
- Write to the In-Memory Data Store.
- Trigger cache refresh.
- Hydrate the cache at startup.
- Compare persisted metadata with cached metadata.
  Those behaviours belong to Step 11.

### No collection activation workflow

This step provides persistence operations only.

Do not implement the Step 22 workflow that coordinates:

- Validation
- Normalisation
- Collection writing
- Manifest activation
- In-memory replacement
- Rollback
  The Persistence Module may provide the low-level manifest write operation required by that future workflow, but it must not orchestrate the workflow itself.

## Supported datasets

Use the centrally defined dataset capabilities from Step 03.

Persisted datasets are:

- `vessels`
- `gears`
- `ports`
- `species`
- `map-land`
- `map-statistical-areas`
  `map-ports` is:

- Derived from ports
- Queryable
- Not independently uploadable
- Not independently persisted
- Not assigned an independent collection object
  The Persistence Module must reject an attempt to read or write `map-ports` as an authoritative persisted collection.

Do not create another dataset registry.

## Approved object-key convention

Use the object-key convention established and implemented in Step 06.

The approved plan proposes:

Plain Text

```text
reference-data/manifest.json
reference-data/vessels/{version}.json
reference-data/gears/{version}.json
reference-data/ports/{version}.json
reference-data/species/{version}.json
reference-data/map-land/{version}.json
reference-data/map-statistical-areas/{version}.json
```

Before implementation, verify the exact convention completed in Step 06.

If Step 06 deliberately established a materially different convention:

1. Stop.
2. Explain the difference.
3. Identify which approved decision created it.
4. Ask for clarification before changing either implementation.
   Centralise object-key construction inside the Persistence Module.

Do not allow arbitrary caller-supplied object keys for standard collection operations.

Validate or safely encode collection versions before including them in object keys. Reject values that could introduce:

- Parent traversal
- Leading separators
- Backslashes
- Control characters
- Query strings
- URL-like content
- Unexpected S3 prefixes
  Do not reinterpret valid approved collection versions without agreement.

## Configuration requirements

Use the configuration established in Step 02.

Expected configuration includes:

Plain Text

```text
AWS_REGION
AWS_DEFAULT_REGION
AWS_ENDPOINT_URL
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
REFERENCE_DATA_BUCKET
S3_FORCE_PATH_STYLE
```

Follow the actual configuration object and naming implemented in Step 02.

### Local host execution

When the service runs directly on the host, Floci is expected to be available through a configured endpoint such as:

Plain Text

```text
http://localhost:4566
```

### Docker Compose execution

When the service runs inside Docker Compose, Floci is expected to be available through its Docker-network hostname, such as:

Plain Text

```text
http://floci:4566
```

Do not hard-code either endpoint.

### Deployed AWS environments

When no custom endpoint is configured:

- Allow the AWS SDK to use the normal AWS S3 endpoint.
- Allow the AWS SDK default credential provider chain to resolve credentials.
- Do not require static credentials in application source or deployed configuration.
- Do not force path-style access unless configured.
  Do not log credentials or complete configuration objects.

## Implementation requirements

### 1. Implement the existing repository contract

Implement the Reference Data Repository contract from Step 03.

Do not create a competing repository interface.

If the contract cannot support an approved Step 07 operation:

1. Stop before changing the contract.
2. Identify the exact mismatch.
3. Propose the smallest compatible correction.
4. Explain the effect on existing consumers and tests.
5. Wait for approval.
   Do not silently redesign the contract.

### 2. S3 client construction

Implement testable S3 client construction.

The design should support:

- Region configuration.
- Optional endpoint override.
- Configurable path-style access.
- Default AWS credential provider behaviour.
- Dependency injection of a test S3 client.
- Reuse of one client rather than constructing one for every operation.
  Do not expose the concrete S3 client outside the Persistence Module.

Do not make network calls during module import.

### 3. Read a collection object

Implement collection reading for a persisted dataset and collection version or approved internal object reference.

The operation must:

1. Validate that the dataset is persisted.
2. Resolve the deterministic object key.
3. Retrieve the object through S3.
4. Read the complete response body safely.
5. Parse JSON.
6. Return domain-compatible collection information.
7. Preserve relevant S3 metadata separately.
8. Translate missing-object and infrastructure failures.
   Support both:

- JSON reference-data collections.
- GeoJSON reference-data collections.
  Do not:

- Run dataset business validation.
- Normalise the collection.
- Modify the collection.
- Add generated GUIDs.
- Put the collection into memory.
- Return an AWS SDK response object to the caller.

### 4. Write a versioned collection object

Implement writing a new immutable versioned collection object.

The operation must:

1. Validate that the dataset is persisted and uploadable.
2. Reject `map-ports` .
3. Build the deterministic object key.
4. Serialise the supplied canonical collection as JSON.
5. Select the appropriate content type.
6. Calculate or accept the approved checksum semantics.
7. Send the object through S3.
8. Return domain-compatible metadata.
   Use content types appropriate to the data:

Plain Text

```text
application/json
application/geo+json
```

Do not:

- Overwrite an existing version silently.
- Activate the collection in the manifest.
- Update the In-Memory Data Store.
- Perform validation or normalisation.
- Generate a collection version.
- Generate replacement item GUIDs.
- Log the complete collection.
  Use an existence or conditional-write strategy consistent with real S3 and supported by Floci.

If Floci differs from AWS S3 for a required conditional operation, document the limitation and choose the smallest safe compatible approach. Do not weaken production safety silently.

### 5. Read the active manifest

Implement reading:

Plain Text

```text
reference-data/manifest.json
```

The operation must:

- Retrieve the manifest through S3.
- Parse the JSON body.
- Return a domain-compatible manifest.
- Return or preserve relevant object metadata separately.
- Translate a missing manifest into the approved service error.
- Avoid validating cross-collection relationships.
  Do not automatically read all collections referenced by the manifest.

### 6. Write the active manifest

Implement writing or replacing the active manifest at the approved manifest key.

Support optimistic concurrency when required by the Step 03 contract.

This may include use of:

- Expected ETag
- Conditional request headers
- Another approved S3-compatible concurrency mechanism
  The operation must:

- Serialise the complete manifest deterministically.
- Use `application/json` .
- Return domain-compatible metadata.
- Translate stale-condition failures into the approved service error.
- Avoid performing collection activation orchestration outside the write itself.
  Do not implement rollback or multi-stage replacement workflow in this step.

### 7. Retrieve object metadata

Implement metadata retrieval without downloading and parsing the complete object where S3 allows it.

The operation should expose domain-compatible values such as:

- ETag
- Last-modified timestamp
- Content length
- Content type
- Checksum values when available
- Version identifier when available and relevant
- Internal object key where allowed by the repository contract
  Do not expose raw AWS SDK metadata structures.

Do not assume ETag is always a content MD5 checksum.

### 8. Check object existence

Implement an existence check for an approved collection or manifest object.

The operation must distinguish:

- Object exists
- Object does not exist
- Access denied
- Storage unavailable
- Invalid request
  Do not translate all S3 failures into `false` .

Only a confirmed not-found condition should return the not-found result defined by the repository contract.

### 9. Checksums and ETags

Implement checksum and ETag behaviour consistent with the approved contracts.

Requirements:

- Calculate a deterministic content checksum when required.
- Preserve S3 ETag separately.
- Do not assume an S3 ETag is always the content checksum.
- Use a stable checksum algorithm already approved by the design or repository.
- Prefer SHA-256 when no different algorithm has been approved.
- Keep checksum calculation inside the Persistence Module or an injected internal utility owned by that boundary.
- Return checksum information through domain metadata rather than AWS response objects.
  Ensure tests use deterministic input serialisation.

If canonical JSON serialisation order affects checksums, document and implement the selected deterministic serialisation strategy.

Do not add normalisation behaviour merely to stabilise checksums.

### 10. Body handling

Support the actual body type returned by AWS SDK v3 in Node.js.

Handle body transformation safely and explicitly.

Requirements:

- Detect a missing body.
- Avoid unbounded diagnostic logging.
- Parse UTF-8 JSON.
- Distinguish malformed JSON from storage unavailability.
- Avoid evaluating content as executable code.
- Preserve GeoJSON as JSON objects.
- Avoid silently returning raw strings where the repository contract expects parsed data.
  Do not add support for YAML in this step unless the approved plan is explicitly changed.

### 11. Error translation

Map infrastructure errors into the existing Step 03 service-error model.

At minimum, support deterministic mappings for:

- Object not found
- Manifest not found
- Access denied
- Invalid credentials
- Invalid bucket or endpoint
- Conditional write conflict
- Existing collection version
- Malformed stored JSON
- Missing response body
- Timeout
- Connection refusal
- Throttling
- General reference store unavailability
- Invalid persisted dataset
- Attempt to persist `map-ports`
  Use existing service error codes where available, including relevant categories such as:

Plain Text

```text
dataset_not_found
collection_version_exists
collection_modified
invalid_json
reference_store_unavailable
reference_data_unavailable
invalid_dataset
```

Do not expose:

- Stack traces
- AWS credentials
- Authentication headers
- Complete object bodies
- Complete AWS SDK responses
- Internal endpoint details in public-safe messages
  Preserve the original cause for controlled internal diagnostics where supported by the service-error contract.

### 12. Dependency injection and testability

Allow unit tests to provide a fake or mocked S3 client.

Tests must not require:

- AWS account access
- Real AWS credentials
- Docker
- Floci
- A database
- Redis
- Authentication Service
  The S3 client test double must verify commands and parameters without leaking AWS types into the public repository contract.

### 13. Serialisation

Use deterministic and valid JSON serialisation.

Requirements:

- Do not mutate the supplied collection or manifest.
- Reject unsupported non-JSON values safely.
- Preserve numeric values.
- Preserve GUID and business-code strings.
- Preserve array order unless an earlier approved step explicitly guarantees order independence.
- Do not add schema defaults.
- Do not normalise field values.
- Avoid pretty-printing if it changes established checksum expectations unless the formatting convention is explicitly documented.

### 14. Logging boundaries

Use existing logging conventions only where appropriate.

Do not log:

- Complete collections
- Complete manifests
- Object bodies
- Credentials
- Secret access keys
- Access tokens
- Raw AWS request configuration
  Safe operational logging may include:

- Dataset
- Collection version
- Operation name
- Object key if approved for internal logs
- Duration
- Content length
- Success or failure category
- Correlation identifier when supplied through the contract
  Detailed logging and metrics remain primarily assigned to Step 25.

## Unit testing requirements

Testing is part of Step 07 and must be completed in this step.

Use the repository’s current test framework and conventions.

### S3 client configuration tests

Verify:

1. Region is passed correctly.
2. Local endpoint is used when configured.
3. Custom endpoint is omitted in deployed AWS configuration.
4. Path-style access follows configuration.
5. Static credentials are not embedded in source.
6. An injected S3 client can be used.
7. Client construction performs no network call.

### Object-key tests

Verify:

1. Each persisted dataset resolves to the approved prefix.
2. Collection versions resolve to deterministic keys.
3. The manifest resolves to the approved manifest key.
4. `map-ports` is rejected.
5. Unsupported datasets are rejected.
6. Unsafe version or key components are rejected.
7. No caller can escape the approved reference-data prefix.

### Read collection tests

Verify:

1. A JSON collection is retrieved and parsed.
2. A GeoJSON collection is retrieved and parsed.
3. Relevant metadata is mapped to domain metadata.
4. Missing objects map to the expected error.
5. Missing response bodies map to the expected error.
6. Malformed JSON maps to the expected error.
7. Access-denied errors are mapped safely.
8. Connection failures map to store-unavailable errors.
9. AWS SDK response objects do not escape the module.
10. Returned data preserves GUIDs, business codes, arrays, and numeric values.

### Write collection tests

Verify:

1. JSON collections use `application/json` .
2. GeoJSON collections use `application/geo+json` .
3. The correct bucket and object key are used.
4. The complete canonical collection is serialised.
5. Input objects are not mutated.
6. Checksum metadata is returned as defined.
7. S3 ETag is preserved separately from the checksum.
8. Existing versions produce the expected conflict.
9. `map-ports` cannot be written.
10. Unsupported datasets are rejected.
11. Failed writes produce safe service errors.
12. Complete collection contents are not included in errors or logs.

### Manifest tests

Verify:

1. The manifest is read from the approved key.
2. The manifest is parsed correctly.
3. A missing manifest maps to the expected error.
4. Malformed manifest JSON maps to the expected error.
5. The manifest is written to the approved key.
6. Manifest writes use `application/json` .
7. Expected ETag concurrency information is passed correctly.
8. Conditional write failures map to `collection_modified` or the approved equivalent.
9. Manifest input is not mutated.
10. Manifest write does not automatically load or write referenced collections.

### Metadata tests

Verify:

1. Metadata can be retrieved without a full collection read.
2. ETag is mapped correctly.
3. Last-modified timestamp is mapped correctly.
4. Size is mapped correctly.
5. Content type is mapped correctly.
6. Available checksum metadata is mapped correctly.
7. Not-found and unavailable conditions remain distinguishable.

### Existence tests

Verify:

1. Existing object returns the approved existence result.
2. Confirmed not-found returns the approved absent result.
3. Access denied is not reported as absent.
4. Connection failure is not reported as absent.
5. Unsupported datasets are rejected.
6. `map-ports` is rejected as independently persisted data.

### Checksum and serialisation tests

Verify:

1. Identical content produces the same checksum.
2. Different content produces a different checksum.
3. S3 ETag is not treated as guaranteed content checksum.
4. JSON round trips preserve the approved data.
5. Non-JSON-compatible input fails safely.
6. Serialisation does not mutate input.
7. Existing GUIDs remain unchanged.
8. Business identifiers remain unchanged.

### Error-safety tests

Verify:

1. Public-safe service errors do not contain credentials.
2. Errors do not contain complete object bodies.
3. Errors do not contain complete AWS SDK responses.
4. Internal causes remain available only through the approved internal mechanism.
5. S3-specific implementation details do not escape the repository contract.

### Architecture-boundary test

Add or update an architecture test confirming that production imports of the AWS S3 SDK are confined to the Persistence Module.

Follow existing repository conventions for architecture tests.

Do not create a fragile test that prevents legitimate SDK use in Persistence Module unit tests.

## Floci integration testing requirements

Step 07 explicitly includes integration tests against Floci.

Use the Floci resources configured in Step 06.

Integration tests must verify the Persistence Module against the S3-compatible endpoint.

At minimum, verify:

1. The configured bucket is accessible.
2. A versioned JSON collection can be written.
3. The written collection can be read and parsed.
4. Object metadata can be retrieved.
5. Object existence can be checked.
6. A manifest can be written.
7. The manifest can be read.
8. A missing object is handled correctly.
9. An existing collection version is not silently overwritten.
10. JSON and GeoJSON content types are preserved where supported.
11. Test objects are isolated or cleaned up.
12. Tests do not depend on production AWS credentials.
    Use a distinct test prefix if necessary to prevent collisions with development data, while retaining the production object-key logic under test.

Do not defer these tests to Step 27. Step 27 will consolidate and complete integration coverage later.

If Floci does not support a specific AWS S3 feature required by the design:

1. Capture the exact command and error.
2. Confirm AWS S3 support through the SDK contract or existing project documentation.
3. Do not remove the production safety behaviour silently.
4. Isolate the Floci compatibility path if possible.
5. Document the limitation.
6. Ask for clarification if the limitation requires an architectural change.

## SonarCloud considerations

Avoid introducing:

- Magic numbers in executable logic.
- Hardcoded credentials or endpoints.
- Duplicate object-key logic.
- Excessive cognitive complexity.
- Broad catch blocks that discard causes.
- Unsafe dynamic object keys.
- Unhandled promise rejections.
- Mutable shared singleton state.
- Large fixture objects inside JavaScript where JSON fixtures are more appropriate.
  Use named constants for:

- Manifest key
- Reference-data prefix
- Content types
- Approved checksum algorithm
- Safe size or stream limits where required
  Use JSON fixture files for declarative collection and manifest data when consistent with the repository’s established fixture conventions.

Do not disable SonarCloud rules globally.

## Documentation requirements

Update focused documentation with:

- Persistence Module purpose.
- Exclusive S3 ownership rule.
- Local Floci configuration.
- Deployed AWS S3 behaviour.
- Bucket configuration.
- Object-key convention.
- JSON and GeoJSON content types.
- Checksum and ETag distinction.
- Error translation.
- Test execution.
- Floci integration-test prerequisites.
- Confirmation that no database or Redis is used.
  Do not duplicate the full API design or implementation plan.

## Security and privacy considerations

- Never log AWS credentials.
- Never hard-code production credentials.
- Never log complete reference-data collections.
- Never expose raw S3 responses through domain contracts.
- Restrict object keys to the approved prefix.
- Reject unsafe key components.
- Do not allow arbitrary bucket names from request data.
- Use the configured bucket only.
- Do not treat access-denied responses as not-found results.
- Do not expose endpoint or bucket details in public-safe errors unnecessarily.
- Preserve original causes only for controlled internal diagnostics.
- Keep future IAM least-privilege requirements documented.
- Use synthetic test data only.
- Do not include real personal, vessel-owner, or security-sensitive information in fixtures.

## In scope

- AWS SDK S3 client configuration inside the Persistence Module
- Reference Data Repository implementation
- Collection object reading
- Versioned collection-object writing
- Manifest reading
- Manifest writing
- Object metadata retrieval
- Object existence checks
- Checksum calculation or preservation
- ETag preservation
- JSON serialisation and deserialisation
- GeoJSON serialisation and deserialisation
- AWS SDK error translation
- Unit tests with mocked or fake S3 clients
- Integration tests against the existing Floci service
- Architecture-boundary verification
- Focused persistence documentation

## Out of scope

Do not implement:

- Changes to the approved plan
- Any database or database abstraction
- MongoDB
- Redis
- DynamoDB
- SQL persistence
- In-Memory Data Store changes unrelated to contract compatibility
- Startup hydration
- Cache refresh
- Cache scheduling
- Dataset-specific business validation
- Common business validation
- Data normalisation
- Mobile projection
- Authentication Service integration
- Authorisation
- Hapi routes
- API handlers
- Querying or filtering
- Manifest API endpoint
- Upload API
- Multipart parsing
- Collection activation orchestration
- Rollback workflow
- Seed reference data
- API acceptance tests
- OpenAPI definitions
- Deployment infrastructure
- Production IAM provisioning

## Expected deliverables

The approved Step 07 deliverables are:

1. AWS SDK S3 client configuration.
2. S3 repository implementation.
3. Object serialisation and deserialisation.
4. Error translation.
5. Unit tests with mocked SDK responses.
6. Integration tests against Floci.
   Also produce:

7. Approved implementation plan saved at:
   Plain Text

```text
github-prompts/Step 07-implement-persistence-module-plan.md
```

1. Architecture-boundary verification.
2. Focused persistence documentation.

## Approved completion criteria

The step must satisfy the completion criteria from the approved implementation plan:

- The module reads and writes JSON through the S3 API.
- No other module imports or uses the AWS S3 SDK.
- Local implementation works against Floci.
- Deployed configuration can omit the endpoint and use AWS S3.
- Missing objects, access failures, malformed JSON, and unavailable storage produce predictable errors.
  The implementation must also demonstrate:

- JSON and GeoJSON collections use appropriate content types.
- `map-ports` cannot be persisted independently.
- Object keys follow the approved convention.
- Collection versions are not silently overwritten.
- ETags and content checksums remain conceptually separate.
- AWS SDK types do not leak through the repository contract.
- No collection, manifest, cache, or API business workflow is implemented.
- Required unit and Floci integration tests pass.

## Verification

Inspect `package.json` and use the repository’s actual commands.

Run the appropriate equivalents of:

Shell

```text
npm test -- <persistence-unit-tests>
npm test
npm run test:coverage
npm run lint
npm run format:check
docker compose up -d floci
npm run <floci-integration-test-script>
```

Use the actual integration-test command defined by the repository.

If no suitable integration-test script exists, add the smallest clearly named script consistent with repository conventions and document it in the approved plan.

Verify Floci health before running integration tests.

After testing, avoid leaving unintended test data or containers running. Follow the repository’s cleanup convention.

Format every source, test, fixture, and documentation file created or modified by this step.

If repository-wide format checks report unrelated generated artifacts:

1. Confirm that all Step 07 files pass Prettier.
2. Do not reformat unrelated generated conversation or metadata files.
3. Report remaining warnings accurately.
4. Do not claim that the repository-wide formatting check passed if it failed.
   If a pre-existing failure occurs:

5. Record the exact command.
6. Record the relevant output.
7. Determine whether Step 07 caused the failure.
8. Fix failures introduced by Step 07.
9. Do not broaden scope silently.
10. Ask for clarification if the resolution requires unrelated work.

## Final response requirements

After implementation, report:

1. Summary of completed work.
2. Saved plan-file path.
3. Files created.
4. Files modified.
5. S3 client-construction approach.
6. Dependency-injection approach.
7. Object-key convention implemented.
8. Collection read and write behaviour.
9. Manifest read and write behaviour.
10. Metadata and existence-check behaviour.
11. Checksum and ETag approach.
12. Error mappings implemented.
13. Unit tests added and results.
14. Floci integration tests added and results.
15. Architecture-boundary verification result.
16. Complete test-suite result.
17. Coverage result.
18. Linting result.
19. Formatting result.
20. Any Floci compatibility limitations.
21. Confirmation that no database or Redis functionality was introduced.
22. Confirmation that no AWS S3 SDK usage was added outside the Persistence Module.
23. Confirmation that no cache, validation, normalisation, authentication, query, API, upload, or activation workflow was implemented.
24. Work deferred to later approved steps.
25. Remaining assumptions, risks, or owner decisions.
    Do not modify the approved implementation plan.

If you reach any ambiguity, ask me to clarify.
