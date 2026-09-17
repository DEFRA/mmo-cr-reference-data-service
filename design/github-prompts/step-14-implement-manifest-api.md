# Step 14: Implement the Manifest API

## Recommended reasoning effort

- **Planning phase:** High
- **Implementation phase:** High

## Copilot operating mode

Start in **Plan mode** .

Before changing any source file:

1. Inspect the complete repository.
2. Read the approved Reference Data Service design and API design.
3. Read the master implementation plan.
4. Read the approved plans and completion summaries from all completed steps.
5. Inspect the existing Hapi.js application, Reference Data Controller, Query Module, In-Memory Data Store, Cache Refresh Module, Persistence Module, validation, common API behaviour, error handling, configuration, tests, and documentation.
6. Identify existing manifest contracts, schemas, routes, response helpers, ETag utilities, and conditional-request handling.
7. Produce a repository-specific implementation plan based on the code that actually exists.
   Do not assume the repository is empty.

Do not duplicate suitable existing behaviour.

After producing the plan, save it as:

Plain Text

```text
github-prompts/Step 14-implement-manifest-api-plan.md
```

The saved GitHub-generated plan must be treated as **already approved** .

After saving the plan, continue directly with implementation without requesting further approval unless:

- The implementation conflicts with the approved Reference Data Service design.
- A required upstream contract is missing.
- A public API contract is ambiguous.
- A destructive or incompatible repository change is required.
- A security or privacy decision requires owner input.
- An unresolved issue would materially affect consumer behaviour.
  The approved plan must be saved before implementation begins.

## Objective

Implement the public Manifest API for the Reference Data Service.

The endpoint must allow consumers, particularly the Catch Recording mobile client, to determine:

- Which reference-data collections are currently active.
- The active version of each collection.
- Whether a locally cached collection has changed.
- Which collection endpoint should be used.
- Whether a collection contains JSON or GeoJSON.
- The number and size of collection records or features, where metadata is available.
- When a collection was last modified.
- Whether a previously retrieved manifest remains current through ETag-based conditional requests.
  Implement:

HTTP

```text
GET /api/v1/reference-data/manifest
```

Support optional filtering:

HTTP

```text
GET /api/v1/reference-data/manifest?include=vessels,ports,species
```

The endpoint must read manifest information from the active process-local state established by startup hydration and cache refresh.

The endpoint must not read S3 directly for each request.

## Project context

The Reference Data Service manages these maintained reference-data domains:

- Vessels
- Gears
- Ports
- Species
- Map land
- Map statistical areas
  The service also exposes a derived map-port projection from the active ports collection.

Reference data is persisted as complete JSON or GeoJSON files in S3 and loaded into process-local memory during startup hydration.

The Cache Refresh Module periodically checks the persisted active manifest and refreshes changed collections.

The Manifest API supports an offline-first mobile workflow in which clients compare collection versions or ETags before downloading reference data again.

## Architectural boundaries

Preserve these component responsibilities:

1. The **Reference Data Controller** owns Hapi.js request and response mapping.
2. The **Query Module** owns the manifest retrieval use case.
3. The **In-Memory Data Store** provides active collection and manifest metadata.
4. The **Cache Refresh Module** updates process-local manifest and collection state.
5. The **Persistence Module is the only application component permitted to access S3 or Floci** .
6. The manifest route, controller, and Query Module must not access S3 directly.
7. The Validation Module owns request validation.
8. The Validation Module is the only component permitted to call the Authentication Service.
9. The Data Normalisation Module must not create API manifest responses.
10. Common API behaviour from Step 13 must own correlation, standard error mapping, ETag handling, and common response headers where already implemented.
11. Redis or another external cache must not be introduced.
12. The public manifest must not expose internal persistence implementation details.

## Existing decisions to preserve

Preserve all approved repository decisions, including:

- GUIDs are stable technical identifiers.
- Business identifiers remain separate from GUIDs.
- The active manifest is the persistent source of truth.
- The in-memory state is the runtime source used by query APIs.
- Each service instance hydrates and refreshes its own process-local data.
- Unchanged collections are not downloaded during refresh.
- Invalid refreshed collections do not replace previously valid collections.
- `map-ports` is derived from ports and is not independently uploaded.
- Normal `npm test` remains Docker-free.
- Floci integration tests remain under the separate existing test command.
- API error responses use the standard error envelope from Step 13.
- Specific error types and names take precedence over generic status checks.
- Correlation IDs must be returned consistently.
- ETags must be treated as opaque values.
- `304 Not Modified` responses must not include a response body.
- Public API responses must not expose raw AWS SDK errors.
- Complete collection content must not be returned from the manifest endpoint.

## Endpoint

Implement:

HTTP

```text
GET /api/v1/reference-data/manifest
```

Optional filtered request:

HTTP

```text
GET /api/v1/reference-data/manifest?include=vessels,ports,species
```

Conditional request:

HTTP

```text
GET /api/v1/reference-data/manifest
If-None-Match: "<manifest-etag>"
```

The endpoint must not implement collection retrieval, dataset search, or collection uploads.

## Permissions

Use the existing authentication and authorisation integration when available.

The intended permission is:

Plain Text

```text
reference-data.read
```

If authentication integration belongs to a later step and is not yet implemented:

- Preserve an explicit controller or route boundary for future authorisation.
- Do not invent a temporary insecure authentication model.
- Follow existing repository conventions.
- Clearly document deferred authorisation enforcement.
  Do not access the Authentication Service directly from the controller or Query Module.

## Manifest response contract

Return a response equivalent to:

JSON

```text
{
  "manifestId": "c7b49c26-d6c0-4ab1-9318-cd1c862f4768",
  "version": "2026.09.11.3",
  "generatedAt": "2026-09-11T08:32:14Z",
  "datasets": [
    {
      "dataset": "vessels",
      "collectionId": "6bd5950c-527c-43c8-88f8-ee853169db1d",
      "schemaVersion": "1.0",
      "version": "2026.09.11.1",
      "etag": "\"sha256-1c10d2...\"",
      "url": "/api/v1/reference-data/vessels",
      "format": "json",
      "itemCount": 1834,
      "sizeBytes": 842312,
      "lastModified": "2026-09-11T08:30:00Z"
    },
    {
      "dataset": "map-statistical-areas",
      "collectionId": "1d7dd249-3732-4d57-b8cc-7b487c76e916",
      "schemaVersion": "1.0",
      "version": "2026.08.20.1",
      "etag": "\"sha256-e5581c...\"",
      "url": "/api/v1/reference-data/map/statistical-areas",
      "format": "geojson",
      "crs": "EPSG:4326",
      "featureCount": 3465,
      "sizeBytes": 2100000,
      "lastModified": "2026-08-20T09:15:00Z"
    }
  ]
}
```

Adapt property names only where an approved repository contract already differs.

Do not create a second competing manifest model.

## Manifest-level properties

The public manifest must include:

- `manifestId`
- `version`
- `generatedAt`
- `datasets`

### `manifestId`

Requirements:

- Must be a valid GUID.
- Must identify the active manifest revision.
- Must come from the active manifest model or approved runtime metadata.
- Must not be generated separately on every API request.
- Must remain stable while the active manifest is unchanged.

### `version`

Requirements:

- Must represent the active manifest version.
- Must not be confused with a dataset collection version.
- Must remain stable while the active manifest is unchanged.
- Must not use the current request timestamp as a version.

### `generatedAt`

Requirements:

- Must use the approved ISO 8601 UTC representation.
- Must represent the manifest generation or activation time.
- Must not be regenerated on every API request.

### `datasets`

Requirements:

- Must contain only public active dataset entries.
- Must use deterministic ordering.
- Must not expose mutable internal references.
- Must not contain complete collection objects.
- Must not expose validation or normalisation internals.
- Must not expose unavailable previous collection versions as active.

## Dataset entry contract

Each dataset entry must include:

- `dataset`
- `collectionId`
- `schemaVersion`
- `version`
- `etag`
- `url`
- `format`
- `lastModified`
  Include when available:

- `itemCount`
- `featureCount`
- `sizeBytes`
- `crs`

### Dataset

Use canonical public dataset identifiers.

Expected maintained identifiers include:

Plain Text

```text
vessels
gears
ports
species
map-land
map-statistical-areas
```

A derived `map-ports` entry may be included only if the approved API design and current repository explicitly expose the derived view through the manifest.

If included, the derived entry must:

- Be clearly identified as derived.
- Use ports as its source.
- Not claim an independent persisted collection ID or S3 object.
- Use the active ports collection version or an approved derived version.
- Not appear as independently uploadable.
  If the current design does not define derived manifest entries, omit `map-ports` and document the decision.

### Collection ID

Requirements:

- Must be a valid GUID.
- Must identify the active collection revision.
- Must not use the dataset business code.
- Must not be generated per request.

### Schema version

Requirements:

- Must identify the canonical schema version.
- Must reflect active collection metadata.
- Must not be inferred from a route.
- Must not be silently rewritten by the API controller.

### Collection version

Requirements:

- Must expose the active business-visible collection version.
- Must remain distinct from the manifest version.
- Must not expose inactive or failed refresh versions as active.

### ETag

Requirements:

- Must be treated as an opaque string.
- Must use the approved quoting convention.
- Must represent the active dataset revision.
- Must not be recalculated differently on every request.
- Must not expose misleading raw multipart S3 ETag semantics if the repository uses checksums instead.
- Must be suitable for future collection-level conditional requests.

### URL

Map datasets to public API routes.

Expected route mappings are:

Plain Text

```text
vessels -> /api/v1/reference-data/vessels
gears -> /api/v1/reference-data/gears
ports -> /api/v1/reference-data/ports
species -> /api/v1/reference-data/species
map-land -> /api/v1/reference-data/map/land
map-statistical-areas -> /api/v1/reference-data/map/statistical-areas
```

If the repository already centralises route definitions, derive URLs from that central approved mapping.

Do not expose:

- S3 object URLs
- Floci endpoints
- Bucket names
- Internal object keys
- Presigned URLs
- Internal service hostnames
  URLs should be relative unless the approved API contract explicitly requires absolute URLs.

### Format

Supported public format values are:

Plain Text

```text
json
geojson
```

Do not infer format solely from a filename extension when active metadata already provides the format.

### Count

For standard JSON collections, include:

Plain Text

```text
itemCount
```

For GeoJSON collections, include:

Plain Text

```text
featureCount
```

Requirements:

- Counts must come from validated active metadata.
- Do not parse complete collections during each API request merely to count records.
- Do not return both count types unless the approved contract requires it.
- Do not return a stale count from a failed collection refresh.

### Size

Include `sizeBytes` only when reliable active metadata is available.

Requirements:

- Must be a non-negative integer.
- Must represent the persisted or approved response artifact size according to one documented policy.
- Must not require an S3 metadata call per request.
- Omit the property if it cannot be reported reliably.

### Last modified

Requirements:

- Must use the approved ISO 8601 UTC representation.
- Must represent active collection metadata.
- Must not be replaced by the current API request time.
- Must not change for an unchanged collection.

### CRS

For GeoJSON datasets, use:

Plain Text

```text
EPSG:4326
```

Include `crs` only where the API contract requires it.

Do not use the deprecated GeoJSON root `crs` member as geometry data. This field is manifest metadata describing the service's canonical coordinate system.

## Query parameter: `include`

Support:

HTTP

```text
GET /api/v1/reference-data/manifest?include=vessels,ports,species
```

### Behaviour

- Parse `include` as a comma-separated list.
- Trim surrounding separator whitespace.
- Reject empty entries.
- Reject unsupported dataset identifiers.
- Reject duplicate values or de-duplicate them according to one documented repository policy.
- Preserve the manifest's deterministic dataset ordering rather than request ordering unless the approved API design states otherwise.
- Bound the number and total length of values.
- Use case-sensitive canonical dataset identifiers.
- Do not accept aliases.
- Do not infer `map-ports` from `ports` .
- Do not expose inactive collections.

### No `include` parameter

When `include` is absent, return every public active dataset entry.

### Empty `include`

A request equivalent to:

Plain Text

```text
?include=
```

must return a structured `400` error rather than silently returning every dataset.

### Unsupported include value

Example:

HTTP

```text
GET /api/v1/reference-data/manifest?include=vessels,unknown
``
```

Return:

HTTP

```text
400 Bad Request
```

Using the standard error envelope with a stable code equivalent to:

Plain Text

```text
invalid_query_parameter
``
```

or a more specific existing approved code.

## Manifest projection

Implement a dedicated manifest projection or mapper between internal runtime metadata and the public API response.

The projection must:

- Avoid exposing internal persistence details.
- Select only approved public fields.
- Produce deterministic dataset ordering.
- Avoid mutating internal state.
- Avoid returning internal map or object references.
- Handle optional metadata consistently.
- Generate approved public dataset URLs.
- Distinguish JSON item counts from GeoJSON feature counts.
- Keep manifest and collection versions distinct.
- Preserve GUIDs.
- Preserve ETags as opaque values.
- Remain independent of Hapi.js where practical.
  Do not return the internal active manifest object directly.

## Query Module behaviour

Implement a Query Module use case equivalent to:

Plain Text

```text
getManifest(query)
```

The Query Module must:

1. Obtain a consistent active manifest snapshot from the In-Memory Data Store or the approved runtime manifest provider.
2. Verify that startup hydration completed.
3. Verify that mandatory manifest state is available.
4. Apply the optional dataset filter.
5. Project internal metadata into the public response model.
6. Return response data and manifest ETag metadata.
7. Avoid persistence access.
8. Avoid authentication calls.
9. Avoid Hapi.js response construction.
   The Query Module must not:

- Read S3.
- Call Floci.
- Trigger cache refresh.
- Rehydrate the service.
- Validate collection content again.
- Normalise collection content again.
- Calculate collection counts by scanning full collections.
- Generate an unrelated new manifest ID.

## In-Memory Data Store integration

Use the active manifest snapshot provided by Step 11.

Requirements:

- Obtain one consistent snapshot per request.
- Do not read mutable internal maps directly.
- Do not combine metadata from different refresh generations.
- Do not block collection refresh longer than necessary.
- Do not mutate the snapshot.
- Do not request full collection content unless required by the current implemented contract.
- Return only active, successfully hydrated entries.
- Handle missing mandatory active state through the existing availability error model.
  If Step 11 does not expose a suitable manifest snapshot method, add the smallest compatible read-only method.

Do not redesign the entire store.

## Manifest ETag

The Manifest API must return:

HTTP

```text
ETag: "<manifest-etag>"
```

Use an existing active-manifest ETag where available.

If the internal manifest has no suitable ETag, derive a deterministic HTTP ETag from stable public manifest revision metadata according to an approved repository utility.

Preferred stable inputs include:

- Manifest ID
- Manifest version
- Active manifest checksum
  Do not derive the manifest ETag from:

- Current request time
- Random values
- Object identity
- Unstable property ordering
- The response correlation ID
  The same active manifest must produce the same ETag.

A changed active manifest must produce a different ETag.

## Conditional request behaviour

Support:

HTTP

```text
If-None-Match: "<manifest-etag>"
```

When the request ETag matches the active manifest ETag, return:

HTTP

```text
304 Not Modified
```

Requirements:

- Return no response body.
- Include the active `ETag` .
- Include `X-Correlation-Id` .
- Include approved cache headers.
- Do not serialise the manifest response unnecessarily after a match is established.
- Use the common Step 13 ETag utility.
- Do not perform substring comparison.
- Treat ETags as opaque.
- Follow existing approved weak and strong ETag behaviour.
- Support wildcard or multiple values only if Step 13 implemented those HTTP semantics.
- Do not return an error envelope with `304` .
  When the ETag does not match, return the normal `200` response.

## HTTP response behaviour

### Successful response

HTTP

```text
200 OK
Content-Type: application/json
ETag: "<manifest-etag>"
X-Correlation-Id: <correlation-id>
```

Apply the approved reference-data Cache-Control policy from Step 13.

Expected policy where unchanged by repository decisions:

HTTP

```text
Cache-Control: public, max-age=3600, stale-while-revalidate=86400
```

### Not modified

HTTP

```text
304 Not Modified
ETag: "<manifest-etag>"
X-Correlation-Id: <correlation-id>
``
```

No response body.

### Service unavailable

If startup hydration has not completed or no valid mandatory manifest state is available, return:

HTTP

```text
503 Service Unavailable
```

Use the standard error envelope and existing retry policy.

Do not return an empty successful manifest.

## Error handling

Use the common API error handling implemented in Step 13.

Required errors include:

### Invalid query parameter

HTTP

```text
400 Bad Request
```

Stable error code equivalent to:

Plain Text

```text
invalid_query_parameter
```

### Unauthorised

Where authentication is implemented:

HTTP

```text
401 Unauthorized
```

### Forbidden

Where authorisation is implemented:

HTTP

```text
403 Forbidden
```

### Reference data unavailable

HTTP

```text
503 Service Unavailable
``
```

Stable code equivalent to:

Plain Text

```text
reference_data_unavailable
```

or the existing approved availability code.

### Unexpected error

HTTP

```text
500 Internal Server Error
```

Stable code:

Plain Text

```text
internal_server_error
```

Do not implement route-specific raw error formatting.

Do not expose internal manifest state, persistence errors, stack traces, or object keys.

## Correlation handling

Use Step 13 common correlation behaviour.

Requirements:

- Preserve a valid supplied `X-Correlation-Id` .
- Generate one when absent.
- Return the identifier in the response.
- Use the same identifier as the error `traceId` .
- Include the identifier in safe structured logs.
- Do not generate a second unrelated trace ID in the controller.
- Preserve correlation headers on `304` .

## Logging

Follow existing structured logging conventions.

Log safe manifest-request summaries such as:

- Correlation ID
- Route identifier
- Include-filter count
- Returned dataset count
- Manifest version
- Whether the response was `200` or `304`
- Request duration
- Error code when unsuccessful
  Do not log:

- Complete manifest response bodies
- Internal S3 object keys
- Bucket names
- Credentials
- Tokens
- Complete collection metadata when unnecessary
- Full query headers
- Raw errors for expected client failures
  Avoid duplicate logs if Step 13 already logs request completion.

## Metrics

Use existing metrics hooks where available.

Prepare or emit bounded metrics equivalent to:

Plain Text

```text
reference_data_manifest_requests_total
reference_data_manifest_not_modified_total
reference_data_manifest_request_duration
reference_data_manifest_failures_total
```

Use bounded labels such as:

- Status code
- Error code
- Filtered or unfiltered
  Do not use:

- Correlation IDs as labels
- Manifest GUIDs as labels
- Collection GUIDs as labels
- Raw include-query values as labels
  If metrics export belongs to a later observability step, preserve hooks and document the deferral.

## Security and privacy requirements

- Treat query parameters and headers as untrusted.
- Bound the length of the `include` query.
- Bound the number of requested datasets.
- Reject malformed values safely.
- Do not expose persistence credentials.
- Do not expose bucket names.
- Do not expose internal object keys.
- Do not expose Floci endpoints.
- Do not expose stack traces.
- Do not return complete collection data.
- Do not return raw internal manifests.
- Do not permit query parameters to construct object paths.
- Do not dynamically import code based on dataset names.
- Use the central supported-dataset registry.
- Do not weaken authentication or authorisation.
- Apply only approved public cache behaviour.
- Do not cache error responses publicly.
- Do not disclose unavailable internal datasets beyond what is safe for authorised consumers.
- Review any new dependency for security, maintenance, and licence impact.

## Performance requirements

The Manifest API must be inexpensive.

Requirements:

- Read manifest metadata from memory.
- Do not call S3 per request.
- Do not call Floci per request.
- Do not scan complete collection contents.
- Do not recalculate item or feature counts from full collections.
- Do not revalidate active collections.
- Do not renormalise active collections.
- Avoid unnecessary deep cloning.
- Avoid serialising the response when returning `304` .
- Keep filter lookup time bounded.
- Use deterministic, efficient projection.
- Reuse central route mappings.
- Avoid repeated ETag calculation when the active manifest has not changed.

## Unit test requirements

Add comprehensive Docker-free unit tests.

### Manifest projection

Test:

- All maintained datasets
- JSON dataset entry
- GeoJSON dataset entry
- Item count
- Feature count
- Optional size
- Missing optional size
- CRS metadata
- Deterministic ordering
- Public URL mapping
- Internal object key not exposed
- Bucket name not exposed
- Collection content not exposed
- GUIDs preserved
- ETags preserved
- Input state not mutated
- Returned projection cannot mutate internal state

### Filtering

Test:

- No include filter
- One dataset
- Multiple datasets
- Every supported dataset
- Unsupported dataset
- Empty include value
- Empty list member
- Duplicate include value
- Whitespace around separators
- Case-sensitive dataset values
- Alias rejection
- Maximum filter count
- Maximum query length
- Deterministic response ordering
- Filter does not alter active state

### Query Module

Test:

- Successful active manifest retrieval
- Hydration incomplete
- Mandatory manifest unavailable
- Optional dataset absent
- Consistent snapshot use
- No Persistence Module calls
- No S3 calls
- No Floci calls
- No Authentication Service calls
- No cache-refresh trigger
- No collection-content scan

### ETag

Test:

- Stable ETag for unchanged manifest
- Changed ETag for changed manifest
- Matching `If-None-Match`
- Non-matching `If-None-Match`
- Quoted ETag behaviour
- Weak ETag behaviour according to Step 13
- Multiple ETags if supported
- Wildcard if supported
- Malformed header policy
- ETag does not depend on correlation ID
- ETag does not depend on request time
- Filtered-manifest ETag policy

### Filtered-manifest ETag decision

The plan must explicitly decide whether:

- All filtered views use the active full-manifest ETag, or
- Each filtered projection has a deterministic projection-specific ETag.
  Preferred behaviour:

- Use a projection-specific ETag if changes to excluded datasets should not invalidate a filtered client's cache.
- Use the full-manifest ETag if repository simplicity and current API design require one manifest revision identifier.
  Do not guess silently. Inspect existing approved API decisions and document the selected policy in the saved plan.

### Controller

Test:

- Successful `200`
- Correct JSON content type
- ETag header
- Cache-Control header
- Correlation header
- Matching ETag returns `304`
- `304` has no body
- Invalid include returns `400`
- Unavailable manifest returns `503`
- Unexpected failure returns safe `500`
- No raw error response
- No response stack trace
- Authentication and authorisation result where already implemented

## Integration test requirements

Use Hapi.js `server.inject` or the repository's existing Docker-free API test approach.

Verify:

1. The route is registered.
2. The approved base path is used.
3. A valid request returns `200` .
4. The response matches the public manifest schema.
5. Every returned URL uses a public API route.
6. Internal object keys are absent.
7. Bucket names are absent.
8. Collection content is absent.
9. Filtering returns only requested datasets.
10. Unsupported filtering returns a standard `400` .
11. Empty filtering returns a standard `400` .
12. A matching `If-None-Match` returns `304` .
13. A `304` response has no body.
14. ETag remains stable while the active manifest is unchanged.
15. ETag changes when the active manifest changes.
16. Correlation ID appears in `200` , `304` , and error responses.
17. Cache-Control behaviour matches Step 13.
18. Unavailable startup state returns `503` .
19. Unexpected errors return a safe `500` .
20. No direct persistence request occurs.
21. Normal tests remain Docker-free.
    Do not require Floci for Manifest API tests.

Use an in-memory or stubbed manifest provider.

## Regression test requirements

Run existing tests for:

- Common API behaviour
- Error mapping
- Correlation identifiers
- Conditional requests
- Cache refresh
- Startup hydration
- In-Memory Data Store
- Persistence
- Validation
- Normalisation
- Health
- Readiness
  Explicitly confirm:

- `NoSuchBucket` still maps before generic `404` .
- Persistence errors do not escape into the Manifest API.
- Readiness remains separate from liveness.
- Startup hydration remains the source of active runtime metadata.
- The Manifest API does not trigger refresh.
- Normal `npm test` remains Docker-free.
- Floci-specific tests remain separate.

## OpenAPI documentation

If the repository contains an OpenAPI specification, document the implemented endpoint.

Include:

Plain Text

```text
GET /api/v1/reference-data/manifest
```

Document:

- `include` query parameter
- `If-None-Match` request header
- `X-Correlation-Id` request and response headers
- `ETag` response header
- `Cache-Control`
- `200` response
- `304` response
- `400` response
- `401` response where applicable
- `403` response where applicable
- `500` response
- `503` response
- Manifest schema
- Dataset-entry schema
- JSON and GeoJSON format values
- Item and feature counts
- Examples
  Do not document unimplemented authentication behaviour as active.

Do not document unimplemented collection endpoints as complete merely because their URLs appear in manifest entries.

## Documentation requirements

Update the appropriate repository documentation with:

- Purpose of the Manifest API
- Offline synchronisation workflow
- Route and query parameters
- Full response example
- Filtered response example
- Dataset ordering
- Active-manifest source
- Manifest ID versus collection ID
- Manifest version versus collection version
- ETag behaviour
- Filtered-manifest ETag decision
- `304 Not Modified`
- Cache-Control behaviour
- Correlation headers
- Error responses
- Unavailable startup state
- Public URL mapping
- Derived `map-ports` decision
- Security considerations
- Performance considerations
- Testing commands
- Work deferred to later steps

## Explicit exclusions

Do not implement:

- Complete collection retrieval endpoints
- Dataset search
- Individual item retrieval
- Map-layer retrieval
- Mobile response projections
- Multipart file uploads
- Validation-only uploads
- Atomic collection replacement
- Manifest write or activation
- Cache refresh triggering from the API
- Public manual-refresh endpoint
- S3 reads from the Query Module
- S3 reads from the controller
- Floci calls from the route
- Authentication Service calls outside the Validation Module
- Item-level mutations
- Redis
- API Gateway deployment
- Fargate deployment
- Production IAM
- Presigned S3 URLs
- Internal object keys in public responses
- Full seed-data management
- Recalculation of collection metadata on every request

## Required plan content

The GitHub-generated plan must include:

1. Current route and controller structure.
2. Current Query Module structure.
3. Current active manifest model.
4. Current In-Memory Data Store manifest interface.
5. Current startup hydration and refresh behaviour.
6. Current common API behaviour from Step 13.
7. Existing ETag and conditional-request utilities.
8. Existing supported-dataset registry.
9. Existing public route mapping.
10. Existing OpenAPI structure.
11. Existing conventions to retain.
12. Gaps against Step 14.
13. Proposed manifest route registration.
14. Proposed controller responsibilities.
15. Proposed Query Module use case.
16. Proposed manifest projection.
17. Proposed public response contract.
18. Proposed dataset-entry contract.
19. Proposed `include` validation.
20. Proposed deterministic dataset ordering.
21. Proposed derived `map-ports` treatment.
22. Proposed manifest ETag source.
23. Proposed filtered-manifest ETag policy.
24. Proposed `If-None-Match` behaviour.
25. Proposed Cache-Control behaviour.
26. Proposed error mappings.
27. Proposed unavailable-state behaviour.
28. Proposed logging and metrics.
29. Exact files to create.
30. Exact files to modify.
31. Files intentionally left unchanged.
32. Unit-test approach.
33. Hapi.js integration-test approach.
34. Regression-test approach.
35. OpenAPI updates.
36. Documentation updates.
37. Security and privacy considerations.
38. Performance considerations.
39. Verification commands.
40. Assumptions and unresolved ambiguities.
41. Work explicitly deferred to later steps.

## Expected deliverables

- GitHub-generated plan saved as: Plain Text 1 github-prompts/Step 14-implement-manifest-api-plan.md
- Registered Manifest API route.
- Manifest request validation.
- `include` query parsing and validation.
- Query Module manifest retrieval use case.
- In-memory manifest snapshot integration.
- Public manifest projection.
- Deterministic public dataset ordering.
- Public dataset URL mapping.
- Manifest ETag response.
- `If-None-Match` processing.
- Correct `304` response behaviour.
- Standard API error integration.
- Correlation integration.
- Cache-Control integration.
- Safe structured logging.
- Metrics hooks where supported.
- Manifest response schemas.
- Docker-free unit tests.
- Docker-free Hapi.js integration tests.
- Regression verification.
- OpenAPI updates where present.
- Developer and consumer documentation.
- Step completion report.

## Acceptance criteria

- The GitHub-generated plan is saved before implementation begins.
- The saved plan is assumed to be approved.
- Copilot proceeds without requesting plan approval.
- The route is: Plain Text 1 GET /api/v1/reference-data/manifest
- The route uses the approved API base path.
- The controller follows existing repository conventions.
- The Query Module owns the manifest retrieval use case.
- The endpoint reads active metadata from process-local state.
- The endpoint does not read S3.
- The endpoint does not call Floci.
- The endpoint does not trigger cache refresh.
- The endpoint does not scan complete collections.
- The response includes manifest ID, version, generation time, and datasets.
- Every collection ID is a GUID.
- Manifest and collection versions remain distinct.
- Business identifiers are not used as collection IDs.
- Public dataset URLs do not expose S3 or internal object paths.
- Format values distinguish JSON and GeoJSON.
- Counts come from active metadata.
- Optional size metadata is handled consistently.
- GeoJSON CRS metadata is correct where included.
- Dataset ordering is deterministic.
- The `include` filter works.
- Unsupported include values return `400` .
- Empty include values return `400` .
- Query values are bounded.
- The manifest ETag is stable while active state is unchanged.
- The manifest ETag changes when active state changes.
- The filtered-manifest ETag policy is explicitly documented.
- Matching `If-None-Match` returns `304` .
- `304` responses contain no body.
- `304` responses include ETag and correlation headers.
- Successful responses use JSON content type.
- Successful responses use approved Cache-Control behaviour.
- Error responses are not publicly cached.
- Hydration-incomplete or unavailable state returns `503` .
- An unavailable manifest is not represented as a successful empty manifest.
- Errors use the Step 13 standard envelope.
- Unexpected failures return a safe `500` .
- Stack traces and raw dependency errors are not exposed.
- Correlation identifiers are preserved or generated.
- Complete collection content is not returned.
- Internal bucket names and object keys are not returned.
- `map-ports` follows the documented derived-dataset decision.
- No item-level mutation endpoint is introduced.
- No Redis dependency is introduced.
- Normal tests remain Docker-free.
- Common API regression tests pass.
- Cache refresh and startup hydration regression tests pass.
- Persistence tests pass.
- Type checking passes.
- Linting passes, or pre-existing issues are documented.
- The build passes.
- Documentation accurately reflects the implementation.
- Work outside Step 14 remains deferred.

## Verification

Use the repository's actual package manager, module system, scripts, and test configuration.

Run the applicable equivalents of:

Plain Text

```text
install dependencies
run type checking
run linting
run Manifest API unit tests
run Manifest API Hapi.js integration tests
run common API behaviour tests
run error-mapping tests
run correlation tests
run ETag and conditional-request tests
run cache-refresh tests
run startup-hydration tests
run In-Memory Data Store tests
run persistence regression tests
run the complete Docker-free test suite
run the build
```

Explicitly verify:

Plain Text

```text
manifest route registration
successful full manifest response
successful filtered manifest response
one included dataset
multiple included datasets
all supported datasets
unsupported include value
empty include value
duplicate include value policy
case-sensitive dataset identifiers
deterministic dataset ordering
public route mappings
JSON item counts
GeoJSON feature counts
optional size metadata
GeoJSON CRS metadata
manifest ID stability
manifest version stability
manifest ETag stability
manifest ETag change after active-state change
filtered-manifest ETag policy
matching If-None-Match
non-matching If-None-Match
304 with no body
304 with ETag
304 with correlation header
successful Cache-Control response
error response not publicly cached
valid supplied correlation ID
generated correlation ID
hydration incomplete
mandatory manifest unavailable
safe 503 response
safe unexpected 500 response
no stack trace
no raw Hapi or Boom error
no raw persistence error
no S3 access from controller
no S3 access from Query Module
no Floci call
no cache-refresh trigger
no complete collection scan
no internal object key in response
no bucket name in response
no complete collection in response
map-ports derived-dataset policy
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
3. Explain whether the issue blocks Step 14.
4. Do not expand scope silently.
5. Do not weaken tests to make them pass.
6. Ask for clarification if resolving the issue requires a public API, manifest, security, or architecture decision.

## Completion response

Provide a concise implementation report containing:

- Repository state discovered
- Saved plan filename
- Manifest endpoint implemented
- Query Module behaviour
- Manifest projection design
- Public dataset URL mapping
- Include-filter behaviour
- Dataset ordering
- Manifest ETag source
- Filtered-manifest ETag policy
- Conditional-request behaviour
- Cache-Control behaviour
- Error mappings
- Correlation behaviour
- `map-ports` decision
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
- Existing issues not introduced by Step 14
- Work deferred to later steps
- Remaining assumptions, risks, or owner decisions
  if you reach any ambiguity ask me to clarify
