# Step 16: Implement Vessel Query Endpoints and Mobile Projection

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
5. Inspect the existing Hapi.js routes, Reference Data Controller, Query Module, In-Memory Data Store, validation, canonical normalisation, common API behaviour, error handling, authentication boundary, tests, fixtures, and documentation.
6. Inspect the implemented canonical vessel schema and existing vessel data contracts.
7. Identify existing generic query utilities, pagination helpers, ETag handling, conditional-request behaviour, projection conventions, and route-registration patterns.
8. Produce a repository-specific implementation plan based on the code that actually exists.
   Do not assume that the repository is empty.

Do not duplicate suitable existing behaviour.

After producing the plan, save it as:

Plain Text

```text
github-prompts/Step 16-implement-vessel-query-endpoints-and-mobile-projection-plan.md
```

The saved GitHub-generated plan must be treated as **already approved** .

After saving the plan, continue directly with implementation without requesting plan approval unless:

- The implementation conflicts with the approved Reference Data Service design.
- A required upstream contract is missing.
- The canonical vessel schema differs materially from the assumptions in this prompt.
- A public API contract is ambiguous.
- A destructive or incompatible repository change is required.
- A security or privacy decision requires owner input.
- An unresolved issue would materially affect vessel matching, mobile behaviour, or API compatibility.
  The plan must be saved before implementation begins.

## Objective

Implement the vessel query API and mobile vessel projection for the Reference Data Service.

Implement the following endpoints:

HTTP

```text
GET /api/v1/reference-data/vessels
GET /api/v1/reference-data/vessels/{id}
```

The endpoints must support:

- Retrieval of the complete active vessel collection.
- Retrieval of a single vessel by GUID.
- Canonical and mobile response views.
- Free-text vessel search.
- Exact matching by approved vessel business identifiers.
- Filtering by multiple GUIDs where supported by the common query contract.
- Pagination for search results.
- Deterministic sorting.
- Active and inactive vessel filtering where supported by the canonical model.
- ETag and `If-None-Match` handling.
- Standard correlation, error, logging, and cache behaviour.
- Retrieval exclusively from the process-local In-Memory Data Store.
- Mobile-friendly vessel summary projection without maintaining a separate mobile collection.
  This step must not implement vessel creation, item-level updates, item-level deletion, full collection uploads, or S3 access from the query path.

## Project context

The Reference Data Service is a Node.js and Hapi.js backend service for the Catch Recording application.

The service manages:

- Vessels
- Gears
- Ports
- Species
- Map land
- Map statistical areas
  Reference data is persisted as complete JSON or GeoJSON collection files in S3 and hydrated into process-local memory.

The mobile Catch Recording application requires vessel reference data for vessel identification and selection.

The canonical vessel model remains aligned with the legacy vessel schema wherever practical.

The mobile vessel representation is a projection of canonical in-memory data, not a separately persisted collection.

## Architectural boundaries

Preserve these responsibilities:

1. The **Reference Data Controller** owns Hapi.js request and response mapping.
2. The **Query Module** owns vessel retrieval, filtering, searching, sorting, and pagination use cases.
3. The **In-Memory Data Store** provides the active canonical vessel collection and metadata.
4. The **Data Normalisation Module** owns canonical input normalisation.
5. A dedicated response projector or approved query projection layer owns the mobile vessel representation.
6. The **Persistence Module is the only application component permitted to access S3 or Floci** .
7. Vessel routes, controllers, query handlers, and mobile projectors must not access S3.
8. The Validation Module owns request validation.
9. The Validation Module is the only component permitted to call the Authentication Service.
10. Common API behaviour from Step 13 owns correlation, error mapping, common headers, and conditional-request behaviour.
11. The Cache Refresh Module owns changing active in-memory collections.
12. Query requests must not trigger hydration or refresh.
13. Redis or another external cache must not be introduced.
14. Item-level mutation operations must not be introduced.

## Existing decisions to preserve

Preserve all approved decisions:

- Vessel records use GUIDs as stable technical identifiers.
- CFR, UVI, MMSI, IRCS, external mark, and registration number are business identifiers.
- Business identifiers must not replace GUIDs.
- Natural identifiers remain strings.
- Leading zeros must be preserved.
- MMSI must remain a string.
- The service must not infer a vessel home port.
- The service must not infer one vessel identifier from another.
- `namePln` is retained where it exists in the approved canonical schema.
- Vessel length must remain available because gear applicability may depend on it.
- A valid vessel length is positive under the current canonical schema.
- Canonical and mobile API responses originate from the same active canonical collection.
- Normal tests remain Docker-free.
- Floci tests remain under the separate existing test configuration.
- Standard API errors follow Step 13.
- ETags are opaque values.
- `304 Not Modified` responses have no response body.
- Query endpoints read from memory rather than S3.
- The service does not support item-level vessel mutation.

## Repository assessment

Before writing the plan, inspect the repository for:

### Vessel model

- Canonical vessel schema
- Vessel collection schema
- Vessel types or typedefs
- Required and optional fields
- Identifier structure
- Vessel status representation
- Active date representation
- `namePln` spelling and casing
- Length field representation
- Country and type code representation
- Existing vessel fixtures
- Existing vessel validation
- Existing vessel normalisation

### Query implementation

- Query Module interfaces
- Generic collection retrieval
- Generic item lookup
- Search utilities
- Pagination utilities
- Sorting utilities
- Dataset registration
- In-Memory Data Store access
- Collection metadata access
- Existing query result contracts
- Existing projection interfaces

### HTTP implementation

- Route-registration conventions
- Controller conventions
- Common query-parameter schemas
- Common response schemas
- Correlation behaviour
- Error mapping
- ETag helpers
- `If-None-Match`
- Cache-Control
- Authentication and permission hooks
- OpenAPI structure

### Testing

- Hapi.js `server.inject` tests
- Query Module tests
- Projection tests
- Fixture builders
- Error-response tests
- Conditional-request tests
- Coverage configuration
- Existing regression suites
  Retain compatible conventions and avoid creating competing abstractions.

## Canonical vessel contract

Use the implemented approved canonical vessel schema as the source of truth.

The intended canonical representation contains concepts equivalent to:

JSON

```text
{
  "id": "73168db4-1996-46f8-91cb-2288fe2e689c",
  "name": "ACHILLES",
  "namePln": "ACHILLES PH1234",
  "identifiers": {
    "cfr": "GBR000A1234",
    "uvi": null,
    "mmsi": "232001234",
    "ircs": "MABC7",
    "externalMark": "PH1234",
    "registrationNumber": "PH1234"
  },
  "typeCode": "FISHING",
  "registrationCountryCode": "GBR",
  "lengthOverallMetres": 8.74,
  "status": "active",
  "activeFrom": "2015-03-17",
  "activeTo": null
}
```

Adapt to the exact implemented property names where the approved repository contract differs.

Do not introduce duplicate aliases solely to match this example.

Do not add a `homePort` field.

## Endpoints

### Complete or filtered vessel collection

HTTP

```text
GET /api/v1/reference-data/vessels
```

### Individual vessel

HTTP

```text
GET /api/v1/reference-data/vessels/{id}
```

The `{id}` route parameter is a vessel GUID.

Do not interpret `{id}` as CFR, UVI, MMSI, external mark, or registration number.

Business-identifier lookup is performed through query parameters.

## View selection

Support:

Plain Text

```text
view=canonical
view=mobile
```

The default must follow the approved API design.

Unless the repository contains a later approved decision, use:

Plain Text

```text
view=canonical
```

as the default.

Reject unsupported values with the standard `400` error response.

Do not silently fall back to another view.

Apply the requested view consistently to:

- Full collection retrieval
- Search results
- Multiple-ID retrieval
- Individual vessel retrieval

## Canonical collection response

A full canonical response should follow the active collection contract already implemented in the repository.

Conceptually:

JSON

```text
{
  "dataset": "vessels",
  "collectionId": "6bd5950c-527c-43c8-88f8-ee853169db1d",
  "schemaVersion": "1.0",
  "version": "2026.09.11.1",
  "generatedAt": "2026-09-11T08:30:00Z",
  "itemCount": 1,
  "items": [
    {
      "id": "73168db4-1996-46f8-91cb-2288fe2e689c",
      "name": "ACHILLES",
      "namePln": "ACHILLES PH1234",
      "identifiers": {
        "cfr": "GBR000A1234",
        "uvi": null,
        "mmsi": "232001234",
        "ircs": "MABC7",
        "externalMark": "PH1234",
        "registrationNumber": "PH1234"
      },
      "typeCode": "FISHING",
      "registrationCountryCode": "GBR",
      "lengthOverallMetres": 8.74,
      "status": "active",
      "activeFrom": "2015-03-17",
      "activeTo": null
    }
  ]
}
```

Requirements:

- Preserve canonical GUIDs.
- Preserve approved legacy vessel fields.
- Preserve all approved natural identifiers.
- Preserve strings with leading zeros.
- Do not infer missing values.
- Do not mutate the in-memory collection.
- Do not expose internal cache metadata that is not part of the API contract.
- Do not expose S3 object keys, bucket names, or persistence details.

## Mobile vessel projection

Implement a mobile projection equivalent to:

JSON

```text
{
  "id": "73168db4-1996-46f8-91cb-2288fe2e689c",
  "name": "ACHILLES",
  "pln": "PH1234",
  "cfr": "GBR000A1234",
  "displayName": "ACHILLES PH1234",
  "lengthOverallMetres": 8.74
}
```

The mobile collection response should be equivalent to:

JSON

```text
{
  "dataset": "vessels",
  "collectionId": "6bd5950c-527c-43c8-88f8-ee853169db1d",
  "version": "2026.09.11.1",
  "view": "mobile",
  "itemCount": 1,
  "items": [
    {
      "id": "73168db4-1996-46f8-91cb-2288fe2e689c",
      "name": "ACHILLES",
      "pln": "PH1234",
      "cfr": "GBR000A1234",
      "displayName": "ACHILLES PH1234",
      "lengthOverallMetres": 8.74
    }
  ]
}
```

Adapt field names only if the approved repository API contract differs.

## Mobile projection rules

Use explicit deterministic rules.

### `id`

- Use the canonical vessel GUID.
- Never use CFR, PLN, MMSI, registration number, or external mark as `id` .
- Never generate a new GUID during projection.

### `name`

- Use the canonical vessel name.
- Preserve canonical casing.
- Do not alter or translate the name.

### `pln`

Unless the canonical schema defines a separate approved PLN field, derive `pln` using this precedence:

1. `externalMark`
2. `registrationNumber`
3. `null` or omission according to the approved mobile schema
   Do not derive PLN by parsing `namePln` .

Do not derive PLN from CFR, MMSI, UVI, or IRCS.

The plan must confirm whether the implemented canonical schema already defines a dedicated PLN value. If it does, use that field according to the approved contract.

### `cfr`

- Use the canonical CFR.
- Preserve the original canonical representation.
- Return `null` or omit according to the approved mobile schema when absent.
- Do not substitute another identifier.

### `displayName`

Use this precedence unless an approved repository contract already defines it:

1. Use non-empty canonical `namePln` .
2. Otherwise combine canonical `name` and resolved `pln` , separated by one space.
3. Otherwise use canonical `name` .
4. Do not use a GUID as a user-facing display name.
5. Do not expose `"undefined"` , `"null"` , or duplicate whitespace.
   The projection must not write the generated display name back into canonical state.

### `lengthOverallMetres`

- Use the canonical positive numeric value.
- Do not convert it to a formatted string.
- Do not round it unless an approved mobile precision rule exists.
- Do not recalculate it.

## Mobile projection exclusions

Do not expose these fields in the default mobile summary unless the approved API contract explicitly requires them:

- UVI
- MMSI
- IRCS
- Registration country code
- Vessel type code
- Active date history
- Complete identifier object
- Internal collection metadata
- S3 metadata
  The canonical view remains available where the full record is required.

The plan must document any difference between this projection and an existing approved mobile contract.

## Collection retrieval behaviour

When no search, identifier filter, or pagination parameter is supplied, return the complete active vessel collection.

Requirements:

- Read from the In-Memory Data Store.
- Do not read S3.
- Do not trigger cache refresh.
- Apply the selected response view.
- Include active collection metadata.
- Return the active collection ETag.
- Support `If-None-Match` .
- Preserve deterministic source ordering unless an approved canonical sort exists.
- Do not apply the default search-result limit to an explicit full-collection request.
- Do not return a successful empty collection if the vessel dataset is unavailable.

## Search behaviour

Support free-text search:

HTTP

```text
GET /api/v1/reference-data/vessels?query=achilles
```

Search across approved textual vessel fields:

- `name`
- `namePln`
- CFR
- UVI
- MMSI
- IRCS
- External mark
- Registration number
  Requirements:

- Use case-insensitive matching for alphabetic and alphanumeric values.
- Preserve original response values.
- Treat the query as plain text, not a regular expression.
- Trim leading and trailing query whitespace.
- Reject an empty query after trimming.
- Bound query length.
- Avoid catastrophic regular expressions.
- Do not perform fuzzy matching unless explicitly approved.
- Do not infer phonetic matches.
- Do not query S3.
- Do not mutate canonical data.
- Use deterministic ordering of matching results.
  Preferred plain-text behaviour is case-insensitive substring matching.

If an existing common search contract defines prefix matching or token matching, retain that approved convention and document it in the plan.

## Exact business-identifier filters

Support exact vessel matching using query parameters equivalent to:

HTTP

```text
GET /api/v1/reference-data/vessels?cfr=GBR000A1234
GET /api/v1/reference-data/vessels?uvi=1234567
GET /api/v1/reference-data/vessels?mmsi=232001234
GET /api/v1/reference-data/vessels?ircs=MABC7
GET /api/v1/reference-data/vessels?externalMark=PH1234
GET /api/v1/reference-data/vessels?registrationNumber=PH1234
```

Use the exact implemented canonical property names and approved public query names.

### Comparison rules

Use case-insensitive comparison for:

- CFR
- UVI
- IRCS
- External mark
- Registration number
  Use exact string comparison for:

- MMSI
  Requirements:

- Trim surrounding query whitespace.
- Preserve leading zeros.
- Do not convert values to numbers.
- Do not mutate canonical values.
- Empty filter values return `400` .
- Bound filter lengths.
- Multiple supplied exact filters use logical `AND` unless the approved common query contract defines another rule.
- Document combined-filter behaviour.
- Do not silently prioritize one exact filter and ignore another.

## GUID filters

Support individual retrieval:

HTTP

```text
GET /api/v1/reference-data/vessels/{id}
```

Where already supported by the common query design, also support:

HTTP

```text
GET /api/v1/reference-data/vessels?ids=<guid-1>,<guid-2>
```

Requirements:

- Validate every GUID.
- Bound the number of GUIDs.
- De-duplicate repeated GUIDs according to the approved common query policy.
- Preserve deterministic response ordering.
- Do not treat business identifiers as GUIDs.
- An invalid GUID returns `400` .
- An unknown individual `{id}` returns `404` .
- For an `ids` filter, document whether unknown IDs are omitted or produce an error.
- Follow an existing approved generic query convention where available.
  Do not introduce both `id` and `ids` query parameters unless the common API contract requires both.

## Optional code-list filter

If Step 13 or the approved API design establishes a generic `codes` parameter, map vessel codes only to an explicitly approved vessel business identifier.

Do not guess which vessel identifier is the generic vessel code.

If no authoritative mapping exists, do not implement `codes` for vessels. Use explicit identifier parameters instead and record this in the plan.

## Active and inactive vessels

Where the canonical vessel schema supports active state, support:

Plain Text

```text
includeInactive
```

Preferred behaviour:

- Default: `includeInactive=false`
- When false, exclude records whose canonical status is inactive.
- When true, include both active and inactive records.
  Use the implemented status model rather than inferring active state from arbitrary fields.

If active state is derived from dates, use the repository's injected clock and approved date policy.

Do not use the local system timezone.

Do not infer that missing status means inactive unless the canonical contract defines that behaviour.

If the current vessel schema does not support inactive state, reject or omit the parameter according to the common API convention rather than implementing speculative logic.

## Search response envelope

Filtered, searched, or paginated results should follow a response equivalent to:

JSON

```text
{
  "dataset": "vessels",
  "collectionId": "6bd5950c-527c-43c8-88f8-ee853169db1d",
  "version": "2026.09.11.1",
  "view": "mobile",
  "query": {
    "text": "achilles",
    "offset": 0,
    "limit": 50
  },
  "total": 1,
  "items": []
}
```

Apply the existing common query-result contract if already implemented.

Requirements:

- `total` represents the number of matching records before pagination.
- `items` contains only the requested page.
- `offset` and `limit` use validated values.
- Do not claim `itemCount` is the original collection size when returning filtered results unless the contract distinguishes both values clearly.
- Preserve active collection ID and version.
- Include the selected view.
- Do not expose internal indexes or match scores.

## Pagination

Support the common pagination parameters:

Plain Text

```text
limit
offset
```

Use the defaults and maximums established by configuration and Step 13.

Unless existing approved configuration differs:

Plain Text

```text
default limit: 50
maximum limit: 500
default offset: 0
```

Requirements:

- Apply pagination to searches and filtered results.
- Do not automatically paginate an explicit full-collection request.
- Reject negative values.
- Reject non-integer values.
- Reject a limit above the configured maximum unless the approved common behaviour clamps it.
- Return an empty page when offset is beyond the final result.
- Preserve the correct `total` .
- Avoid copying the complete vessel collection unnecessarily.

## Sorting

Use deterministic sorting for search and filtered results.

Support the common `sort` parameter only where an approved parser already exists.

Approved vessel sort fields should be limited to fields equivalent to:

Plain Text

```text
name
namePln
cfr
externalMark
registrationNumber
lengthOverallMetres
```

Do not allow arbitrary property paths.

Preferred default result ordering:

1. Vessel name, case-insensitive
2. PLN or external mark, case-insensitive
3. Vessel GUID as a final deterministic tie-breaker
   Requirements:

- Document ascending and descending syntax.
- Validate sort fields through an allowlist.
- Preserve stable deterministic ties.
- Keep null ordering explicit.
- Do not use locale-sensitive ordering without a fixed approved locale.
- Do not mutate the source collection by sorting it in place.
- Do not sort full canonical collection retrieval unless the contract requires it.

## Individual vessel response

For:

HTTP

```text
GET /api/v1/reference-data/vessels/{id}
```

Return the selected canonical or mobile vessel object according to `view` .

Preferred response shape:

- Return the item directly if that matches existing item-route conventions.
- Otherwise use the existing approved item response envelope.
  Do not invent a third incompatible response style.

The plan must inspect and document the selected repository convention.

### Unknown vessel

Return:

HTTP

```text
404 Not Found
```

Using the standard error envelope with a code equivalent to:

Plain Text

```text
reference_item_not_found
```

Include:

- Safe message
- Correlation trace ID
- Dataset identifier where supported
  Do not disclose other vessel identifiers.

## Query Module implementation

Implement or align vessel query use cases equivalent to:

Plain Text

```text
getVesselCollection(query)
getVesselById(id, query)
```

The Query Module must:

1. Obtain a consistent active vessel collection snapshot.
2. Obtain active collection metadata.
3. Verify that the vessel dataset is available.
4. Apply active state filtering.
5. Apply exact identifier filters.
6. Apply free-text search.
7. Apply deterministic sorting.
8. Calculate total matches.
9. Apply pagination where appropriate.
10. Apply canonical or mobile projection.
11. Return response data and ETag metadata.
12. Avoid persistence access.
13. Avoid authentication calls.
14. Avoid Hapi.js response construction.
    Keep route parsing in the controller or request-validation layer and business query operations in the Query Module.

## Search indexes

The initial implementation may scan the active in-memory vessel collection if collection size and repository performance requirements permit it.

If an index is introduced:

- Keep index construction owned by the in-memory or query infrastructure boundary.
- Build indexes only from active canonical data.
- Replace indexes atomically with collection refresh.
- Do not maintain stale references.
- Do not introduce an external search engine.
- Do not duplicate canonical persisted state.
- Keep index behaviour deterministic.
- Cover index refresh with tests.
  Do not introduce index complexity without repository evidence that a linear scan is insufficient.

Document the selected approach in the plan.

## In-Memory Data Store integration

Use the process-local store implemented in Step 11.

Requirements:

- Obtain one consistent active vessel snapshot per request.
- Do not access mutable internal maps directly.
- Do not mutate the canonical collection.
- Do not block cache refresh longer than necessary.
- Do not combine collection data and metadata from different refresh generations.
- Do not trigger hydration.
- Do not trigger refresh.
- Map unavailable vessel data through the existing `503` availability error.
  If the store does not expose a suitable read-only snapshot, add the smallest compatible method rather than redesigning the store.

## ETag and conditional requests

Return the active vessel collection ETag:

HTTP

```text
ETag: "<vessel-collection-etag>"
```

Support:

HTTP

```text
If-None-Match: "<vessel-collection-etag>"
```

Use Step 13 common conditional-request behaviour.

### Full collection ETag

Use the active collection ETag.

### Filtered response ETag

The plan must inspect the approved API behaviour and explicitly decide whether filtered responses use:

- The active collection ETag, or
- A deterministic projection-specific ETag based on the collection revision plus normalised query parameters and view.
  Preferred behaviour:

- Use a projection-specific ETag if cache correctness requires different validators for different query projections.
- Keep derivation deterministic.
- Do not include correlation ID or request time.
- Do not serialise the full result merely to calculate an ETag when stable metadata and normalised query parameters are sufficient.
  Do not silently use one ETag for semantically different response representations if that breaks conditional-request correctness.

### `304 Not Modified`

When matched:

- Return `304` .
- Return no body.
- Include ETag.
- Include correlation header.
- Include approved cache headers.
- Do not perform unnecessary mobile projection after the match can be established.

## Cache-Control

Use the approved reference-data read policy from Step 13.

Expected default where unchanged:

HTTP

```text
Cache-Control: public, max-age=3600, stale-while-revalidate=86400
```

Do not publicly cache:

- Error responses
- Authentication failures
- Readiness responses
- Responses containing caller-specific data
  If vessel responses become caller-specific due to future authorisation, reevaluate public caching rather than retaining it automatically.

## Authentication and authorisation

Use existing integration where implemented.

The intended permission is:

Plain Text

```text
reference-data.read
```

Requirements:

- Do not call the Authentication Service from the controller or Query Module.
- Use the Validation Module or existing Hapi.js authentication strategy.
- Missing or invalid authentication returns `401` .
- Insufficient permission returns `403` .
- Do not expose vessel data before authorisation where protection is active.
- Do not invent a temporary token format.
  If authentication remains deferred, preserve the explicit integration boundary and document the deferred enforcement.

## Request validation

Validate:

- `id`
- `view`
- `query`
- `cfr`
- `uvi`
- `mmsi`
- `ircs`
- `externalMark`
- `registrationNumber`
- `ids`
- `limit`
- `offset`
- `sort`
- `includeInactive`
- `If-None-Match`
- `X-Correlation-Id`
  Use existing common validators from Steps 08 and 13.

Requirements:

- Reject unknown query parameters according to the approved common policy.
- Preserve leading zeros.
- Parse booleans strictly.
- Bound query and list lengths.
- Do not use permissive JavaScript coercion.
- Return the Step 13 standard error envelope.
- Do not include complete rejected objects.
- Keep validation details deterministic.

## HTTP response behaviour

### Successful collection response

HTTP

```text
200 OK
Content-Type: application/json
ETag: "<response-etag>"
X-Correlation-Id: <correlation-id>
Cache-Control: <approved-policy>
```

### Successful item response

HTTP

```text
200 OK
Content-Type: application/json
ETag: "<response-etag>"
X-Correlation-Id: <correlation-id>
Cache-Control: <approved-policy>
```

### Not modified

HTTP

```text
304 Not Modified
ETag: "<response-etag>"
X-Correlation-Id: <correlation-id>
```

No body.

### Invalid request

HTTP

```text
400 Bad Request
```

### Unauthorised

HTTP

```text
401 Unauthorized
```

Where authentication is active.

### Forbidden

HTTP

```text
403 Forbidden
```

Where authorisation is active.

### Vessel not found

HTTP

```text
404 Not Found
```

### Vessel data unavailable

HTTP

```text
503 Service Unavailable
```

### Unexpected failure

HTTP

```text
500 Internal Server Error
```

Use common API handling rather than route-specific error-envelope construction.

## Error handling

Use stable error codes equivalent to existing repository definitions.

Relevant conditions include:

Plain Text

```text
invalid_query_parameter
invalid_path_parameter
invalid_guid
unsupported_view
reference_item_not_found
dataset_not_found
reference_data_unavailable
unauthorized
forbidden
internal_server_error
```

Requirements:

- Do not expose stack traces.
- Do not expose raw Hapi.js, Joi, persistence, or cache errors.
- Do not map unavailable vessel data to a successful empty array.
- Do not map an invalid GUID to `404` .
- Do not expose internal collection or object keys.
- Preserve correlation IDs in all error responses.

## Logging

Follow Step 13 structured logging.

Safe vessel-query logging may include:

- Correlation ID
- Route identifier
- Selected view
- Whether search is present
- Which filter names are present
- Offset and limit
- Result count
- Total match count
- Collection version
- Response status
- `200` or `304`
- Request duration
- Error code
  Do not log:

- Complete vessel collection
- Complete vessel records
- Complete search results
- Access tokens
- Credentials
- Complete CFR, UVI, MMSI, IRCS, external mark, or registration number values
- Raw query strings when they contain identifiers
- Internal S3 metadata
  Log the presence of sensitive filters rather than their full values.

## Metrics

Use existing metrics hooks where available.

Prepare or emit bounded metrics equivalent to:

Plain Text

```text
reference_data_vessel_requests_total
reference_data_vessel_search_requests_total
reference_data_vessel_request_duration
reference_data_vessel_results_total
reference_data_vessel_not_found_total
reference_data_vessel_not_modified_total
reference_data_vessel_failures_total
```

Use bounded labels such as:

- Route identifier
- View
- Status code
- Filtered or unfiltered
- Error code
  Do not use:

- Vessel GUIDs as metric labels
- Business identifiers as metric labels
- Correlation IDs as metric labels
- Raw query text as a metric label
  If exporting metrics is deferred, use existing-compatible hooks and document the deferral.

## Security and privacy requirements

Vessel identifiers may be operationally sensitive.

Requirements:

- Treat all query parameters as untrusted.
- Validate and bound query lengths.
- Validate and bound ID lists.
- Do not use user input as a regular expression.
- Do not use query values to construct object keys.
- Do not expose internal cache structures.
- Do not expose S3 details.
- Do not log complete vessel identifiers.
- Do not echo complete search criteria in errors.
- Do not expose stack traces.
- Do not expose raw canonical records in errors.
- Do not permit prototype-pollution keys.
- Do not add wildcard CORS.
- Preserve authentication and authorisation boundaries.
- Ensure exact identifier filters cannot bypass active-state policy.
- Avoid user-controlled arbitrary sort fields.
- Review any new dependency for security, maintenance, and licence impact.

## Performance requirements

The vessel query implementation must be suitable for a complete in-memory vessel collection.

Requirements:

- Do not call S3.
- Do not call Floci.
- Do not trigger refresh.
- Avoid repeated full scans where one pass can apply the required filters.
- Avoid projecting records that will be discarded by pagination where practical.
- Calculate `total` correctly.
- Avoid mutating arrays through in-place sorting.
- Avoid deep cloning complete collections.
- Reuse active metadata for ETags.
- Bound `ids` input.
- Bound query length.
- Use deterministic comparisons.
- Measure search and projection duration where existing observability supports it.
  If the expected maximum vessel count is unknown, document the assumption and keep the implementation simple, observable, and replaceable.

## Unit test requirements

Add comprehensive Docker-free tests.

### Mobile projection

Test:

- Complete canonical vessel
- Vessel with `namePln`
- Vessel without `namePln`
- External mark used as PLN
- Registration number fallback as PLN
- No available PLN
- CFR present
- CFR absent
- Display name from `namePln`
- Display name from name and PLN
- Display name from name only
- No `"undefined"` or `"null"` text
- Length preserved as a number
- GUID preserved
- Business identifier not used as GUID
- Input vessel not mutated
- Projection is deterministic
- Unapproved identifiers excluded

### Full collection

Test:

- Canonical view
- Mobile view
- Default view
- Unsupported view
- Empty active collection
- Unavailable vessel dataset
- Collection metadata preserved
- Collection ETag returned
- Full request not paginated by default
- Source ordering preserved according to policy
- In-memory source not mutated

### Individual vessel

Test:

- Canonical item by GUID
- Mobile item by GUID
- Unknown GUID
- Invalid GUID
- Business identifier supplied as path ID
- Active vessel
- Inactive vessel policy
- Collection metadata and ETag behaviour according to item response contract

### Free-text search

Test:

- Match by vessel name
- Match by `namePln`
- Match by CFR
- Match by UVI
- Match by MMSI
- Match by IRCS
- Match by external mark
- Match by registration number
- Case-insensitive alphabetic match
- Numeric string match
- Substring behaviour
- No result
- Empty trimmed query
- Maximum query length
- Input treated as plain text rather than a regular expression
- Special characters handled safely

### Exact filters

Test:

- CFR match
- UVI match
- MMSI match
- IRCS match
- External mark match
- Registration number match
- Case-insensitive approved identifiers
- Exact MMSI comparison
- Leading-zero preservation
- Empty filter
- Multiple filters using approved logical combination
- Conflicting filters return no results rather than an unrelated error
- Canonical values are unchanged

### GUID list filter

Where implemented, test:

- One GUID
- Multiple GUIDs
- Duplicate GUIDs
- Unknown GUID
- Invalid GUID
- Empty list member
- Maximum list length
- Stable response order
- Interaction with mobile view
- Interaction with pagination according to contract

### Active status

Where supported, test:

- Default excludes inactive
- `includeInactive=true`
- `includeInactive=false`
- Invalid boolean
- Missing status according to canonical policy
- Active-date boundary under `TZ=UTC` where date-derived
- Filter does not mutate records

### Pagination

Test:

- Default limit for search
- Default offset
- Explicit limit
- Explicit offset
- Last partial page
- Offset beyond results
- Invalid negative values
- Non-integer values
- Limit above maximum
- Correct total before pagination
- Full collection request remains unpaginated
- Empty search result

### Sorting

Test:

- Default deterministic ordering
- Sort by approved name field
- Sort by approved identifier field
- Sort by vessel length where supported
- Ascending
- Descending
- Invalid field
- Null value ordering
- GUID tie-breaker
- Source array not mutated

### ETag

Test:

- Stable collection ETag
- Matching `If-None-Match`
- Non-matching `If-None-Match`
- `304` has no body
- Correlation header on `304`
- Filtered-response ETag policy
- View affects ETag where required
- Query parameters affect projection-specific ETag where required
- ETag does not depend on correlation ID
- ETag does not depend on request time

### Architecture boundaries

Verify:

- Query Module uses the In-Memory Data Store.
- Controller does not use the Persistence Module.
- Query Module does not use the Persistence Module.
- No AWS SDK import exists in vessel query modules.
- No Floci call occurs.
- Query does not trigger cache refresh.
- Projection does not mutate canonical data.
- Authentication Service is not called outside the Validation Module.
- No Redis dependency is introduced.

## Integration test requirements

Use Hapi.js `server.inject` or the repository's established Docker-free API test approach.

Verify:

1. Vessel collection route is registered.
2. Vessel item route is registered.
3. Default canonical collection response.
4. Mobile collection response.
5. Canonical vessel by GUID.
6. Mobile vessel by GUID.
7. Search by vessel name.
8. Search by business identifier.
9. Exact CFR filter.
10. Exact MMSI filter.
11. Case-insensitive approved identifier matching.
12. Leading-zero identifier preservation.
13. Pagination.
14. Sorting.
15. Inactive-vessel policy where supported.
16. Unsupported view returns `400` .
17. Invalid GUID returns `400` .
18. Unknown vessel returns `404` .
19. Unavailable vessel collection returns `503` .
20. Matching ETag returns `304` .
21. `304` has no body.
22. ETag and correlation headers are present.
23. Cache-Control is correct.
24. Error responses use the Step 13 envelope.
25. Unexpected errors produce a safe `500` .
26. No S3 access occurs.
27. No cache refresh occurs.
28. Complete identifiers are not present in request logs.
29. Normal tests remain Docker-free.
    Do not require Floci for vessel query tests.

Use a deterministic in-memory vessel collection fixture.

## Regression test requirements

Run existing tests for:

- Common structural and business validation
- Vessel schema validation
- Canonical vessel normalisation
- In-Memory Data Store
- Startup hydration
- Cache refresh
- Common API behaviour
- Manifest API
- Persistence
- Health and readiness
  Explicitly confirm:

- Vessel query operations do not change active state.
- Mobile projection does not alter canonical objects.
- Manifest vessel metadata remains accurate.
- Persistence error mapping remains unchanged.
- `NoSuchBucket` remains distinct from an ordinary missing object.
- Cache refresh can replace the active vessel collection atomically.
- A subsequent vessel query sees the new active collection.
- An invalid refresh does not affect vessel query results.
- Normal `npm test` remains Docker-free.
- Floci-specific tests remain separate.

## OpenAPI documentation

If the repository contains an OpenAPI definition, document:

HTTP

```text
GET /api/v1/reference-data/vessels
GET /api/v1/reference-data/vessels/{id}
```

Include:

- `id` path parameter
- `view`
- `query`
- Explicit business-identifier filters
- `ids` where implemented
- `limit`
- `offset`
- `sort`
- `includeInactive`
- `If-None-Match`
- `X-Correlation-Id`
- `ETag`
- `Cache-Control`
- Canonical response schema
- Mobile vessel schema
- Search response schema
- `200`
- `304`
- `400`
- `401` where active
- `403` where active
- `404`
- `500`
- `503`
  Examples must conform to the implemented schema.

Do not document unsupported generic vessel `codes` behaviour.

## Documentation requirements

Update the appropriate documentation with:

- Vessel endpoint purpose
- Canonical vessel fields
- Mobile projection fields
- PLN resolution rule
- Display-name resolution rule
- GUID versus business identifiers
- Full collection behaviour
- Search fields
- Exact identifier filters
- Comparison rules
- Active and inactive policy
- Pagination
- Sorting
- ETag and conditional requests
- Filtered-response ETag policy
- Cache-Control
- Error responses
- Authentication requirements where implemented
- Security and privacy considerations
- Performance considerations
- Testing commands
- Work deferred to later steps
  Include concise examples for:

- Full canonical collection
- Full mobile collection
- Name search
- CFR lookup
- Vessel item by GUID
- `304 Not Modified`
- Unknown vessel error

## Explicit exclusions

Do not implement:

- Vessel creation
- Vessel item update
- Vessel item patch
- Vessel item deletion
- Full vessel collection upload
- Validation-only vessel upload
- Atomic collection activation
- Vessel persistence access from query code
- S3 reads from controllers
- Floci calls from query code
- Cache refresh triggering
- Mobile gear projection
- Port query endpoints
- Species query endpoints
- Map query endpoints
- Favourites
- Vessel home-port inference
- External vessel registry calls
- Vessel geolocation
- Fuzzy or phonetic search
- Elasticsearch or another external search engine
- Redis
- API Gateway deployment
- Fargate deployment
- Production IAM changes

## Required plan content

The GitHub-generated plan must include:

1. Current vessel schema and canonical contract.
2. Current vessel normalisation behaviour.
3. Current query architecture.
4. Current In-Memory Data Store interface.
5. Current controller and route conventions.
6. Current common query parsing.
7. Current ETag and conditional-request behaviour.
8. Current error handling.
9. Current authentication boundary.
10. Existing API and OpenAPI conventions.
11. Existing test conventions.
12. Existing behaviour to retain.
13. Gaps against Step 16.
14. Proposed vessel route registration.
15. Proposed controller responsibilities.
16. Proposed Query Module use cases.
17. Proposed canonical response shape.
18. Proposed mobile response shape.
19. Proposed PLN resolution rule.
20. Proposed display-name resolution rule.
21. Proposed full collection behaviour.
22. Proposed free-text search fields and matching.
23. Proposed exact identifier filters.
24. Proposed multiple-filter combination.
25. Proposed GUID-list behaviour.
26. Proposed inactive-vessel policy.
27. Proposed pagination behaviour.
28. Proposed sorting behaviour.
29. Proposed individual-item response convention.
30. Proposed ETag source.
31. Proposed filtered-response ETag policy.
32. Proposed Cache-Control behaviour.
33. Proposed unavailable-state behaviour.
34. Proposed logging and metrics.
35. Exact files to create.
36. Exact files to modify.
37. Files intentionally left unchanged.
38. Unit-test approach.
39. Hapi.js integration-test approach.
40. Regression-test approach.
41. OpenAPI updates.
42. Documentation updates.
43. Security and privacy considerations.
44. Performance considerations.
45. Verification commands.
46. Assumptions and unresolved ambiguities.
47. Work explicitly deferred to later steps.

## Expected deliverables

- GitHub-generated plan saved as: Plain Text 1 github-prompts/Step 16-implement-vessel-query-endpoints-and-mobile-projection-plan.md
- Vessel collection route.
- Vessel item route.
- Vessel request schemas.
- Vessel Query Module use cases.
- Canonical vessel collection response.
- Canonical individual vessel response.
- Mobile vessel projector.
- Mobile vessel collection response.
- Mobile individual vessel response.
- Free-text vessel search.
- Exact business-identifier filters.
- GUID item retrieval.
- Multiple-GUID filtering where approved.
- Active and inactive vessel filtering where supported.
- Pagination for search results.
- Deterministic sorting.
- ETag integration.
- `If-None-Match` integration.
- Cache-Control integration.
- Standard correlation and error handling.
- Safe structured logging.
- Metrics hooks where supported.
- Docker-free unit tests.
- Docker-free Hapi.js integration tests.
- Regression verification.
- OpenAPI updates where present.
- Consumer and developer documentation.
- Step completion report.

## Acceptance criteria

- The GitHub-generated plan is saved before implementation begins.
- The saved plan is assumed to be approved.
- Copilot continues without requesting plan approval.
- The vessel collection route is available at: Plain Text 1 GET /api/v1/reference-data/vessels
- The vessel item route is available at: Plain Text 1 GET /api/v1/reference-data/vessels/{id}
- The routes use the approved API base path.
- Vessel item identity uses GUIDs.
- Business identifiers are not used as technical IDs.
- Canonical responses preserve the approved vessel schema.
- Mobile responses are projected from canonical in-memory data.
- No separate mobile vessel collection is persisted.
- Valid vessel GUIDs remain unchanged.
- Vessel identifiers remain strings.
- Leading zeros are preserved.
- MMSI remains a string.
- No vessel home port is inferred.
- No identifier is inferred from another identifier.
- The mobile projection includes the approved GUID, name, PLN, CFR, display name, and vessel length fields.
- PLN resolution follows the documented deterministic rule.
- Display-name resolution follows the documented deterministic rule.
- The mobile projector does not mutate the canonical vessel.
- Full collection retrieval reads from memory.
- Search reads from memory.
- Individual retrieval reads from memory.
- No vessel query path accesses S3 or Floci.
- No vessel query triggers refresh.
- Free-text search covers the approved vessel fields.
- Search treats input as plain text.
- Approved alphabetic and alphanumeric identifier matching is case-insensitive.
- MMSI matching is exact.
- Exact identifier filters preserve leading zeros.
- Multiple filters use the documented combination rule.
- Invalid path GUIDs return `400` .
- Unknown vessel GUIDs return `404` .
- Unsupported views return `400` .
- Unavailable vessel data returns `503` .
- Unavailable vessel data is not returned as a successful empty collection.
- Search pagination returns a correct pre-pagination total.
- Full collection requests are not accidentally limited by search defaults.
- Sorting is deterministic.
- Sorting does not mutate the source array.
- ETags represent the active vessel response revision.
- The filtered-response ETag policy is explicitly documented.
- Matching `If-None-Match` returns `304` .
- A `304` response has no body.
- Correlation and ETag headers are present on `304` .
- Successful responses use JSON content type.
- Cache-Control follows the approved policy.
- Error responses use the Step 13 standard envelope.
- Stack traces and raw internal errors are not exposed.
- Sensitive vessel identifiers are not logged in full.
- Authentication and authorisation boundaries are preserved.
- No item-level mutation endpoint is introduced.
- No Redis dependency is introduced.
- Normal tests remain Docker-free.
- Vessel unit and integration tests pass.
- Validation and normalisation regression tests pass.
- Cache refresh and in-memory store regression tests pass.
- Manifest API regression tests pass.
- Persistence tests pass.
- Type checking passes.
- Linting passes, or pre-existing issues are documented separately.
- The build passes.
- Documentation matches the implementation.
- Work outside Step 16 remains deferred.

## Verification

Use the repository's actual package manager, module system, scripts, and test configuration.

Run the applicable equivalents of:

Plain Text

```text
install dependencies
run type checking
run linting
run vessel projection unit tests
run vessel Query Module tests
run vessel route and controller tests
run vessel Hapi.js integration tests
run common API behaviour tests
run manifest API tests
run in-memory store tests
run cache-refresh tests
run validation tests
run normalisation tests
run persistence regression tests
run the complete Docker-free test suite
run the build
```

Explicitly verify:

Plain Text

```text
vessel collection route registration
vessel item route registration
default canonical view
explicit canonical view
mobile view
unsupported view
complete canonical collection
complete mobile collection
canonical item by GUID
mobile item by GUID
invalid GUID
unknown GUID
search by name
search by namePln
search by CFR
search by UVI
search by MMSI
search by IRCS
search by external mark
search by registration number
case-insensitive alphabetic matching
exact MMSI matching
plain-text special-character handling
empty query
overlong query
exact CFR filter
exact UVI filter
exact MMSI filter
exact IRCS filter
exact external-mark filter
exact registration-number filter
leading-zero preservation
multiple-filter combination
GUID-list behaviour where implemented
default inactive-vessel policy
includeInactive behaviour where supported
default search pagination
explicit pagination
offset beyond results
correct total before pagination
full collection not unintentionally paginated
default deterministic sorting
approved explicit sorting
invalid sort field
source array not mutated
mobile projection input not mutated
PLN resolution
display-name resolution
no inferred home port
no inferred identifiers
stable collection ETag
filtered-response ETag policy
matching If-None-Match
non-matching If-None-Match
304 with no body
304 with ETag
304 with correlation header
Cache-Control behaviour
standard 400 response
standard 404 response
standard 503 response
safe unexpected 500 response
no stack trace
no raw Hapi, validation, cache, or persistence error
no direct S3 access
no Floci call
no cache-refresh trigger
no full vessel identifiers in logs
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
3. Explain whether the issue blocks Step 16.
4. Do not expand scope silently.
5. Do not weaken tests to make them pass.
6. Ask for clarification if resolving the issue requires a vessel schema, mobile API, security, compatibility, or architectural decision.

## Completion response

Provide a concise implementation report containing:

- Repository state discovered
- Saved plan filename
- Vessel endpoints implemented
- Canonical response behaviour
- Mobile projection behaviour
- PLN resolution rule
- Display-name resolution rule
- Search fields and matching rules
- Exact identifier filters
- Multiple-filter behaviour
- Active and inactive vessel policy
- Pagination behaviour
- Sorting behaviour
- Individual-item response convention
- ETag source
- Filtered-response ETag policy
- Conditional-request behaviour
- Cache-Control behaviour
- Error mappings
- Correlation behaviour
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
- Existing issues not introduced by Step 16
- Work deferred to later steps
- Remaining assumptions, risks, or owner decisions
  if you reach any ambiguity ask me to clarify
