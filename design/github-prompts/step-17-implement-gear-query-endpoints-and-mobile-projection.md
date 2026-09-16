# Step 17: Implement Gear Query Endpoints and Mobile Projection

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
5. Inspect the implemented gear schemas, validation rules, canonical normalisation, query architecture, in-memory storage, common API behaviour, vessel endpoint implementation, tests, fixtures, and documentation.
6. Identify reusable patterns introduced by Step 16 for routes, controllers, query use cases, projections, filtering, pagination, sorting, ETags, conditional requests, logging, and tests.
7. Produce a repository-specific implementation plan based on the code that actually exists.
   Do not assume the repository is empty.

Reuse suitable generic behaviour from Step 16, but do not force vessel-specific concepts into the gear implementation.

After producing the plan, save it as:

Plain Text

```text
github-prompts/Step 17-implement-gear-query-endpoints-and-mobile-projection-plan.md
```

The saved GitHub-generated plan must be treated as **already approved** .

After saving the plan, continue directly with implementation without requesting plan approval unless:

- The implementation conflicts with the approved Reference Data Service design.
- A required upstream contract is missing.
- The canonical gear schema differs materially from the assumptions in this prompt.
- The meaning of a legacy property remains ambiguous and materially affects the mobile projection.
- A public API contract is ambiguous.
- A destructive or incompatible repository change is required.
- A security or privacy decision requires owner input.
  The plan must be saved before implementation begins.

## Objective

Implement the gear query API and mobile gear projection for the Reference Data Service.

Implement:

HTTP

```text
GET /api/v1/reference-data/gears
GET /api/v1/reference-data/gears/{id}
```

The endpoints must support:

- Complete active gear collection retrieval.
- Individual gear retrieval by GUID.
- Canonical and mobile response views.
- Free-text search.
- Exact gear-code filtering.
- Gear-category filtering.
- Pair-fishing filtering.
- Vessel-length-aware gear characteristic projection.
- Multiple-GUID filtering where supported by the common API contract.
- Pagination for search and filtered results.
- Deterministic sorting.
- Active and inactive filtering where supported by the canonical schema.
- ETag and `If-None-Match` .
- Standard correlation, errors, cache headers, logging, and metrics.
- Retrieval exclusively from process-local in-memory state.
- Mobile projection without maintaining a separate mobile gear collection.
  This step must not implement gear creation, item-level updates, item-level deletion, full collection uploads, or S3 access from query paths.

## Project context

The Reference Data Service manages:

- Vessels
- Gears
- Ports
- Species
- Map land
- Map statistical areas
  Gear reference data is richer than a simple code and name list.

The canonical gear model preserves legacy concepts such as:

- Gear categories
- Gear codes
- Pair-fishing capability
- Characteristic definitions
- Characteristic data types
- Units
- Numeric limits
- Gear-to-characteristic relationships
- `fixed` and `required` properties
- Vessel-length applicability
  The mobile Catch Recording application requires a concise gear representation that identifies which measurements are relevant to a selected vessel.

The mobile response is a projection of canonical in-memory data, not a separately stored collection.

## Architectural boundaries

Preserve these responsibilities:

1. The **Reference Data Controller** owns Hapi.js request and response mapping.
2. The **Query Module** owns gear retrieval, filtering, search, sorting, pagination, and vessel-length applicability selection.
3. The **In-Memory Data Store** provides the active canonical gear collection and metadata.
4. The **Data Normalisation Module** owns canonical input normalisation.
5. A dedicated response projector or approved query projection layer owns the mobile gear representation.
6. The **Persistence Module is the only application component permitted to access S3 or Floci** .
7. Gear routes, controllers, query use cases, and projectors must not access S3.
8. The Validation Module owns request validation.
9. The Validation Module is the only component permitted to call the Authentication Service.
10. Common API behaviour from Step 13 owns correlation, error mapping, headers, and conditional requests.
11. The Cache Refresh Module owns changes to active in-memory collections.
12. Query requests must not trigger hydration or refresh.
13. Redis or another external cache must not be introduced.
14. Item-level mutations must not be introduced.

## Existing decisions to preserve

Preserve all approved decisions:

- Gear records, categories, characteristics, and relationship records use GUIDs as stable technical identifiers.
- Gear, category, and characteristic codes remain business identifiers.
- Business codes must not replace GUIDs.
- Business-code comparisons are case-insensitive for duplicate detection and approved matching.
- Original canonical code values must be preserved in responses.
- The only currently approved characteristic `dataType` is: Plain Text 1 number
- The exact canonical vessel-length applicability values are: Plain Text 1 under-10m 2 10-to-12m 3 over-12m
- The bands mean: Plain Text 1 under-10m: vessel length < 10 metres 2 10-to-12m: vessel length >= 10 metres and <= 12 metres 3 over-12m: vessel length > 12 metres
- Canonical aliases must not be introduced for those band values.
- The legacy `fixed` property must remain explicit.
- The meaning of `fixed` must not be silently redefined.
- Canonical and mobile responses originate from the same active canonical collection.
- Normal API and query tests remain Docker-free.
- Floci tests remain under the separate configured command.
- Standard API errors follow Step 13.
- ETags are opaque.
- `304 Not Modified` has no response body.
- Gear query endpoints read from memory, not S3.
- Item-level gear mutation is excluded.

## Repository assessment

Before producing the plan, inspect the repository for:

### Gear contracts

- Canonical gear schema
- Gear collection envelope
- Gear category schema
- Characteristic schema
- Gear-to-characteristic relationship schema
- Vessel-length applicability representation
- `fixed` and `required` representation
- Characteristic data-type constants
- Unit representation
- Minimum and maximum value representation
- Active status representation
- Existing fixtures and builders
- Existing validation and normalisation

### Query implementation

- Query Module interfaces
- Generic collection retrieval
- Generic item retrieval
- Search and filter utilities
- Pagination utilities
- Sorting utilities
- Projection interfaces
- Dataset registry
- In-Memory Data Store snapshot behaviour
- Collection metadata access

### API implementation

- Route-registration patterns
- Controller patterns
- Step 16 vessel endpoint patterns
- Request validation
- Response schemas
- ETag and conditional-request helpers
- Cache-Control
- Correlation handling
- Error mapping
- Authentication and authorisation hooks
- OpenAPI organisation

### Testing

- Query Module tests
- Projector tests
- Hapi.js `server.inject` tests
- Fixture conventions
- Conditional-request tests
- Architecture-boundary tests
- Coverage thresholds
- Regression suites
  Retain compatible conventions.

Do not introduce a competing query or projection architecture.

## Canonical gear contract

Use the implemented canonical gear schema as the authoritative contract.

The intended collection contains concepts equivalent to:

JSON

```text
{
  "dataset": "gears",
  "collectionId": "9f35dd64-1334-4db3-b135-ddc91ff67293",
  "schemaVersion": "1.0",
  "version": "2026.09.03.1",
  "generatedAt": "2026-09-03T12:00:00Z",
  "categories": [
    {
      "id": "3f2738e8-4799-48a0-9731-800c5a1fdbbd",
      "code": "TRAWL",
      "name": "Trawls"
    }
  ],
  "characteristics": [
    {
      "id": "2c3f5154-0af7-4c76-bc95-ba17e135eb0f",
      "code": "MESH_SIZE",
      "name": "Mesh size",
      "dataType": "number",
      "unit": "mm",
      "minimumValue": 1,
      "maximumValue": null
    }
  ],
  "itemCount": 1,
  "items": [
    {
      "id": "67df7303-147c-408c-9af1-938b64d9ba85",
      "code": "TBB",
      "name": "Beam trawl",
      "type": "trawl",
      "categoryId": "3f2738e8-4799-48a0-9731-800c5a1fdbbd",
      "pairFishing": false,
      "applicableCharacteristics": [
        {
          "id": "ecb406f4-87b0-44ef-b98c-1dfc4e6fc673",
          "characteristicId": "2c3f5154-0af7-4c76-bc95-ba17e135eb0f",
          "fixed": true,
          "required": true,
          "vesselLengthApplicability": [
            "under-10m",
            "10-to-12m",
            "over-12m"
          ]
        }
      ],
      "active": true
    }
  ]
}
```

Adapt property names to the exact approved repository implementation.

Do not introduce aliases solely to match this example.

## Endpoints

### Complete or filtered gear collection

HTTP

```text
GET /api/v1/reference-data/gears
```

### Individual gear

HTTP

```text
GET /api/v1/reference-data/gears/{id}
```

The `{id}` parameter is a gear GUID.

Do not interpret `{id}` as a gear code, category code, or characteristic code.

## View selection

Support:

Plain Text

```text
view=canonical
view=mobile
```

Unless an approved repository decision differs, use:

Plain Text

```text
view=canonical
```

as the default.

Reject unsupported values with the standard `400` response.

Apply the selected view consistently to collection, search, filtering, and individual-item responses.

## Canonical response

The canonical view must preserve the active canonical collection structure.

Requirements:

- Preserve gear GUIDs.
- Preserve category GUIDs.
- Preserve characteristic GUIDs.
- Preserve relationship GUIDs.
- Preserve gear, category, and characteristic business codes.
- Preserve pair-fishing capability.
- Preserve `fixed` and `required` .
- Preserve all vessel-length applicability values.
- Preserve numeric units and constraints.
- Preserve active status.
- Do not infer or manufacture missing categories or characteristics.
- Do not mutate in-memory state.
- Do not expose S3 keys, bucket names, cache internals, or persistence metadata.

## Mobile gear projection

Implement a mobile response equivalent to:

JSON

```text
{
  "dataset": "gears",
  "collectionId": "9f35dd64-1334-4db3-b135-ddc91ff67293",
  "version": "2026.09.03.1",
  "view": "mobile",
  "context": {
    "vesselLengthMetres": 8.74,
    "vesselLengthBand": "under-10m"
  },
  "measurements": [
    {
      "id": "2c3f5154-0af7-4c76-bc95-ba17e135eb0f",
      "code": "MESH_SIZE",
      "label": "Mesh size",
      "kind": "number",
      "unit": "mm",
      "minimumValue": 1,
      "maximumValue": null
    }
  ],
  "itemCount": 1,
  "items": [
    {
      "id": "67df7303-147c-408c-9af1-938b64d9ba85",
      "code": "TBB",
      "name": "Beam trawl",
      "category": {
        "id": "3f2738e8-4799-48a0-9731-800c5a1fdbbd",
        "code": "TRAWL",
        "name": "Trawls"
      },
      "pairFishing": false,
      "requiredMeasurementIds": [
        "2c3f5154-0af7-4c76-bc95-ba17e135eb0f"
      ],
      "variableMeasurementIds": []
    }
  ]
}
```

Adapt the shape to any later approved repository contract.

Do not persist this mobile projection.

## Vessel-length context

Support:

Plain Text

```text
vesselLengthMetres
```

Example:

HTTP

```text
GET /api/v1/reference-data/gears?view=mobile&vesselLengthMetres=8.74
```

### Validation

- Must be a strict numeric value.
- Must be finite.
- Must be positive.
- Must not be supplied more than once.
- Must not contain units.
- Must not be inferred from another request field.
- Must not be loaded from the vessel collection in this step.
- Must not accept vessel GUID as a substitute.

### Band resolution

Resolve exactly:

Plain Text

```text
length < 10
  -> under-10m

length >= 10 and length <= 12
  -> 10-to-12m

length > 12
  -> over-12m
```

Add boundary tests for:

- Just below 10
- Exactly 10
- Just above 10
- Exactly 12
- Just above 12
  Do not use floating-point rounding to move a value into another band.

### Optional or required

The GitHub-generated plan must inspect the approved API contract and explicitly determine whether `vesselLengthMetres` is:

- Required whenever `view=mobile` , or
- Optional, with all characteristics returned when absent.
  Preferred behaviour:

- Permit mobile gear-summary retrieval without vessel length.
- When absent, return all active gears and their complete applicable measurement references.
- When present, restrict applicable characteristics to the resolved vessel-length band.
- Include `context` only when vessel-length context is provided.
  If the existing approved API design requires vessel length for mobile projection, preserve that decision.

Do not silently choose a policy without documenting it in the plan.

## Measurement projection

Project characteristic definitions into mobile measurement objects.

### Field mapping

Use mappings equivalent to:

Plain Text

```text
characteristic.id -> measurement.id
characteristic.code -> measurement.code
characteristic.name -> measurement.label
characteristic.dataType -> measurement.kind
characteristic.unit -> measurement.unit
characteristic.minimumValue -> measurement.minimumValue
characteristic.maximumValue -> measurement.maximumValue
```

Requirements:

- Preserve characteristic GUIDs.
- Preserve characteristic business codes.
- Use the approved canonical `dataType` .
- Return numeric limits as numbers.
- Do not infer units.
- Do not create duplicate measurement definitions.
- Include only measurements referenced by returned gear items.
- When a vessel length is supplied, include only measurements applicable to its band.
- Use deterministic measurement ordering.
- Do not mutate characteristic definitions.
- Do not expose internal relationship records unless part of the mobile contract.

## Required and variable measurement mapping

The canonical model preserves both:

Plain Text

```text
fixed
required
```

Do not silently redefine `fixed` .

Unless an approved later decision defines different semantics, use this projection policy:

Plain Text

```text
required === true and fixed === true
  -> requiredMeasurementIds

fixed === false
  -> variableMeasurementIds
`
```

For:

Plain Text

```text
required === false and fixed === true
```

the plan must inspect existing requirements and define whether the measurement:

- Is omitted from required measurements,
- Is exposed through another approved optional fixed-measurement field, or
- Requires clarification.
  Do not lose a valid canonical relationship silently.

If the meaning of `fixed` remains materially ambiguous for mobile behaviour, stop and ask for clarification before implementing that mapping.

Document the final rule in code comments, tests, API documentation, and the completion report.

## Category projection

Each mobile gear record should include the resolved category:

JSON

```text
{
  "id": "3f2738e8-4799-48a0-9731-800c5a1fdbbd",
  "code": "TRAWL",
  "name": "Trawls"
}
```

Requirements:

- Resolve by `categoryId` .
- Preserve category GUID and code.
- Do not use category code as its technical ID.
- Do not create a category when the relationship is unresolved.
- An unresolved category should already have been rejected during business validation.
- If invalid data nevertheless reaches the projector, fail safely rather than returning a fabricated category.

## Collection retrieval

When no search, filter, or pagination parameter is supplied, return the complete active gear collection.

Requirements:

- Read from the In-Memory Data Store.
- Do not access S3.
- Do not trigger refresh.
- Apply the selected view.
- Include active collection metadata.
- Return the active ETag.
- Support `If-None-Match` .
- Preserve source ordering unless the approved API contract requires canonical sorting.
- Do not apply search pagination defaults to an explicit full-collection request.
- Do not return a successful empty collection when gear data is unavailable.

## Search

Support:

HTTP

```text
GET /api/v1/reference-data/gears?query=trawl
```

Search approved textual fields:

- Gear name
- Gear code
- Gear type
- Category name
- Category code
- Characteristic name
- Characteristic code
  Requirements:

- Use case-insensitive plain-text matching.
- Preserve original values in responses.
- Trim surrounding query whitespace.
- Reject an empty query after trimming.
- Bound query length.
- Do not interpret input as a regular expression.
- Do not implement fuzzy or phonetic matching.
- Do not query S3.
- Use deterministic result ordering.
- A characteristic match should return each matching gear no more than once.
  The plan must explicitly document whether a characteristic match includes every gear referencing that characteristic. Preferred behaviour is yes.

## Exact gear-code filter

Support:

HTTP

```text
GET /api/v1/reference-data/gears?code=TBB
```

Requirements:

- Use case-insensitive exact comparison.
- Preserve the canonical code in the response.
- Trim surrounding query whitespace.
- Reject an empty value.
- Bound the value length.
- Do not treat the code as a GUID.

## Category filter

Support one or both of these according to the approved API contract:

HTTP

```text
GET /api/v1/reference-data/gears?categoryCode=TRAWL
GET /api/v1/reference-data/gears?categoryId=<guid>
```

Preferred behaviour is to support both:

- `categoryCode` for consumer-friendly business-code filtering.
- `categoryId` for stable technical relationships.
  Requirements:

- Validate `categoryId` as a GUID.
- Match `categoryCode` case-insensitively.
- Preserve category values.
- Reject unknown filter parameter variants.
- Unknown category filter values return an empty result rather than `404` for the collection route.
- Do not treat category code as category GUID.

## Pair-fishing filter

Support:

HTTP

```text
GET /api/v1/reference-data/gears?pairFishing=true
```

Requirements:

- Parse strictly as a boolean.
- Do not use JavaScript truthiness.
- Accept only the common approved boolean representations.
- Reject invalid values with `400` .
- Preserve canonical values.
- Combine with other filters using logical `AND` .

## GUID filters

Support:

HTTP

```text
GET /api/v1/reference-data/gears/{id}
```

Where supported by the common query contract, also support:

HTTP

```text
GET /api/v1/reference-data/gears?ids=<guid-1>,<guid-2>
```

Requirements:

- Validate all GUIDs.
- Bound list size.
- De-duplicate repeated GUIDs according to the common policy.
- Preserve deterministic output ordering.
- An invalid GUID returns `400` .
- An unknown individual gear GUID returns `404` .
- Document whether unknown values in `ids` are omitted or cause an error.
- Do not interpret gear codes as GUIDs.

## Active and inactive gears

Where the canonical schema supports active state, support:

Plain Text

```text
includeInactive
```

Preferred behaviour:

- Default: `includeInactive=false`
- `true` : include active and inactive gear records
  Requirements:

- Parse strictly.
- Do not infer activity from unrelated fields.
- Apply active filtering before pagination.
- Ensure inactive characteristic or category handling follows the implemented canonical model.
- If nested entities have no active property, do not invent one.
  If the schema does not support inactive state, follow the common query convention rather than adding speculative behaviour.

## Filter combination

When multiple filters are supplied, combine them using logical `AND` .

Example:

HTTP

```text
GET /api/v1/reference-data/gears?categoryCode=TRAWL&pairFishing=false&vesselLengthMetres=8.74
```

Requirements:

- Apply all supplied filters.
- Do not ignore conflicting filters.
- A valid combination with no matches returns an empty search result.
- Apply vessel-length context to characteristic applicability, not as a speculative filter on gear identity unless a gear has no applicable characteristics for the selected band.
- The plan must define whether a gear with zero applicable characteristics for the selected band remains in the mobile result.
  Preferred behaviour:

- Exclude a gear from a vessel-length-specific mobile response when it has no applicable characteristics for the selected band and the canonical model indicates the gear is not applicable.
- If vessel-length bands describe characteristic applicability only, retain the gear with empty measurement references.
  Inspect the legacy semantics before choosing. If the distinction cannot be resolved from existing design and code, ask for clarification.

## Search response envelope

Filtered, searched, or paginated results should follow the existing query-result contract.

Conceptually:

JSON

```text
{
  "dataset": "gears",
  "collectionId": "9f35dd64-1334-4db3-b135-ddc91ff67293",
  "version": "2026.09.03.1",
  "view": "mobile",
  "context": {
    "vesselLengthMetres": 8.74,
    "vesselLengthBand": "under-10m"
  },
  "query": {
    "text": "trawl",
    "offset": 0,
    "limit": 50
  },
  "total": 1,
  "measurements": [],
  "items": []
}
```

Requirements:

- `total` represents matching gears before pagination.
- `items` contains the selected page.
- `measurements` includes definitions referenced by the returned page only unless the approved contract requires all matched definitions.
- `offset` and `limit` are validated.
- Preserve active collection ID and version.
- Include the selected view.
- Do not expose internal indexes or relevance scores.
  The plan must explicitly document whether mobile measurements are page-specific or match-set-wide. Preferred behaviour is page-specific to avoid unused definitions.

## Pagination

Use the common pagination contract.

Unless existing approved configuration differs:

Plain Text

```text
default limit: 50
maximum limit: 500
default offset: 0
```

Requirements:

- Apply pagination to search and filtered results.
- Do not paginate explicit full collection retrieval by default.
- Reject negative or non-integer values.
- Apply the configured maximum policy.
- Return an empty page when offset exceeds results.
- Calculate `total` before pagination.
- Avoid projecting discarded records where practical.

## Sorting

Use deterministic sorting for search and filtered results.

Allowlist approved sort fields equivalent to:

Plain Text

```text
name
code
type
categoryName
categoryCode
pairFishing
```

Preferred default order:

1. Gear name, case-insensitive
2. Gear code, case-insensitive
3. Gear GUID as final tie-breaker
   Requirements:

- Support ascending and descending according to the common syntax.
- Reject arbitrary property paths.
- Use deterministic null ordering.
- Do not mutate the active collection.
- Do not sort characteristic relationships or measurements in a way that changes approved business priority.
- Use deterministic measurement ordering separately.

## Individual gear response

For:

HTTP

```text
GET /api/v1/reference-data/gears/{id}
```

Return canonical or mobile representation according to `view` .

For mobile view, allow `vesselLengthMetres` .

Requirements:

- Follow the existing item-response convention from Step 16.
- Do not introduce a third incompatible item response style.
- Unknown GUID returns `404` .
- Invalid GUID returns `400` .
- Apply active-item policy.
- Return the appropriate ETag.
- Preserve standard correlation and cache headers.

## Query Module implementation

Implement or align use cases equivalent to:

Plain Text

```text
getGearCollection(query)
getGearById(id, query)
```

The Query Module must:

1. Obtain one consistent active gear snapshot and metadata.
2. Verify availability.
3. Build or resolve category and characteristic indexes.
4. Apply active filtering.
5. Apply GUID and exact filters.
6. Apply free-text search.
7. Apply deterministic sorting.
8. Calculate total.
9. Apply pagination where appropriate.
10. Resolve vessel-length band.
11. Apply canonical or mobile projection.
12. Return response data and ETag metadata.
13. Avoid persistence access.
14. Avoid authentication calls.
15. Avoid Hapi.js response construction.

## Lookup indexes

Efficient projection requires category and characteristic lookup by GUID.

Use per-request indexes or approved immutable indexes associated with the active collection.

Requirements:

- Build from the same active snapshot as gear items.
- Do not combine indexes from another collection version.
- Use `Map` or equivalent bounded lookup structures.
- Avoid repeated full scans for each gear.
- Do not mutate canonical data.
- Do not preserve stale indexes after refresh.
- Do not introduce an external database or search engine.
- Keep behaviour testable and deterministic.
  If Step 11 already supports derived snapshot indexes, reuse that mechanism.

## Request validation

Validate:

- `id`
- `view`
- `query`
- `code`
- `categoryId`
- `categoryCode`
- `pairFishing`
- `vesselLengthMetres`
- `ids`
- `limit`
- `offset`
- `sort`
- `includeInactive`
- `If-None-Match`
- `X-Correlation-Id`
  Use common validators from Steps 08 and 13.

Requirements:

- Reject unknown query parameters according to the approved policy.
- Parse numbers and booleans strictly.
- Preserve business codes as strings.
- Bound all scalar and list inputs.
- Return standard deterministic validation details.
- Do not expose complete rejected objects.

## ETag and conditional requests

Return the active gear response ETag.

Support:

HTTP

```text
If-None-Match: "<etag>"
```

Use Step 13 conditional-request helpers.

The plan must decide whether filtered and mobile projections use:

- The active collection ETag, or
- A deterministic projection-specific ETag based on collection revision, view, vessel-length context, and normalised filters.
  Preferred behaviour:

- Use a projection-specific ETag for responses whose representation changes with query parameters or `view` .
- Do not include correlation ID or request time.
- Do not serialise the full response solely to calculate an ETag when stable metadata and normalised query inputs are sufficient.
  When matched:

- Return `304` .
- Return no body.
- Include ETag.
- Include the correlation header.
- Include approved cache headers.
- Avoid unnecessary projection work.

## Cache-Control

Use the approved reference-data retrieval policy from Step 13.

Expected default where unchanged:

HTTP

```text
Cache-Control: public, max-age=3600, stale-while-revalidate=86400
```

Do not publicly cache errors, authentication failures, health responses, readiness responses, or caller-specific results.

## Authentication and authorisation

Use existing integration where available.

The intended permission is:

Plain Text

```text
reference-data.read
``
```

Requirements:

- Do not call the Authentication Service from gear controllers or Query Module code.
- Use the Validation Module or existing Hapi.js authentication strategy.
- Missing or invalid authentication returns `401` .
- Insufficient permission returns `403` .
- Do not invent temporary authentication.
  If authentication remains deferred, preserve the integration boundary and document the deferral.

## Error handling

Use the Step 13 common error contract.

Relevant stable conditions include:

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

- Invalid vessel length returns `400` .
- Invalid category GUID returns `400` .
- Unknown gear item GUID returns `404` .
- An unknown collection-filter value returns a valid empty filtered result.
- Unavailable active gear data returns `503` .
- Do not return a successful empty result when the dataset itself is unavailable.
- Do not expose raw Hapi.js, Joi, cache, validation, or persistence errors.
- Preserve correlation IDs.
- Do not expose stack traces.

## Logging

Use Step 13 structured request logging.

Safe gear-query logging may include:

- Correlation ID
- Route identifier
- Selected view
- Presence of search
- Names of filters used
- Resolved vessel-length band
- Offset and limit
- Result count
- Total count
- Collection version
- Response status
- Request duration
- Error code
  Do not log:

- Complete gear collections
- Complete characteristic definitions
- Complete request query strings unnecessarily
- Access tokens
- Credentials
- Internal persistence metadata
- Full user-controlled search values
- Full collection object keys

## Metrics

Use existing metrics hooks where available.

Prepare or emit bounded metrics equivalent to:

Plain Text

```text
reference_data_gear_requests_total
reference_data_gear_search_requests_total
reference_data_gear_mobile_projection_total
reference_data_gear_request_duration
reference_data_gear_results_total
reference_data_gear_not_found_total
reference_data_gear_not_modified_total
reference_data_gear_failures_total
```

Acceptable bounded labels include:

- Route identifier
- View
- Status code
- Filtered or unfiltered
- Vessel-length band
- Error code
  Do not use:

- Gear GUIDs
- Gear codes
- Correlation IDs
- Raw query text
- Collection GUIDs
  as metric labels.

## Security and privacy requirements

- Treat all request parameters as untrusted.
- Use plain-text search rather than user-provided regular expressions.
- Bound query and list values.
- Use allowlisted sort fields.
- Do not expose internal cache or persistence details.
- Do not log tokens or credentials.
- Do not expose stack traces.
- Do not dynamically import code based on dataset or type values.
- Do not use query values to construct S3 object keys.
- Do not permit prototype-pollution properties.
- Preserve authentication and authorisation boundaries.
- Do not add wildcard CORS.
- Review any new dependency for security, maintenance, and licence impact.

## Performance requirements

- Do not call S3 or Floci.
- Do not trigger refresh.
- Obtain one consistent gear snapshot.
- Build category and characteristic indexes no more than necessary.
- Avoid repeated full-array searches for relationships.
- Avoid in-place sorting.
- Avoid deep cloning the entire collection.
- Apply filters before expensive projection.
- Apply pagination before projecting page-specific mobile objects where correct.
- Include only needed mobile measurement definitions.
- Bound `ids` and search input.
- Reuse active metadata for ETag derivation.
- Keep result order deterministic.
- Record durations through existing observability hooks.

## Unit test requirements

Add comprehensive Docker-free tests.

### Vessel-length band resolution

Test:

- Positive value below 10
- Exactly 10
- Between 10 and 12
- Exactly 12
- Above 12
- Zero
- Negative value
- Non-number
- Numeric string according to request-validation policy
- `NaN`
- Infinity
- Value containing units

### Mobile projection

Test:

- Gear category resolution
- Characteristic resolution
- Required measurement
- Variable measurement
- `fixed` preserved in canonical view
- Pair-fishing value
- Numeric unit and bounds
- Measurement de-duplication
- Multiple gears sharing one characteristic
- Vessel-length-specific characteristic selection
- No vessel-length context policy
- No applicable characteristics
- Missing category fails safely
- Missing characteristic fails safely
- GUIDs preserved
- Codes preserved
- Input not mutated
- Projection deterministic
- Only referenced page measurements included according to policy

### Full collection

Test:

- Canonical view
- Mobile view
- Default view
- Unsupported view
- Empty active collection
- Unavailable gear dataset
- Full collection not paginated by default
- Collection metadata preserved
- ETag returned
- Source state not mutated

### Individual gear

Test:

- Canonical gear by GUID
- Mobile gear by GUID
- Mobile gear with vessel length
- Invalid GUID
- Unknown GUID
- Gear code incorrectly supplied as path ID
- Inactive gear policy
- Item response shape matches Step 16 convention

### Search

Test:

- Gear-name match
- Gear-code match
- Gear-type match
- Category-name match
- Category-code match
- Characteristic-name match
- Characteristic-code match
- Case-insensitive matching
- Plain-text special characters
- Empty query
- Overlong query
- No result
- Gear returned once when multiple fields match
- Gear returned when a referenced characteristic matches

### Exact filters

Test:

- Gear-code filter
- Category-code filter
- Category-GUID filter
- Pair-fishing true
- Pair-fishing false
- Invalid boolean
- Case-insensitive code matching
- Empty code
- Invalid category GUID
- Unknown category
- Multiple filters combined with `AND`
- Conflicting valid filters produce an empty result

### Applicability

Test:

- `under-10m`
- `10-to-12m`
- `over-12m`
- Characteristic applicable to all bands
- Characteristic applicable to one band
- Characteristic excluded for selected band
- Canonical applicability not mutated
- No aliases accepted as canonical bands
- Gear-with-no-applicable-characteristics policy

### Pagination

Test:

- Default search limit
- Default offset
- Explicit limit and offset
- Last partial page
- Offset beyond result count
- Negative values
- Non-integer values
- Limit above maximum
- Correct total before pagination
- Full collection remains unpaginated
- Measurement definitions correspond to returned page according to policy

### Sorting

Test:

- Default deterministic order
- Name
- Code
- Type
- Category name
- Category code
- Pair fishing
- Ascending
- Descending
- Invalid field
- Null ordering
- GUID tie-breaker
- Source collection not mutated

### ETag

Test:

- Stable active ETag
- Canonical versus mobile representation policy
- Vessel length affects projection-specific ETag
- Filters affect ETag where required
- Matching `If-None-Match`
- Non-matching value
- `304` has no body
- ETag and correlation headers on `304`
- ETag independent of correlation ID
- ETag independent of request time

### Architecture boundaries

Verify:

- Controller does not use Persistence Module.
- Query Module does not use Persistence Module.
- No AWS SDK import exists in gear query code.
- No Floci call occurs.
- Query does not trigger refresh.
- Projector does not mutate canonical data.
- Authentication Service is not called outside Validation Module.
- No Redis dependency is introduced.

## Integration test requirements

Use Hapi.js `server.inject` or the repository's Docker-free API test approach.

Verify:

1. Gear collection route registration.
2. Gear item route registration.
3. Default canonical collection response.
4. Mobile collection response.
5. Canonical gear by GUID.
6. Mobile gear by GUID.
7. Search by gear name.
8. Search by gear code.
9. Search by category.
10. Search by characteristic.
11. Exact code filtering.
12. Category-code filtering.
13. Category-GUID filtering.
14. Pair-fishing filtering.
15. Vessel length below 10.
16. Vessel length exactly 10.
17. Vessel length exactly 12.
18. Vessel length above 12.
19. Measurement projection.
20. Required and variable mapping.
21. Pagination.
22. Sorting.
23. Active and inactive behaviour where supported.
24. Unsupported view returns `400` .
25. Invalid vessel length returns `400` .
26. Invalid item GUID returns `400` .
27. Unknown gear returns `404` .
28. Unavailable gear collection returns `503` .
29. Matching ETag returns `304` .
30. `304` has no body.
31. Correlation and cache headers are correct.
32. Errors use Step 13 envelope.
33. Unexpected failure produces safe `500` .
34. No S3 access occurs.
35. No refresh occurs.
36. Normal tests remain Docker-free.
    Do not require Floci.

Use deterministic in-memory gear fixtures.

## Regression test requirements

Run existing tests for:

- Gear structural validation
- Gear business validation
- Gear canonical normalisation
- Common API behaviour
- Vessel query endpoints
- Manifest API
- In-Memory Data Store
- Cache Refresh Module
- Startup hydration
- Persistence
- Health and readiness
  Explicitly confirm:

- Gear queries do not mutate active state.
- Mobile projection does not mutate canonical gear data.
- Manifest gear metadata remains correct.
- Cache refresh atomically replaces the gear collection.
- A later gear request sees the new collection.
- Failed refresh preserves the previous queryable gear collection.
- Vessel query behaviour remains unchanged.
- Persistence error mapping remains unchanged.
- Normal `npm test` remains Docker-free.
- Floci tests remain separate.

## OpenAPI documentation

If the repository contains OpenAPI, document:

HTTP

```text
GET /api/v1/reference-data/gears
GET /api/v1/reference-data/gears/{id}
```

Include:

- `id`
- `view`
- `query`
- `code`
- `categoryId`
- `categoryCode`
- `pairFishing`
- `vesselLengthMetres`
- `ids` where implemented
- `limit`
- `offset`
- `sort`
- `includeInactive`
- `If-None-Match`
- `X-Correlation-Id`
- `ETag`
- `Cache-Control`
- Canonical gear schema
- Mobile gear schema
- Mobile measurement schema
- Vessel-length context
- Search response
- `200`
- `304`
- `400`
- `401` where implemented
- `403` where implemented
- `404`
- `500`
- `503`
  Examples must conform to implemented contracts.

## Documentation requirements

Update repository documentation with:

- Gear endpoint purpose
- Canonical gear structure
- Mobile gear structure
- GUID versus business-code rules
- Category projection
- Characteristic projection
- `dataType` policy
- Vessel-length bands and boundaries
- Required and variable measurement mapping
- Meaning and preservation of `fixed`
- Behaviour without vessel length
- Gear-with-no-applicable-characteristics policy
- Search fields
- Exact filters
- Filter combination
- Active and inactive behaviour
- Pagination
- Sorting
- Page-specific measurement policy
- ETag and conditional requests
- Projection-specific ETag policy
- Cache-Control
- Error responses
- Security considerations
- Performance considerations
- Testing commands
- Work deferred to later steps
  Include request and response examples.

## Explicit exclusions

Do not implement:

- Gear creation
- Gear item updates
- Gear item deletion
- Full gear collection upload
- Validation-only gear upload
- Atomic collection activation
- S3 access from query code
- Floci calls from query code
- Cache refresh triggering
- Vessel query changes unrelated to reusable fixes
- Port query endpoints
- Species query endpoints
- Map query endpoints
- Favourites
- External gear services
- New characteristic data types
- Unapproved vessel-length aliases
- Silent redefinition of `fixed`
- External search engines
- Redis
- API Gateway deployment
- Fargate deployment
- Production IAM changes

## Required plan content

The GitHub-generated plan must include:

1. Current canonical gear schema.
2. Current gear validation and normalisation.
3. Exact `fixed` and `required` representation.
4. Exact vessel-length applicability representation.
5. Current query architecture.
6. Current In-Memory Data Store interface.
7. Reusable Step 16 patterns.
8. Current ETag and common API behaviour.
9. Existing authentication boundary.
10. Existing tests and OpenAPI structure.
11. Existing behaviour to retain.
12. Gaps against Step 17.
13. Proposed routes.
14. Proposed controller responsibilities.
15. Proposed Query Module use cases.
16. Proposed canonical response.
17. Proposed mobile response.
18. Proposed measurement projection.
19. Proposed required and variable mapping.
20. Proposed behaviour without vessel length.
21. Proposed vessel-length band resolver.
22. Proposed gear-with-no-applicable-characteristics policy.
23. Proposed category resolution.
24. Proposed characteristic resolution.
25. Proposed search fields and matching.
26. Proposed exact filters.
27. Proposed filter combination.
28. Proposed GUID-list behaviour.
29. Proposed inactive-item policy.
30. Proposed pagination.
31. Proposed sorting.
32. Proposed item-response convention.
33. Proposed mobile measurement scope for paginated results.
34. Proposed ETag source.
35. Proposed projection-specific ETag policy.
36. Proposed cache behaviour.
37. Proposed error and unavailable-state behaviour.
38. Proposed logging and metrics.
39. Exact files to create.
40. Exact files to modify.
41. Files intentionally left unchanged.
42. Unit-test approach.
43. Hapi.js integration-test approach.
44. Regression-test approach.
45. OpenAPI updates.
46. Documentation updates.
47. Security and privacy considerations.
48. Performance considerations.
49. Verification commands.
50. Assumptions and unresolved ambiguities.
51. Work explicitly deferred.

## Expected deliverables

- GitHub-generated plan saved as: Plain Text 1 github-prompts/Step 17-implement-gear-query-endpoints-and-mobile-projection-plan.md
- Gear collection route.
- Gear item route.
- Gear request schemas.
- Gear Query Module use cases.
- Canonical gear responses.
- Mobile gear projector.
- Mobile measurement projector.
- Vessel-length band resolver.
- Category and characteristic lookup.
- Required and variable measurement mapping.
- Free-text gear search.
- Gear-code filter.
- Category filters.
- Pair-fishing filter.
- Vessel-length applicability filtering.
- Multiple-GUID filtering where approved.
- Active filtering where supported.
- Pagination.
- Deterministic sorting.
- ETag and `If-None-Match` .
- Cache-Control.
- Correlation and standard errors.
- Safe logging and metrics hooks.
- Docker-free unit tests.
- Docker-free Hapi.js integration tests.
- Regression verification.
- OpenAPI updates where present.
- Consumer and developer documentation.
- Step completion report.

## Acceptance criteria

- The GitHub-generated plan is saved before implementation.
- The saved plan is assumed approved.
- Copilot proceeds without requesting plan approval.
- The following routes exist: Plain Text 1 GET /api/v1/reference-data/gears 2 GET /api/v1/reference-data/gears/{id}
- Individual gear identity uses GUIDs.
- Business codes remain separate from GUIDs.
- Canonical responses preserve approved gear data.
- Mobile responses are projected from canonical memory.
- No separate mobile gear collection is persisted.
- Category, characteristic, and relationship GUIDs remain unchanged.
- The only approved `dataType` remains `number` .
- Canonical vessel-length bands remain exactly: Plain Text 1 under-10m 2 10-to-12m 3 over-12m
- Boundary mapping at 10 and 12 metres is correct.
- Mobile measurement definitions preserve GUIDs and business codes.
- Pair-fishing capability is preserved.
- `fixed` remains explicit in canonical output.
- The mobile mapping of `fixed` and `required` is documented and tested.
- No valid canonical relationship is silently discarded.
- Gear categories are resolved deterministically.
- Characteristics are resolved efficiently.
- Duplicate mobile measurement definitions are not returned.
- The policy for missing vessel length is documented.
- The policy for gears without applicable characteristics is documented.
- Search covers approved gear, category, and characteristic fields.
- Search is case-insensitive plain-text search.
- Exact code filters are case-insensitive.
- Multiple filters use logical `AND` .
- Pair-fishing is parsed strictly.
- Invalid vessel length returns `400` .
- Invalid path GUID returns `400` .
- Unknown gear GUID returns `404` .
- Unavailable gear data returns `503` .
- Unavailable data is not represented as a successful empty collection.
- Pagination total is calculated before pagination.
- Full collection retrieval is not unintentionally paginated.
- Sorting is deterministic and does not mutate source state.
- Query and projection read from one consistent active snapshot.
- No query path accesses S3 or Floci.
- No query triggers refresh.
- ETag behaviour is deterministic.
- Projection-specific ETag policy is documented.
- Matching `If-None-Match` returns `304` .
- `304` has no body.
- Correlation and ETag headers are present on `304` .
- Errors use the Step 13 envelope.
- Stack traces and raw internal errors are not exposed.
- No item-level mutation endpoint is introduced.
- No Redis dependency is introduced.
- Normal tests remain Docker-free.
- Gear tests pass.
- Vessel endpoint regression tests pass.
- Validation and normalisation tests pass.
- Manifest and cache tests pass.
- Persistence tests pass.
- Type checking passes.
- Linting passes, or pre-existing issues are documented.
- The build passes.
- Documentation matches implemented behaviour.
- Work outside Step 17 remains deferred.

## Verification

Use the repository's actual package manager, module system, scripts, and test configuration.

Run the applicable equivalents of:

Plain Text

```text
install dependencies
run type checking
run linting
run gear band-resolver tests
run gear mobile-projector tests
run gear Query Module tests
run gear route and controller tests
run gear Hapi.js integration tests
run vessel endpoint regression tests
run common API tests
run manifest API tests
run in-memory store and cache tests
run validation and normalisation tests
run persistence tests
run the complete Docker-free suite
run the build
```

Explicitly verify:

Plain Text

```text
gear routes registered
default canonical view
explicit canonical view
mobile view
unsupported view
canonical collection
mobile collection
canonical gear by GUID
mobile gear by GUID
invalid GUID
unknown GUID
search by gear name
search by gear code
search by type
search by category name
search by category code
search by characteristic name
search by characteristic code
case-insensitive matching
plain-text special-character handling
exact gear-code filter
category-code filter
category-GUID filter
pair-fishing true
pair-fishing false
invalid pair-fishing value
multiple-filter AND behaviour
vessel length below 10
vessel length exactly 10
vessel length between 10 and 12
vessel length exactly 12
vessel length above 12
invalid vessel length
behaviour without vessel length
gear-with-no-applicable-characteristics policy
required measurement mapping
variable measurement mapping
fixed-property preservation
measurement de-duplication
page-specific measurement policy
pagination and correct total
full collection not paginated
deterministic sorting
source arrays not mutated
canonical objects not mutated
stable ETag
projection-specific ETag policy
matching If-None-Match
304 with no body
304 with ETag and correlation
Cache-Control
standard 400
standard 404
standard 503
safe 500
no raw internal errors
no S3 access
no Floci calls
no refresh triggering
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
3. Explain whether the issue blocks Step 17.
4. Do not expand the scope silently.
5. Do not weaken tests to make them pass.
6. Ask for clarification if resolving the issue requires a gear schema, mobile projection, legacy semantics, security, compatibility, or architectural decision.

## Completion response

Provide a concise implementation report containing:

- Repository state discovered
- Saved plan filename
- Gear endpoints implemented
- Canonical response behaviour
- Mobile projection behaviour
- Vessel-length band behaviour
- Behaviour without vessel length
- Required and variable measurement mapping
- `fixed` interpretation
- Gear-with-no-applicable-characteristics policy
- Search fields and matching
- Exact filters
- Filter combination
- Active-item policy
- Pagination
- Sorting
- Mobile measurement scope for paginated responses
- Item-response convention
- ETag source and projection policy
- Conditional requests
- Cache-Control
- Error and correlation behaviour
- Files created
- Files modified
- Files intentionally unchanged
- Tests added
- Exact verification commands and results
- Coverage results
- Regression results
- Security and privacy controls
- Performance safeguards
- Approved deviations
- Existing issues not introduced by Step 17
- Work deferred to later steps
- Remaining assumptions, risks, or owner decisions
  if you reach any ambiguity ask me to clarify
