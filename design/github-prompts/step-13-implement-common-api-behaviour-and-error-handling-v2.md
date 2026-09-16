# Step 13: Implement Common API Behaviour and Error Handling

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
5. Inspect the existing Hapi.js server, routes, controllers, validation, normalisation, persistence, cache refresh, in-memory store, logging, configuration, and tests.
6. Inspect all existing error classes and error-mapping functions.
7. Identify any existing common HTTP behaviour that should be retained or aligned.
8. Produce a repository-specific implementation plan based on the code that actually exists.
   Do not assume the repository is empty.

Do not duplicate suitable existing error handling, response mapping, correlation, conditional-request, or route-validation mechanisms.

After completing the plan, save it as:

Plain Text

```text
github-prompts/Step 13-implement-common-api-behaviour-and-error-handling-plan.md
```

Assume the saved plan is approved and continue directly with implementation unless:

- The plan conflicts with the approved Reference Data Service design.
- A required upstream contract is missing.
- A public API decision is ambiguous.
- A change would break an existing approved API contract.
- The implementation requires destructive or out-of-scope changes.
- A security or privacy decision requires owner input.
  The approved plan must be saved before implementation begins.

## Objective

Implement the common API behaviour and error-handling foundation used by all Reference Data Service HTTP endpoints.

The implementation must provide a consistent, secure, and testable Hapi.js API boundary for:

- Request correlation
- Authentication context propagation where already available
- Request validation failure mapping
- Domain error mapping
- Persistence error mapping
- Cache and service-availability error mapping
- Unexpected error handling
- Standard response headers
- JSON and GeoJSON content types
- ETag and conditional request processing
- Pagination and query-parameter conventions where common behaviour is required
- Safe structured logging
- Consistent API error responses
- `404` handling for unmatched routes
- Safe `500` handling
- Hapi.js response-toolkit integration
- API response schema consistency
  This step establishes common behaviour only.

Do not implement all dataset query endpoints, collection upload endpoints, authentication-service integration, mobile projections, or deployment infrastructure unless a minimal integration point is already required by the repository.

## Project context

The Reference Data Service is a Node.js and Hapi.js backend service for the Catch Recording application.

The service manages:

- Vessels
- Gears
- Ports
- Species
- Map land
- Map statistical areas
  Reference data is persisted as complete JSON or GeoJSON files in S3 and held as canonical parsed objects in process-local memory.

The API will support:

- Manifest retrieval
- Complete collection retrieval
- Dataset search
- Individual item retrieval
- Map-location retrieval
- Validation-only full collection uploads
- Atomic full collection replacement
  The API does not support item-level create, update, patch, or delete operations.

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
  Preserve these architectural boundaries:

1. The **Reference Data Controller** owns HTTP request and response mapping.
2. The **Validation Module** owns structural and business validation.
3. The **Validation Module** is the only component permitted to call the Authentication Service.
4. The **Persistence Module** is the only component permitted to access S3 or Floci.
5. The Query Module reads reference data through the In-Memory Data Store.
6. The Command Module coordinates complete collection updates.
7. API error mapping must not contain S3 SDK logic.
8. Controllers must not inspect raw AWS SDK errors.
9. Controllers must not perform canonical normalisation.
10. Controllers must not embed dataset business rules.
11. Common HTTP behaviour must remain separate from domain behaviour.
12. API errors must not expose internal implementation details.
13. Redis or another external cache must not be introduced.

## Existing decisions to preserve

Preserve all approved repository decisions, including:

- GUIDs are stable technical identifiers.
- Business identifiers remain separate from GUIDs.
- Canonical data remains aligned with legacy schemas wherever practical.
- Map-location data is the principal new reference-data domain.
- `map-ports` is derived and not independently uploaded.
- Normal `npm test` remains Docker-free.
- Floci integration tests use the separate existing command.
- The existing bucket configuration is reused.
- Specific S3 error-name mapping takes precedence over generic HTTP-status mapping.
- `NoSuchBucket` must not be mapped as an ordinary missing object merely because both may carry HTTP status `404` .
- Expected domain failures must remain distinguishable from unexpected internal failures.
- Complete collection contents, credentials, and tokens must not be written to logs.
- Validation and normalisation issue ordering must remain deterministic.
- Work assigned to later endpoint-specific steps must not be implemented prematurely.

## Repository assessment

Before writing the plan, inspect the repository for:

### Hapi.js implementation

- Server bootstrap
- Plugin registration
- Route registration
- Lifecycle hooks
- `onRequest` , `onPreHandler` , `onPreResponse` , and related extensions
- Authentication strategy placeholders
- Validation configuration
- Response validation
- Request payload limits
- Route defaults
- Existing health and readiness routes
- Existing not-found handling
- Existing server error handling

### Error model

- Domain error base classes
- Validation errors
- Normalisation errors
- Persistence errors
- Cache or hydration errors
- Configuration errors
- Authentication and authorisation errors
- Existing error codes
- Existing error mapping
- Existing Boom usage, if any
- Existing HTTP status mapping
- Retryable error metadata
- Stack-trace handling
- Existing tests for specific and generic errors

### API response behaviour

- Current response envelopes
- HTTP status codes
- Response headers
- JSON and GeoJSON content types
- ETag handling
- `If-None-Match`
- `If-Match`
- Pagination conventions
- Correlation ID handling
- Request logging
- CORS configuration
- Security headers
- Cache-Control behaviour
- Content negotiation
- API versioning
- Route naming conventions

### Validation integration

- Hapi route validation
- Domain validation results
- Joi error mapping
- Validation issue paths
- Maximum issue count
- Rejected-value handling
- Query-string validation
- Path-parameter validation
- Payload validation

### Testing

- Controller tests
- Server-injection tests
- Error-mapping tests
- Integration-test conventions
- Security-header tests
- Correlation tests
- Snapshot testing, if any
- Coverage configuration
- Floci-specific test configuration
  Retain compatible repository conventions.

Do not introduce another HTTP-error framework if the existing framework can satisfy the approved contract.

## Base API contract

Use the approved API base path:

Plain Text

```text
/api/v1/reference-data
```

Do not implement every endpoint in this step, but configure common API behaviour so later routes can use it consistently.

Existing health and readiness routes may remain outside this base path according to current repository conventions.

Do not rename existing approved routes without documenting the compatibility impact in the plan.

## Standard error envelope

Implement or align the common API error response with this conceptual structure:

JSON

```text
{
  "error": {
    "code": "validation_failed",
    "message": "The request contains validation errors.",
    "traceId": "42e9acba-016e-47af-841d-903bd8e9dc36",
    "dataset": "ports",
    "retryable": false,
    "details": []
  }
}
```

Adapt optional properties to the existing approved repository contract.

### Required properties

Every API error must include:

- `code`
- `message`
- `traceId`

### Optional properties

Include only when relevant:

- `dataset`
- `retryable`
- `details`

### Error-envelope rules

- Do not include properties with `undefined` values.
- Do not return raw JavaScript errors.
- Do not return raw Joi errors.
- Do not return raw Boom payloads if those conflict with the approved error envelope.
- Do not return raw AWS SDK errors.
- Do not expose stack traces.
- Do not expose internal file paths.
- Do not expose S3 object keys unnecessarily.
- Do not expose dependency URLs.
- Do not expose credentials or tokens.
- Keep error codes stable and machine-readable.
- Keep messages safe and understandable.
- Keep detail ordering deterministic.
- Keep the public contract independent from implementation-library error shapes.

## Correlation identifiers

Implement or align request correlation behaviour.

### Request header

Accept:

HTTP

```text
X-Correlation-Id: <guid>
```

### Response header

Return:

HTTP

```text
X-Correlation-Id: <guid>
```

### Behaviour

- If a valid correlation ID is supplied, preserve it.
- If no correlation ID is supplied, generate one.
- If an invalid correlation ID is supplied, follow the existing approved policy or reject it with a structured `400` .
- Use the same correlation identifier in the response header, error `traceId` , and structured request logs.
- Make the identifier available to controllers and downstream application services without coupling domain code to Hapi.js.
- Propagate it to external calls where those integrations already exist.
- Do not use a predictable sequential identifier.
- Do not accept control characters or unbounded header values.
- Do not treat a user-provided correlation ID as trusted authorisation data.
  Use the existing GUID policy and generator where available.

## Request logging

Implement or align structured request logging.

Log safe summaries for:

- Request received
- Method
- Normalised route identifier
- Correlation identifier
- Response status
- Request duration
- Dataset route parameter where safe
- Authenticated subject identifier only if the existing security policy permits it
- Error code
- Retryable status
- Response completion
  Do not log:

- Bearer tokens
- Credentials
- Complete uploaded collection files
- Complete response collections
- Complete GeoJSON geometry
- Sensitive vessel identifiers
- Raw request headers
- Raw multipart bodies
- Stack traces for expected client errors
  Unexpected internal failures may include protected diagnostic stack traces in server logs according to repository conventions.

Avoid duplicate request logs from multiple lifecycle extensions.

## Error classification

The mapping layer must classify errors by explicit type, name, or stable domain code before considering generic status metadata.

Use this precedence:

1. Known domain error class or stable error code
2. Known persistence error class or stable persistence code
3. Known validation or normalisation result
4. Known authentication or authorisation error
5. Known service-availability or timeout error
6. Explicit safe HTTP error produced by the API boundary
7. Generic HTTP status metadata
8. Unexpected internal error fallback
   Do not check a blanket status such as `404` before checking a more specific error type or name.

This requirement preserves the existing fix where `NoSuchBucket` must not fall into a generic missing-object branch.

## HTTP status mapping

Reuse approved error codes where they already exist.

Implement or align mappings equivalent to the following.

### `400 Bad Request`

Use for:

Plain Text

```text
invalid_request
invalid_dataset
invalid_json
invalid_query_parameter
invalid_path_parameter
invalid_correlation_id
malformed_payload
```

### `401 Unauthorized`

Use for:

Plain Text

```text
unauthorized
missing_access_token
invalid_access_token
expired_access_token
```

Do not return `403` solely because the caller is unauthenticated.

### `403 Forbidden`

Use for:

Plain Text

```text
forbidden
insufficient_permission
``
```

### `404 Not Found`

Use for:

Plain Text

```text
route_not_found
dataset_not_found
reference_item_not_found
map_layer_not_found
reference_object_not_found
```

Do not use ordinary `404` item semantics for a missing configured S3 bucket.

### `409 Conflict`

Use for:

Plain Text

```text
collection_version_exists
collection_modified
duplicate_identifier
duplicate_business_code
etag_mismatch
precondition_failed
```

### `412 Precondition Failed`

If the approved API design maps failed HTTP preconditions directly to `412` , use it consistently for:

Plain Text

```text
if_match_failed
if_none_match_failed
```

If the existing approved API contract maps these to `409` , retain the existing decision and document it.

Do not mix `409` and `412` for the same public condition without a clear rule.

### `413 Content Too Large`

Use for:

Plain Text

```text
file_too_large
payload_too_large
```

Use the status-name conventions supported by the current Hapi.js and Node.js versions.

### `415 Unsupported Media Type`

Use for:

Plain Text

```text
unsupported_media_type
unsupported_file_format
```

### `422 Unprocessable Entity`

Use for:

Plain Text

```text
schema_validation_failed
business_validation_failed
collection_validation_failed
normalisation_failed
```

Do not map syntactically invalid JSON to `422` ; malformed JSON is a `400` .

### `429 Too Many Requests`

Use only if rate limiting already exists or is explicitly approved:

Plain Text

```text
rate_limit_exceeded
```

Do not implement a new rate-limiting platform solely for this step.

### `500 Internal Server Error`

Use for:

Plain Text

```text
internal_server_error
```

The public message must be generic.

### `503 Service Unavailable`

Use for:

Plain Text

```text
authentication_service_unavailable
reference_store_unavailable
reference_data_unavailable
startup_hydration_incomplete
mandatory_dataset_unavailable
```

Include `Retry-After` only when a meaningful retry period is known.

### `504 Gateway Timeout`

Use only when the service itself has a defined downstream timeout condition that the approved API maps to `504` :

Plain Text

```text
dependency_timeout
```

Otherwise retain the repository's existing `503` timeout policy.

## Validation error mapping

Map Hapi.js or Joi validation failures into the approved error envelope.

Requirements:

- Convert library-specific error types into stable API codes.
- Preserve safe field paths.
- Convert route parameter errors, query errors, header errors, and payload errors consistently.
- Return all safely available validation issues where the route validator supports this.
- Preserve deterministic detail ordering.
- Avoid returning Joi internals such as context labels that expose implementation details.
- Avoid returning the complete rejected object.
- Respect maximum detail limits.
- Include a truncation indication when issue output is limited.
- Keep request validation failures separate from collection business-validation failures.
- Use `400` for malformed request structure.
- Use `422` for a structurally parsed complete collection that fails schema or business validation according to the approved upload design.
  Do not duplicate common domain validation inside route schemas.

## Domain validation and normalisation mapping

Map domain validation results into API errors without changing the underlying issue semantics.

### Structural or schema validation

Conceptual response:

HTTP

```text
422 Unprocessable Entity
```

JSON

```text
{
  "error": {
    "code": "schema_validation_failed",
    "message": "The reference-data collection does not conform to the required schema.",
    "traceId": "42e9acba-016e-47af-841d-903bd8e9dc36",
    "dataset": "ports",
    "retryable": false,
    "details": [
      {
        "path": "items[0].id",
        "code": "invalid_guid",
        "message": "The value must be a valid GUID."
      }
    ]
  }
}
```

### Business validation

Conceptual response:

HTTP

```text
422 Unprocessable Entity
``
```

JSON

```text
{
  "error": {
    "code": "business_validation_failed",
    "message": "The reference-data collection contains business-rule violations.",
    "traceId": "42e9acba-016e-47af-841d-903bd8e9dc36",
    "dataset": "ports",
    "retryable": false,
    "details": [
      {
        "path": "items[4].code",
        "code": "duplicate_business_code",
        "message": "The port code is used more than once."
      }
    ]
  }
}
```

### Normalisation failure

Conceptual response:

HTTP

```text
422 Unprocessable Entity
```

JSON

```text
{
  "error": {
    "code": "normalisation_failed",
    "message": "The reference-data collection could not be normalised safely.",
    "traceId": "42e9acba-016e-47af-841d-903bd8e9dc36",
    "dataset": "map-statistical-areas",
    "retryable": false,
    "details": [
      {
        "path": "features[0].geometry.coordinates",
        "code": "ambiguous_coordinate_reference_system",
        "message": "The source coordinate reference system is required."
      }
    ]
  }
}
``
```

Do not expose complete original or normalised values.

## Persistence error mapping

Reuse the Persistence Module's stable domain error model.

The API layer must not inspect raw AWS SDK exceptions.

Preserve these distinctions:

- Missing configured bucket
- Missing object
- Access denied
- Invalid object content
- Precondition failure
- Version conflict
- Storage timeout
- Transient storage failure
- Unexpected storage failure
  Conceptual mappings:

Plain Text

```text
missing object required by a request
  -> 404 reference_object_not_found

missing configured bucket
  -> 503 reference_store_unavailable

access denied to configured bucket
  -> 503 reference_store_unavailable

precondition failure during an update
  -> 409 or 412 according to the approved public contract

transient storage failure
  -> 503 reference_store_unavailable

unexpected persistence failure
  -> 500 internal_server_error
```

Do not expose AWS error names such as `NoSuchBucket` directly as public API codes unless already approved.

Keep detailed dependency error information in protected logs.

## Cache and hydration error mapping

Use Cache Refresh Module and readiness-state contracts rather than raw implementation exceptions.

Map conditions such as:

- Mandatory data not hydrated
- Dataset unavailable in memory
- Startup hydration incomplete
- Mandatory dataset invalid
- Previous data unavailable after refresh failure
  Conceptual response:

HTTP

```text
503 Service Unavailable
Retry-After: 30
```

JSON

```text
{
  "error": {
    "code": "reference_data_unavailable",
    "message": "The requested reference data is temporarily unavailable.",
    "traceId": "42e9acba-016e-47af-841d-903bd8e9dc36",
    "dataset": "species",
    "retryable": true
  }
}
```

Do not return a successful empty collection when a mandatory dataset is unavailable.

Do not expose complete cache state or manifest details.

## Unexpected error handling

Implement a final safe fallback for unexpected errors.

Requirements:

- Return `500 Internal Server Error` .
- Use code: Plain Text 1 internal_server_error
- Use a generic public message.
- Include the request correlation ID as `traceId` .
- Log the original error in protected structured logs.
- Do not include stack traces in responses.
- Do not expose error messages from unknown exceptions.
- Do not return Hapi.js default HTML error pages.
- Do not allow response-mapping failures to recurse indefinitely.
- Ensure the fallback works for errors thrown during response handling.
  Conceptual response:

JSON

```text
{
  "error": {
    "code": "internal_server_error",
    "message": "An unexpected error occurred.",
    "traceId": "42e9acba-016e-47af-841d-903bd8e9dc36",
    "retryable": false
  }
}
```

## Not-found route handling

Implement a consistent JSON response for unmatched routes.

Conceptual response:

HTTP

```text
404 Not Found
``
```

JSON

```text
{
  "error": {
    "code": "route_not_found",
    "message": "The requested resource was not found.",
    "traceId": "42e9acba-016e-47af-841d-903bd8e9dc36",
    "retryable": false
  }
}
```

Requirements:

- Do not expose the server's route registry.
- Do not suggest internal routes.
- Preserve the correlation header.
- Return JSON, not HTML.
- Do not confuse an unmatched route with a missing reference-data item.

## Common successful response behaviour

Establish reusable response helpers or controller-boundary conventions for successful responses.

Support:

- JSON content type
- GeoJSON content type
- ETag
- Cache-Control
- Correlation header
- Conditional responses
- Optional Last-Modified where approved
- Safe response validation
- Correct empty-body behaviour for `304`
  Do not require every controller to construct common headers manually.

Avoid hiding domain response construction in generic helpers.

## Content types

### JSON

Use:

HTTP

```text
Content-Type: application/json
```

### GeoJSON

Use:

HTTP

```text
Content-Type: application/geo+json
```

### Error responses

Use:

HTTP

```text
Content-Type: application/json
```

Do not return GeoJSON content type for an error response from a map endpoint.

### Upload requests

Support for multipart or JSON upload content types belongs to the upload-specific step. This step may establish common unsupported-media-type handling but must not implement full upload parsing.

## ETag behaviour

Provide common ETag utilities or response behaviour for later query and upload routes.

Requirements:

- Treat ETags as opaque values.
- Preserve the existing repository representation, including quoting rules.
- Support strong ETags where the approved metadata provides them.
- Do not calculate ETags by serialising a response differently in every controller.
- Use collection metadata from the in-memory store or persistence contracts where appropriate.
- Do not expose raw S3 ETag semantics as a guarantee when multipart or encryption behaviour could make that misleading.
- Keep collection checksum and HTTP ETag concepts distinct where the repository distinguishes them.

## `If-None-Match`

For safe retrieval endpoints:

- Compare the request value with the active response ETag.
- Return `304 Not Modified` when matched.
- Return no response body with `304` .
- Include the applicable ETag.
- Preserve the correlation header.
- Follow approved Cache-Control behaviour.
- Support multiple ETags or wildcard only if the repository's selected utility correctly implements HTTP semantics.
- Do not use simple substring matching.
- Do not treat malformed values as a successful match.

## `If-Match`

For future update endpoints:

- Provide a common parser or precondition helper.
- Treat ETags as opaque values.
- Return the approved `409` or `412` mapping when no supplied ETag matches.
- Do not implement the full collection update route in this step.
- Keep precondition evaluation separate from persistence write logic.
- Do not silently ignore an `If-Match` header when a route declares it required.

## Cache-Control

Establish explicit cache behaviour.

For versioned reference-data read responses, prepare support for the approved policy equivalent to:

HTTP

```text
Cache-Control: public, max-age=3600, stale-while-revalidate=86400
```

Do not blindly apply public caching to:

- Error responses
- Administrative upload responses
- Authentication-related responses
- Health or readiness responses
- Responses containing caller-specific data
  Make route-specific cache policy explicit.

If API Gateway or another edge layer will later override caching, document the service-layer behaviour.

## Pagination conventions

Establish shared parsing and response conventions for later search endpoints.

The approved query concepts are:

Plain Text

```text
limit
offset
sort
```

Requirements:

- Parse query values strictly.
- Use configurable default and maximum limits.
- Reject negative values.
- Reject non-integer values.
- Reject limits above the configured maximum or clamp only if explicitly approved.
- Use deterministic defaults.
- Do not apply pagination to explicit full-collection responses unless the route contract says so.
- Do not implement dataset search in this step.
- Keep pagination metadata consistent.
  A future paginated response is expected to contain concepts equivalent to:

JSON

```text
{
  "total": 125,
  "offset": 0,
  "limit": 50,
  "items": []
}
```

Do not add pagination properties to non-paginated canonical collection envelopes without an approved API decision.

## Query-parameter conventions

Prepare consistent common parsing for:

Plain Text

```text
view
query
code
ids
codes
limit
offset
sort
includeInactive
```

Do not implement dataset-specific search semantics.

Requirements:

- Reject repeated scalar values unless explicitly supported.
- Parse booleans strictly.
- Preserve business codes as strings.
- Preserve leading zeros.
- Parse comma-separated lists according to one documented policy.
- Trim list separators safely.
- Reject empty list members where appropriate.
- Bound list length.
- Validate GUID lists.
- Keep validation details safe.
- Avoid silently interpreting unknown query parameters unless the route allows them.

## Response validation

Use Hapi.js response validation where compatible with repository conventions and performance requirements.

Requirements:

- Validate representative response structures in tests.
- Do not expose internal validation failures to clients.
- Treat response-schema failure as an internal server error.
- Log the response-schema mismatch safely.
- Avoid serialising complete large collections solely for duplicate validation passes unless justified.
- Allow GeoJSON responses to use appropriate schemas.
- Reuse common error schemas.
  If production response validation is disabled for performance, retain test-time contract validation and document the decision.

## Security headers

Use the repository's existing security-header mechanism.

Review and configure relevant headers such as:

Plain Text

```text
X-Content-Type-Options
Referrer-Policy
Content-Security-Policy where relevant
Strict-Transport-Security in deployed HTTPS contexts
```

Do not blindly add browser-oriented headers that conflict with API Gateway or existing platform policy.

Do not configure permissive CORS by default.

## CORS

Do not enable wildcard CORS unless explicitly required and approved.

If CORS is already configured:

- Preserve allowlisted origins.
- Preserve allowed methods.
- Preserve allowed headers.
- Include `X-Correlation-Id` , `ETag` , and any required conditional headers where appropriate.
- Do not permit credentials with wildcard origins.
- Document environment-specific origin configuration.
  If the mobile client does not require browser CORS, do not introduce it.

## Payload and header limits

Use existing Hapi.js and configuration limits.

Requirements:

- Bound request headers.
- Bound query-list lengths.
- Bound request payloads.
- Prepare upload-specific limits without implementing upload parsing.
- Reject oversized payloads with the approved `413` error.
- Do not buffer unlimited input.
- Do not echo oversized rejected values.
- Keep limits configurable where appropriate.
- Document units and defaults.

## Retry-After behaviour

Use `Retry-After` only for retryable temporary conditions where the service can provide a meaningful value.

Potential cases:

- Reference data not yet hydrated
- Temporary persistence unavailability
- Authentication Service unavailability
  Requirements:

- Use one valid HTTP representation.
- Do not use negative values.
- Do not provide false precision.
- Keep the value configurable where applicable.
- Do not include `Retry-After` on non-retryable validation errors.

## Error details and redaction

Error-detail mapping must be allowlist-based.

Permitted detail concepts may include:

- Safe field path
- Stable issue code
- Safe issue message
- Safe expected type
- Safe maximum or minimum
- Safe dataset identifier
  Do not include by default:

- Complete rejected objects
- Complete collection records
- S3 object content
- Complete object keys
- Credentials
- Tokens
- Internal hostnames
- Internal file-system paths
- Stack traces
- SQL or query internals
- Complete vessel identifiers
- Dependency response bodies
  When a rejected scalar value is safe and useful, include it only according to the existing redaction policy.

## Error mapping implementation design

Prefer a small, explicit error-mapper registry or ordered mapping pipeline.

The design must:

- Prioritise specific domain error types.
- Remain deterministic.
- Be independently testable.
- Avoid one large sequence of loosely related conditions where practical.
- Avoid checking generic status codes too early.
- Avoid mutating the source error.
- Preserve `cause` internally where supported.
- Produce one public error contract.
- Keep controller code concise.
- Allow later modules to add stable error mappings without rewriting all routes.
  Do not use error message text matching when a stable class, name, or code exists.

## Hapi.js lifecycle integration

Implement common API behaviour through the smallest appropriate combination of:

- Server extensions
- Plugins
- Route defaults
- Response helpers
- Controller adapters
- Error mapper
  Avoid registering duplicate lifecycle hooks.

The implementation should cover:

- Correlation setup early in request processing
- Request timing
- Standard error mapping before response completion
- Safe structured request completion logging
- Response headers
- Not-found mapping
- Unexpected error fallback
  Ensure an already valid `304` response is not converted into a JSON error or given a body.

## Health and readiness exclusions

Preserve existing liveness and readiness contracts.

Requirements:

- Apply correlation identifiers consistently if existing contracts permit it.
- Do not apply public cache headers to health or readiness.
- Do not map ordinary not-ready state to process failure.
- Do not expose internal cache or S3 details.
- Do not change the meaning of health or readiness in this step.
- Reuse the readiness-state contract from Step 11.

## Public API documentation preparation

Update or establish reusable OpenAPI components if the repository already contains an OpenAPI document.

Prepare common components for:

- Error envelope
- Validation detail
- Correlation header
- ETag header
- `If-None-Match`
- `If-Match`
- Pagination query parameters
- Standard error responses
- `304 Not Modified`
- JSON content
- GeoJSON content
  Do not document unimplemented endpoint behaviour as available.

If complete OpenAPI work belongs to a later step, add only the common components needed by implemented routes and document the remainder as deferred.

## Unit test requirements

Add comprehensive Docker-free tests.

### Error-envelope construction

Test:

- Required properties
- Optional dataset
- Optional retryable flag
- Optional details
- Undefined properties omitted
- Stable property shape
- Safe message
- Trace ID inclusion
- No stack trace
- No internal cause
- No raw library error

### Error precedence

Test:

- Specific error class before generic status
- Specific error name before generic status
- Stable domain code before generic status
- `NoSuchBucket` does not become object not found
- Missing object maps correctly
- Access denied maps correctly
- Precondition failure maps correctly
- Unknown `404` follows the defined fallback
- Unknown error becomes safe `500`

### HTTP mappings

Test representative mappings for:

- `400`
- `401`
- `403`
- `404`
- `409`
- `412` , if approved
- `413`
- `415`
- `422`
- `429` , if supported
- `500`
- `503`
- `504` , if supported

### Correlation

Test:

- Valid supplied correlation ID
- Missing correlation ID generates one
- Invalid correlation ID policy
- Response header matches request context
- Error trace ID matches header
- Request log uses the same identifier
- Correlation identifier survives expected errors
- Correlation identifier survives unexpected errors

### Validation mapping

Test:

- Route path validation failure
- Query validation failure
- Header validation failure
- Payload validation failure
- Multiple validation issues
- Deterministic detail ordering
- Maximum detail limit
- Safe rejected values
- Structural collection failure
- Business-validation failure
- Normalisation failure
- Validation warnings are not returned as errors

### Conditional requests

Test:

- Matching `If-None-Match`
- Non-matching `If-None-Match`
- `304` has no body
- `304` preserves ETag
- `304` preserves correlation header
- Quoted ETag handling
- Weak versus strong ETag policy
- Malformed conditional header
- Future `If-Match` success
- Future `If-Match` failure
- Wildcard behaviour if supported

### Content and cache headers

Test:

- JSON response content type
- GeoJSON response content type
- Error response remains JSON
- Read response cache policy
- Error response is not publicly cached
- Health is not publicly cached
- Readiness is not publicly cached
- Correlation header appears consistently
- `X-Content-Type-Options` or existing equivalent

### Pagination and query parsing

Test:

- Default limit
- Maximum limit
- Limit above maximum
- Negative limit
- Non-integer limit
- Default offset
- Negative offset
- Strict boolean parsing
- Comma-separated GUID parsing
- Comma-separated business-code parsing
- Leading-zero code preservation
- Empty list member
- List-size limit
- Unknown parameter policy

### Hapi.js lifecycle

Test:

- Successful response
- Known domain error
- Known persistence error
- Validation error
- Unmatched route
- Unexpected handler error
- Error thrown during response processing
- No duplicate request-completion logs
- Request duration recorded
- `304` not transformed
- HTML error page never returned for API errors

### Redaction

Test:

- Token excluded
- Credentials excluded
- Stack trace excluded
- Cause excluded
- Full collection excluded
- Unsafe rejected value excluded
- Safe path retained
- Safe code retained
- Vessel identifiers not logged unexpectedly

## Integration test requirements

Use Hapi.js `server.inject` or the repository's existing Docker-free HTTP integration-test approach.

Add representative test routes or use existing implemented routes to verify:

1. Correlation header generation.
2. Correlation header preservation.
3. Successful JSON response headers.
4. Successful GeoJSON response headers where an existing route supports GeoJSON.
5. Structured route-validation error.
6. Structured domain-validation error.
7. Structured persistence error.
8. Structured cache-unavailable error.
9. Structured unmatched-route response.
10. Structured unexpected `500` .
11. No stack trace in responses.
12. No raw Boom payload.
13. No raw Joi payload.
14. No raw AWS error.
15. Correct ETag behaviour.
16. Correct `304` empty body.
17. Correct Cache-Control behaviour.
18. Correct request-completion logging.
19. Health and readiness contracts remain intact.
20. Normal test execution remains Docker-free.
    Do not require Floci for these tests.

## Persistence regression tests

Run the existing persistence suite to ensure common API error handling does not alter Persistence Module semantics.

At minimum confirm:

- `NoSuchBucket` mapping remains distinct.
- `NoSuchKey` or missing-object mapping remains distinct.
- `AccessDenied` remains distinct.
- `PreconditionFailed` remains distinct.
- Non- `412` write failures remain covered.
- Specific error checks occur before generic `404` .
- Raw AWS errors do not escape the persistence boundary.
  Do not rewrite persistence error mapping solely to make API tests easier.

## Cache refresh regression tests

Run Step 11 tests to ensure:

- Startup hydration failures remain distinguishable.
- Dataset-refresh failures retain their stages.
- Retryable status remains available.
- No public error mapper mutates cache-refresh results.
- Readiness behaviour remains correct.
- Background refresh failure does not become an unhandled rejection.

## Security and privacy requirements

- Treat all request input as untrusted.
- Reject malformed and oversized requests safely.
- Do not echo bearer tokens.
- Do not echo credentials.
- Do not expose stack traces.
- Do not expose raw dependency errors.
- Do not disclose bucket existence differently to unauthorised callers when that would create an information leak.
- Do not log full uploads or collection responses.
- Do not log complete GeoJSON geometry.
- Do not log complete vessel identifiers.
- Use allowlisted error-detail properties.
- Apply safe correlation-header limits.
- Avoid response splitting.
- Avoid unrestricted CORS.
- Avoid wildcard credentialed origins.
- Avoid catastrophic regular expressions in query validation.
- Bound list parameters and issue details.
- Keep the unexpected-error response generic.
- Preserve full diagnostic information only in protected logs.
- Review any new dependency for security, maintenance, and licence impact.

## Performance requirements

- Avoid repeated error serialisation.
- Avoid deep cloning errors.
- Avoid copying complete collection payloads into error context.
- Keep error mapping constant-time except for bounded validation details.
- Bound the number of returned validation details.
- Avoid duplicate response validation for large collections without justification.
- Avoid duplicate request logging.
- Avoid calculating ETags from full response serialisation when metadata already provides a stable ETag.
- Use reusable schemas and compiled validators where supported.
- Keep lifecycle hooks minimal.
- Measure request duration without blocking the event loop.

## Logging and observability

Follow existing structured logging conventions.

Expected request-completion fields may include:

Plain Text

```text
event
correlationId
method
route
statusCode
durationMs
dataset
errorCode
retryable
```

Do not use raw URL values as unbounded metric labels.

If metrics hooks already exist, prepare or emit bounded events for:

Plain Text

```text
api_requests_total
api_request_duration
api_errors_total
api_validation_failures_total
api_dependency_failures_total
```

Use bounded labels such as:

Plain Text

```text
method
route identifier
status code
error code
dataset
```

Do not include:

- Correlation IDs as metric labels
- Collection GUIDs as metric labels
- Object keys as metric labels
- Arbitrary request paths as metric labels
  If production metrics export belongs to a later step, retain hooks and document the deferred exporter.

## Documentation requirements

Update the appropriate repository documentation with:

- Standard error envelope
- Error-code convention
- HTTP status mapping
- Error precedence
- Correlation-header behaviour
- Validation-detail behaviour
- Redaction policy
- ETag behaviour
- `If-None-Match`
- Future `If-Match` support
- Cache-Control policy
- JSON and GeoJSON content types
- Pagination conventions
- Query parsing conventions
- Hapi.js lifecycle integration
- Not-found handling
- Unexpected-error handling
- Health and readiness exclusions
- Security considerations
- Performance considerations
- Testing instructions
- Persistence regression expectations
- Work deferred to endpoint-specific steps
  Include concise request and response examples.

## Explicit exclusions

Do not implement:

- Complete manifest endpoint behaviour
- Full collection-retrieval endpoints
- Dataset-specific search
- Individual-item retrieval
- Map query endpoints
- Mobile response projections
- Multipart collection uploads
- Validation-only upload endpoint
- Atomic collection replacement
- Public refresh endpoint
- Authentication Service integration unless already implemented by an approved earlier step
- API Gateway deployment
- Fargate deployment
- Production IAM
- Distributed rate limiting
- Redis
- Item-level mutation endpoints
- New CORS requirements without approval
- Full OpenAPI coverage for unimplemented endpoints
- Reimplementation of persistence S3 error classification in the API layer

## Required plan content

The implementation plan must include:

1. Current Hapi.js server and route structure.
2. Current controller structure.
3. Existing common response behaviour.
4. Existing error classes and hierarchy.
5. Existing error-mapping precedence.
6. Existing validation and normalisation errors.
7. Existing persistence and cache-refresh errors.
8. Existing correlation behaviour.
9. Existing logging behaviour.
10. Existing ETag and conditional-request utilities.
11. Existing API schemas or OpenAPI components.
12. Existing conventions to retain.
13. Gaps against this step.
14. Proposed standard error envelope.
15. Proposed error-classification precedence.
16. Proposed HTTP status mapping.
17. Proposed validation-error mapping.
18. Proposed persistence-error mapping.
19. Proposed cache and readiness error mapping.
20. Proposed unexpected-error fallback.
21. Proposed correlation implementation.
22. Proposed Hapi.js lifecycle integration.
23. Proposed successful-response helpers.
24. Proposed ETag and conditional-request behaviour.
25. Proposed Cache-Control behaviour.
26. Proposed pagination and query conventions.
27. Proposed redaction policy.
28. Proposed security-header and CORS position.
29. Proposed payload and header limits.
30. Proposed logging and metrics.
31. Exact files to create.
32. Exact files to modify.
33. Files intentionally left unchanged.
34. Unit-test approach.
35. HTTP integration-test approach.
36. Persistence regression-test approach.
37. Cache-refresh regression-test approach.
38. Documentation updates.
39. Security and privacy considerations.
40. Performance considerations.
41. Verification commands.
42. Assumptions and unresolved ambiguities.
43. Work explicitly deferred to later steps.

## Expected deliverables

- Approved plan saved as: Plain Text 1 github-prompts/Step 13-implement-common-api-behaviour-and-error-handling-plan.md
- Standard API error-envelope contract.
- Stable common API error codes.
- Ordered error-classification and mapping implementation.
- Route-validation error mapping.
- Domain-validation error mapping.
- Normalisation-error mapping.
- Persistence-error mapping.
- Cache and readiness error mapping.
- Safe unexpected-error fallback.
- JSON unmatched-route response.
- Correlation-ID handling.
- Standard correlation response header.
- Safe structured request logging.
- Common JSON response behaviour.
- Common GeoJSON response behaviour.
- ETag utilities or common behaviour.
- `If-None-Match` processing.
- Future-compatible `If-Match` processing.
- Explicit Cache-Control policies.
- Shared pagination and query-parsing conventions.
- Error-detail redaction.
- Security-header alignment.
- Docker-free unit tests.
- Docker-free API integration tests.
- Persistence regression verification.
- Cache-refresh regression verification.
- Updated API documentation.
- Step completion report.

## Acceptance criteria

- The plan is saved before implementation begins.
- The implementation follows existing repository conventions.
- Every API error includes `code` , `message` , and `traceId` .
- Optional error properties are included only when relevant.
- Errors use stable machine-readable codes.
- Specific error types and names are checked before generic HTTP status values.
- `NoSuchBucket` cannot fall into a generic object-not-found branch.
- Raw AWS SDK errors do not escape the Persistence Module.
- Raw Joi errors do not reach clients.
- Raw Boom responses do not replace the approved error envelope.
- Stack traces do not appear in API responses.
- Unknown errors return a safe `500` .
- Unmatched routes return a JSON `route_not_found` error.
- Correlation identifiers are generated when missing.
- Valid supplied correlation identifiers are preserved.
- Response correlation headers match error `traceId` values.
- Correlation identifiers appear in structured request logs.
- Request logs do not contain tokens or complete collections.
- Structural and business-validation failures remain distinguishable.
- Normalisation failures remain distinguishable.
- Missing reference objects and missing configured buckets remain distinguishable.
- Cache and startup availability failures map safely.
- Retryable status is included only when meaningful.
- `Retry-After` is included only for appropriate temporary failures.
- JSON responses use the correct content type.
- GeoJSON success responses use the correct content type.
- GeoJSON endpoint errors remain JSON.
- Matching `If-None-Match` returns `304` .
- `304` responses contain no body.
- ETags are treated as opaque values.
- Public caching is not applied to error, health, readiness, or administrative responses.
- Pagination values are parsed strictly.
- Business codes preserve leading zeros.
- Query-list sizes are bounded.
- Validation detail counts are bounded.
- Error-detail fields are allowlisted and redacted.
- Health and readiness semantics remain unchanged.
- No public refresh endpoint is introduced.
- No dataset-specific query implementation is added prematurely.
- No upload endpoint is introduced.
- No Redis dependency is introduced.
- No item-level mutation endpoint is introduced.
- Normal tests remain Docker-free.
- Persistence regression tests pass.
- Cache-refresh regression tests pass.
- Type checking passes.
- Linting passes, or pre-existing failures are documented separately.
- The build passes.
- Documentation matches the implementation.
- Work outside this step remains deferred.

## Verification

Use the repository's actual package manager, module system, scripts, and test configuration.

Run the applicable equivalents of:

Plain Text

```text
install dependencies
run type checking
run linting
run common API behaviour unit tests
run error-mapping unit tests
run correlation-ID unit tests
run conditional-request unit tests
run Hapi.js server-injection tests
run the complete Docker-free test suite
run persistence regression tests
run cache-refresh regression tests
run the build
```

Explicitly verify:

Plain Text

```text
successful JSON response
successful GeoJSON response
valid supplied correlation ID
generated correlation ID
invalid correlation ID policy
correlation response header
traceId matches correlation ID
route parameter validation failure
query validation failure
payload validation failure
multiple validation details
validation detail truncation
structural collection validation mapping
business validation mapping
normalisation failure mapping
missing reference item
missing persisted object
missing configured bucket
access-denied persistence error
precondition failure
non-412 persistence write failure
specific error before generic 404
cache unavailable
startup hydration incomplete
authentication unavailable mapping where available
unmatched route
unexpected handler exception
safe 500 response
no stack trace
no raw Joi output
no raw Boom output
no raw AWS output
matching If-None-Match
non-matching If-None-Match
304 with no body
ETag response header
Cache-Control on reference-data response
no public cache on error response
no public cache on health response
no public cache on readiness response
strict limit parsing
strict offset parsing
leading-zero business-code preservation
query-list length limit
safe structured request logging
token redaction
credential redaction
complete collection redaction
no duplicate request completion logs
```

Record:

- Exact commands
- Exit codes
- Test counts
- Coverage results
- Type-check result
- Lint result
- Build result
- Pre-existing warnings or failures
- Any approved deviations
  If verification reveals a pre-existing issue outside this step:

1. Record the exact failing command.
2. Identify the likely pre-existing cause.
3. Explain whether the issue blocks Step 13.
4. Do not expand scope silently.
5. Do not weaken tests to make them pass.
6. Ask for clarification if resolving the issue requires a public API, security, or architectural decision.

## Completion response

Provide a concise implementation report containing:

- Repository state discovered
- Saved plan filename
- Error-envelope design
- Error-mapping precedence
- HTTP status mappings
- Correlation behaviour
- Validation and normalisation mappings
- Persistence and cache mappings
- ETag and conditional-request behaviour
- Cache-Control policies
- Query and pagination conventions
- Security and redaction controls
- Files created
- Files modified
- Files intentionally left unchanged
- Tests added
- Exact verification commands and results
- Coverage results
- Persistence regression results
- Cache-refresh regression results
- Approved deviations
- Existing issues not introduced by this step
- Work deferred to later steps
- Remaining assumptions, risks, or owner decisions
  if you reach any ambiguity ask me to clarify
