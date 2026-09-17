# Step 18: Implement Port Query Endpoints, Location Search, and Map Projection

## Recommended reasoning effort

- Planning phase: High
- Implementation phase: High
- Defra Sonar review: Medium

## Role

Act as a senior Node.js backend engineer implementing the Reference Data Service for the Catch Recording application.

Implement port query endpoints, location search, and the derived port map projection exactly as defined by Step 18 of the approved Reference Data Service implementation plan.

Do not change, reorder, expand, reduce, or reinterpret the approved plan.

## Approved objective

Expose ports as canonical and mobile JSON representations and as a derived GeoJSON map layer.

## Approved dependency

This step depends on:

- Step 15: Implement the common collection query engine
  Before implementation, verify that Step 15 and all dependencies required by Step 15 are complete.

Also inspect the existing implementations from Steps 16 and 17 for reusable endpoint and projector conventions. Do not modify those implementations unless a regression introduced by Step 18 requires a narrowly scoped correction.

Do not silently implement missing work from another step.

## Mandatory ambiguity rule

If any ambiguity, conflict, missing contract, missing field definition, or inconsistency is discovered:

1. Stop the current planning or implementation activity.
2. Describe the exact ambiguity.
3. Identify the affected file, contract, schema, API requirement, or earlier step.
4. Show the relevant existing implementation.
5. Present the smallest set of viable options.
6. Recommend one option with technical rationale.
7. Explain the impact of each option.
8. Ask me to clarify or approve the decision.
9. Wait for my response before proceeding.
   Do not resolve ambiguity by making an assumption.

In particular, stop and ask for clarification if the approved design or current implementation does not define:

- Exact port query parameter names.
- Case-sensitive or case-insensitive port-code matching.
- Exact or partial general-text matching.
- Whether country-code matching is case-sensitive.
- Radius-search unit.
- Maximum allowed radius.
- Behaviour when radius is zero.
- Behaviour when latitude, longitude, or radius is missing.
- Whether ports exactly on the radius boundary are included.
- Whether invalid stored coordinates are skipped or treated as an error.
- Bounding-box parameter syntax.
- Bounding-box edge inclusion.
- Antimeridian support.
- Whether a bounding box may cross the antimeridian.
- How `displayName` is constructed.
- Whether missing coordinates should be omitted or returned as `null` .
- Whether inactive ports appear in the derived map layer.
- How canonical and mobile ETags differ.
- How the derived map-port ETag is generated.
- Whether map-port metadata should expose the source collection ID.
- Whether distance should be returned in radius-search results.
- Whether location filters combine with text and country filters using AND or OR semantics.
  Do not invent these behaviours.

## Required working mode

Start in Plan mode.

Before proposing changes:

1. Inspect the complete repository.
2. Read the approved Reference Data Service implementation plan.
3. Read the approved prompts and saved plans for Steps 01 through 17.
4. Inspect the implementation completed through Step 17.
5. Inspect the port canonical schema and valid fixtures created in Step 04.
6. Inspect port validation implemented in Step 09.
7. Inspect canonical port normalisation implemented in Step 10.
8. Inspect the In-Memory Data Store implementation.
9. Inspect the Authentication Service integration from Step 12.
10. Inspect common API behaviour and error handling from Step 13.
11. Inspect the manifest API from Step 14.
12. Inspect the common collection query engine from Step 15.
13. Inspect the endpoint, controller, query configuration, projection, testing, and route-registration patterns established in Steps 16 and 17.
14. Inspect the canonical-to-mobile projector contract from Step 03.
15. Inspect the dataset capabilities and confirm:

- `ports` is queryable, uploadable, and persisted.
- `map-ports` is queryable, derived, and not independently persisted or uploadable.

16. Inspect existing geometry, GeoJSON, coordinate, and distance utilities.
17. Inspect existing request validation, response validation, correlation, ETag, cache-header, and error-mapping utilities.
18. Inspect existing test fixtures and SonarCloud conventions.
19. Review the current working tree:
    Shell

```text
git status --short
git diff --stat
```

1. Determine whether port routes, location filtering, or map-port projection have already been partially implemented.
2. Verify partial implementation against the approved Step 18 scope.
3. Identify all ambiguities before completing the plan.
   Do not modify source files during planning.

Produce a concise, file-by-file implementation plan and wait for approval.

After the plan is approved, the first implementation action must be to save the approved plan as:

Plain Text

```text
github-prompts/Step 18-implement-port-query-endpoints-location-search-and-map-projection-plan.md
```

Only after saving the approved plan may source-code implementation begin.

## Approved scope

Implement:

HTTP

```text
GET /api/v1/reference-data/ports
GET /api/v1/reference-data/ports/{id}
GET /api/v1/reference-data/map/ports
```

Support filtering by:

- General text
- Port code
- Country code
- Latitude, longitude, and radius
- Bounding box for the map layer
  Implement distance calculation for radius searches.

Generate the map-port GeoJSON layer from the active canonical ports collection.

Exclude ports without valid coordinates from the map projection while retaining them in the standard JSON collection.

## Approved deliverables

- Port routes
- Port mobile projector
- Location-search implementation
- Derived map-port projector
- GeoJSON response
- Unit tests
- Route-level integration tests

## Architecture context

The standard port query flow must preserve these boundaries:

Plain Text

```text
Port route
  -> Reference Data Controller
  -> Validation Module
  -> Query Module
  -> Common Collection Query Engine
  -> In-Memory Data Store
```

The mobile port flow adds:

Plain Text

```text
Canonical port
  -> Port mobile projector
```

The map-port flow adds:

Plain Text

```text
Canonical ports from In-Memory Data Store
  -> Derived map-port projector
  -> GeoJSON FeatureCollection
```

The derived map-port representation must not be:

- Loaded independently from S3.
- Written independently to S3.
- Stored as an authoritative collection in memory.
- Included as an independently persisted manifest entry.
- Uploaded through a collection-management endpoint.
  Only the canonical `ports` collection is the source of truth.

## Mandatory architecture constraints

### No direct persistence access

The port controller, query configuration, location-search implementation, mobile projector, and map projector must not:

- Import the AWS SDK.
- Access S3.
- Access Floci.
- Call the Persistence Module directly.
- Read port fixture files at runtime.
- Read port JSON files from the file system.
  All active port data must be obtained through the Query Module and In-Memory Data Store contracts.

### No database

Do not introduce:

- MongoDB
- Redis
- DynamoDB
- SQL persistence
- A geospatial database
- An ORM or ODM
- Database models
- Database indexes
- Database queries
- Database connections
  Location searches operate on the active process-local canonical port collection.

### No direct Authentication Service access

The port controller must use the Validation Module for authentication and read authorisation.

Do not:

- Call the Authentication Service directly.
- Decode bearer tokens in the route.
- Trust token claims outside the Validation Module.
- Bypass authentication for the map route unless an approved requirement explicitly allows it.

### No source-data mutation

Port queries and projections must not mutate:

- The active ports collection.
- Port records.
- Coordinate objects.
- Port metadata.
- Query input.
- Projection context.
- The order of ports in the stored collection.

### No independently maintained map-ports data

Do not create:

- A `map-ports` S3 object.
- A `map-ports` manifest entry.
- A separate authoritative map-port collection.
- A map-port upload path.
- A cache-refresh operation specifically loading `map-ports` .
  The derived map layer must be regenerated from the current active canonical ports collection when requested or through an approved safe derived-cache mechanism already established by the architecture.

Do not introduce a new derived-cache mechanism in Step 18 without explicit approval.

### No unrelated endpoint work

Do not implement:

- Species endpoints
- Map-land endpoints
- Statistical-area endpoints
- Upload endpoints
- Item-level port mutations
- Port favourites
- Catch-record functionality
- Seed-data bootstrap
- New authentication behaviour
- New persistence behaviour

## Canonical port model

Use the canonical port schema implemented in Step 04.

The expected conceptual shape is:

JSON

```text
{
  "id": "0f47bc38-bee2-4681-b1f0-dbaeb454d8b3",
  "code": "0349",
  "name": "Plymouth",
  "countryCode": "GBR",
  "coordinate": {
    "latitude": 50.3661,
    "longitude": -4.1427
  },
  "active": true
}
``
```

A port may have no coordinate:

JSON

```text
{
  "id": "4ded7ddd-8385-4559-bbab-3fb7aa63848e",
  "code": "9999",
  "name": "Unknown",
  "countryCode": "GBR",
  "coordinate": null,
  "active": true
}
```

These examples are illustrative. Use the actual Step 04 schema and current implementation as authoritative.

Port code remains a business identifier. It must not replace the port GUID.

## Endpoint 1: Retrieve or search ports

Implement:

HTTP

```text
GET /api/v1/reference-data/ports
```

The endpoint must support:

- Complete collection retrieval according to Step 15.
- Canonical representation.
- Mobile representation.
- General text search.
- Exact port-code filter.
- Country-code filter.
- Latitude, longitude, and radius filter.
- Approved pagination.
- Approved sorting.
- Approved active-state filtering.
- Read authentication and authorisation.
- Correlation handling.
- ETag and conditional requests.
- Standard API errors.
  Do not implement a second generic query engine.

Use the Step 15 extension mechanism for port-specific filters.

## Endpoint 2: Retrieve one port by GUID

Implement:

HTTP

```text
GET /api/v1/reference-data/ports/{id}
``
```

Requirements:

- Resolve the port by GUID.
- Validate the route parameter using existing request-validation conventions.
- Support canonical and mobile representations.
- Return the approved not-found error when the GUID does not exist.
- Require read permission.
- Preserve correlation and caching behaviour.
- Avoid mutating the port.
  Do not accept the port code as the `{id}` value.

For example, a port code such as `0349` is not a substitute for a GUID.

## Endpoint 3: Retrieve derived map ports

Implement:

HTTP

```text
GET /api/v1/reference-data/map/ports
```

The endpoint must:

- Retrieve the active canonical `ports` collection.
- Derive a GeoJSON `FeatureCollection` .
- Include only ports with valid coordinates.
- Preserve port GUIDs.
- Preserve approved port properties.
- Use GeoJSON longitude-first coordinate order.
- Return `application/geo+json` .
- Support approved bounding-box filtering.
- Require read permission.
- Use correlation, ETag, conditional-request, cache-header, and error utilities from previous steps.
- Avoid persisting the derived result.
  Do not query a separate `map-ports` collection from the In-Memory Data Store.

## Representation selection

Use the representation contract and Step 15 query behaviour.

For the standard ports endpoints, support:

Plain Text

```text
canonical
mobile
```

Use the existing approved query parameter, expected to be:

HTTP

```text
?view=canonical
?view=mobile
```

Do not invent another representation parameter.

The `map/ports` endpoint returns GeoJSON and does not use the mobile port JSON projection unless the approved API design explicitly requires representation selection.

If this is unclear, ask for clarification.

## Canonical port response

For `view=canonical` , preserve the canonical port data, including:

- `id`
- `code`
- `name`
- `countryCode`
- `coordinate`
- `active`
  Requirements:

- Do not mutate the canonical item.
- Do not add mobile-only fields.
- Do not remove ports without coordinates.
- Do not expose persistence metadata or internal object keys.
- Use the response envelope established by Step 15 and the approved API design.

## Mobile port projection

Implement a port-specific mobile projector through the canonical-to-mobile projector contract.

The expected conceptual mobile shape is:

JSON

```text
{
  "id": "0f47bc38-bee2-4681-b1f0-dbaeb454d8b3",
  "code": "0349",
  "name": "Plymouth",
  "displayName": "Plymouth",
  "coordinate": {
    "latitude": 50.3661,
    "longitude": -4.1427
  }
}
```

The actual Step 04 schema, approved API design, and current projector conventions are authoritative.

The projector must:

- Preserve the GUID.
- Preserve the port code.
- Preserve the port name.
- Construct or select the approved display name.
- Preserve valid coordinates.
- Follow the approved behaviour for missing coordinates.
- Return a new JSON-compatible object.
- Avoid mutating canonical data.
- Exclude internal metadata.
- Exclude unapproved canonical fields.
  If `displayName` formatting or coordinate omission behaviour is not approved, stop and ask for clarification.

## General text search

Configure general text search using the Step 15 query engine.

Expected searchable fields may include:

- Port name
- Port code
- Country code
  Use only fields approved by the API design and existing conventions.

Do not search arbitrary serialised port objects.

Do not implement:

- Fuzzy matching
- Phonetic matching
- External search
- Regular-expression matching from user input
- Relevance ranking
  Use the Step 15 approved case and partial-match semantics.

## Port-code filter

Support the approved exact port-code filter:

HTTP

```text
GET /api/v1/reference-data/ports?code=0349
```

Requirements:

- Map the filter to the canonical `code` property.
- Keep the port code separate from the GUID.
- Use the matching semantics established in Step 15.
- Return an empty result when no code matches, unless the approved design states otherwise.
- Avoid numeric conversion that would remove leading zeros.
- Treat port codes as strings.
  Do not parse `0349` as a number.

## Country-code filter

Support:

HTTP

```text
GET /api/v1/reference-data/ports?countryCode=GBR
```

Requirements:

- Map the filter to the canonical `countryCode` property.
- Use matching semantics established by Step 15 and the canonical schema.
- Do not make an external country lookup.
- Do not alter the source value.
- Combine with other filters using the approved Step 15 semantics.

## Radius search

Support a location filter using:

- Latitude
- Longitude
- Radius
  Expected conceptual request:

HTTP

```text
GET /api/v1/reference-data/ports?latitude=50.37&longitude=-4.14&radiusKm=25
```

Use the exact parameter names established by the approved API design.

### Radius-search validation

Require all three location parameters together:

- Latitude
- Longitude
- Radius
  If one or two are supplied without the others, return the approved invalid-search error.

Validate:

- Latitude is a finite number between `-90` and `90` .
- Longitude is a finite number between `-180` and `180` .
- Radius is a finite approved value.
- Radius satisfies the approved minimum and maximum limits.
- Numeric parsing rejects partial values such as `25km` .
- `NaN` , `Infinity` , and non-numeric strings are rejected.
  Do not use permissive partial numeric parsing.

### Distance calculation

Implement a well-established spherical distance calculation appropriate for WGS84 latitude and longitude, such as the Haversine formula, unless an approved repository utility already exists.

Requirements:

- Use named constants for Earth radius.
- Use kilometres if the approved parameter is `radiusKm` .
- Convert degrees to radians safely.
- Treat coordinates as latitude and longitude in their named object properties.
- Avoid confusing GeoJSON longitude-first arrays with the canonical coordinate object.
- Include ports whose distance satisfies the approved boundary rule.
- Exclude ports without coordinates.
- Avoid modifying source coordinates.
- Return deterministic results.
  Do not introduce a geospatial dependency unless the repository already uses one or the approved plan explicitly justifies it.

Do not return calculated distance unless the approved API contract requires it.

### Radius-search performance

The approved architecture uses in-memory JSON collections.

Use a clear linear scan unless existing scale evidence requires another approved strategy.

Do not introduce:

- A database
- A spatial index
- An external search service
- A speculative cache
  If collection size presents a material performance risk, document it and ask for clarification rather than changing the architecture.

## GeoJSON map-port projection

Generate a GeoJSON `FeatureCollection` .

Expected conceptual shape:

JSON

```text
{
  "type": "FeatureCollection",
  "metadata": {
    "dataset": "map-ports",
    "sourceDataset": "ports",
    "sourceCollectionId": "0be553de-f430-49f7-b120-1e8e5ad972dc",
    "version": "2026.09.11.1",
    "crs": "EPSG:4326",
    "featureCount": 1
  },
  "features": [
    {
      "type": "Feature",
      "id": "0f47bc38-bee2-4681-b1f0-dbaeb454d8b3",
      "properties": {
        "id": "0f47bc38-bee2-4681-b1f0-dbaeb454d8b3",
        "code": "0349",
        "name": "Plymouth",
        "countryCode": "GBR"
      },
      "geometry": {
        "type": "Point",
        "coordinates": [-4.1427, 50.3661]
      }
    }
  ]
}
```

Use the actual approved API design and existing schema conventions.

### Feature requirements

Each feature must:

- Use `type: "Feature"` .
- Preserve the port GUID as its feature ID.
- Include approved properties only.
- Use `type: "Point"` .
- Store coordinates as `[longitude, latitude]` .
- Contain numeric coordinates.
- Avoid exposing internal metadata.

### FeatureCollection requirements

The collection must:

- Use `type: "FeatureCollection"` .
- Identify `map-ports` as derived.
- Reference the active ports collection using approved metadata.
- Include the active ports collection version.
- Include `EPSG:4326` metadata where approved.
- Include an accurate feature count.
- Exclude ports with missing coordinates.
- Avoid modifying the canonical ports collection.
  Do not create an independently persisted `collectionId` for `map-ports` unless the approved design explicitly requires one.

## Bounding-box filter

Support bounding-box filtering for:

HTTP

```text
GET /api/v1/reference-data/map/ports?bbox=-6.0,49.5,2.0,56.0
```

Use the exact syntax approved by the API design and Step 15 parser conventions.

Expected order:

Plain Text

```text
minimum longitude,
minimum latitude,
maximum longitude,
maximum latitude
```

### Bounding-box validation

Validate:

- Exactly four values are present.
- Every value is a finite number.
- Longitudes are between `-180` and `180` .
- Latitudes are between `-90` and `90` .
- Minimum latitude does not exceed maximum latitude.
- Longitude ordering follows the approved antimeridian policy.
- Partial numeric values are rejected.
- Empty values are rejected.
  If antimeridian-crossing boxes are not explicitly defined, stop and ask for clarification.

### Bounding-box filtering

For each valid map-port feature:

- Include the point when the longitude and latitude satisfy the approved boundary rule.
- Exclude ports without coordinates.
- Preserve source order or apply the approved deterministic ordering.
- Do not mutate the source collection.
  Do not use polygon-intersection libraries for Point features unless an approved dependency already provides the required behaviour.

## Active-state behaviour

Use the common `includeInactive` behaviour from Step 15 for standard port queries.

For the map layer, apply the approved active-state behaviour.

Do not independently decide whether inactive ports appear in `map-ports` .

If the approved design does not define this, ask for clarification.

Do not infer activity from coordinate presence.

## Pagination and sorting

Use the common Step 15 implementation.

Do not duplicate:

- Offset parsing
- Limit parsing
- Maximum-limit enforcement
- Sort syntax
- Sort direction
- Total-count calculation
- Active-state parsing
  Configure only port-specific sortable fields approved by the current design.

Potential fields may include:

- Name
- Code
- Country code
  Do not assume these fields are approved without checking the existing implementation.

Do not paginate GeoJSON map features unless the approved API design explicitly requires pagination for map layers.

If unclear, ask for clarification.

## Authentication and authorisation

Require the approved read permission through the Validation Module.

Expected permission:

Plain Text

```text
reference-data.read
```

Use the final permission value implemented in Step 12 if it differs.

Requirements:

- Missing or invalid credentials map to the approved unauthorised response.
- Missing permission maps to the approved forbidden response.
- Authentication Service unavailability maps to the approved dependency error.
- No route calls the Authentication Service directly.
- No token appears in logs, errors, or responses.
- Apply the approved read-authorisation behaviour consistently to all three routes.

## Error behaviour

Reuse the Step 03 service-error model and Step 13 HTTP error mapping.

Expected cases include:

- Invalid GUID
- Port not found
- Invalid port-code filter
- Invalid country-code filter
- Incomplete radius criteria
- Invalid latitude
- Invalid longitude
- Invalid radius
- Invalid bounding box
- Unsupported representation
- Invalid pagination
- Invalid sorting
- Ports collection not loaded
- Unauthorised
- Forbidden
- Authentication Service unavailable
- Unexpected internal failure
  Do not create a second port-specific error envelope.

Errors must:

- Include the approved correlation identifier.
- Use stable codes.
- Use safe messages.
- Identify invalid query fields where appropriate.
- Avoid returning complete port records.
- Avoid exposing S3 or cache internals.
- Avoid stack traces.
- Avoid bearer tokens.

## ETag and caching

Use the common ETag and cache utilities established by Steps 13 through 15.

Requirements:

- Standard port responses use the approved active collection ETag strategy.
- Mobile representation follows the approved projection ETag strategy.
- Derived `map-ports` has deterministic ETag behaviour tied to the active canonical ports collection and relevant representation rules.
- `If-None-Match` can produce `304` where approved.
- `304` responses contain no body.
- GeoJSON responses use approved cache headers.
- Controllers must not invent independent incompatible checksum logic.
  If the derived map-port ETag strategy is not established, stop and ask for clarification.

## Controller requirements

The Reference Data Controller must:

- Register the three approved routes.
- Parse approved route and query parameters.
- Invoke authentication and authorisation through the Validation Module.
- Invoke the Query Module or approved projection use case.
- Apply response content type, headers, and status.
- Map service errors through the common error mapper.
  The controller must not:

- Access the In-Memory Data Store directly if the Query Module boundary owns access.
- Search arrays directly.
- Calculate distances.
- Build GeoJSON features.
- Access S3 or Floci.
- Call the Authentication Service directly.
- Mutate canonical data.

## Query Module requirements

The Query Module must:

- Use the common Step 15 query engine.
- Use port-specific query configuration.
- Read through the In-Memory Data Store contract.
- Retrieve the active canonical `ports` collection.
- Apply the port mobile projector when requested.
- Apply the derived map-port projector for the map route.
- Preserve query-result and collection metadata.
- Avoid direct infrastructure access.

## Port query configuration

Define a focused port query configuration through the Step 15 extension mechanism.

It should identify:

- Dataset: `ports`
- GUID field: `id`
- Business-code field: `code`
- General text fields
- Country-code filter
- Coordinate-radius filter
- Approved sort fields
- Active-state field
- Mobile projector
- Any approved parameter aliases
  The configuration must not contain:

- Fixture-specific values
- Hapi response objects
- S3 object keys
- Authentication tokens
- Database query syntax

## Test fixtures

Reuse the existing canonical port JSON fixtures where practical.

Add focused synthetic fixtures for:

- Several ports near and outside a radius
- Ports at coordinate boundaries
- Ports without coordinates
- Active and inactive ports
- Ports inside and outside a bounding box
- Exact bounding-box edge cases
- Different country codes
- Leading-zero port codes
- Mobile projection
- Map projection
  Use stable synthetic GUIDs.

Store substantial declarative fixture data in JSON files where consistent with repository and SonarCloud conventions.

Do not include real personal or sensitive operational information.

## Required unit tests

Testing is part of Step 18 and must be completed in this step.

### Port query configuration tests

Verify:

1. Dataset is `ports` .
2. GUID field is `id` .
3. Port code maps to `code` .
4. Country filter maps to `countryCode` .
5. Approved general search fields are configured.
6. Radius filter is registered.
7. Approved sort fields are configured.
8. Active-state behaviour is configured.
9. Mobile projector is configured.
10. Common Step 15 logic is not duplicated.

### Canonical response tests

Verify:

1. GUID is preserved.
2. Port code is preserved as a string.
3. Leading zeros are preserved.
4. Name is preserved.
5. Country code is preserved.
6. Valid coordinate is preserved.
7. Missing coordinate follows the canonical schema.
8. Active state is preserved.
9. No mobile-only fields are added.
10. Canonical input is not mutated.

### Mobile projection tests

Verify:

1. GUID is preserved.
2. Port code is preserved.
3. Name is preserved.
4. Approved display name is produced.
5. Valid coordinate is preserved.
6. Missing coordinate follows the approved convention.
7. Internal metadata is excluded.
8. Unapproved canonical fields are excluded.
9. Canonical input is not mutated.
10. Projection is deterministic.

### General search tests

Verify approved searches by:

- Port name
- Port code
- Country code, if approved as a text field
  Also verify:

- No-match behaviour.
- Matching semantics from Step 15.
- Deterministic ordering.
- No source mutation.

### Filter tests

Verify:

1. Exact port-code filtering.
2. Leading-zero code preservation.
3. Country-code filtering.
4. Combined text and country filter.
5. Combined code and country filter.
6. Unsupported filters are rejected.
7. Invalid empty values follow approved behaviour.
8. Input and source data are not mutated.

### Radius validation tests

Verify:

1. Valid latitude, longitude, and radius.
2. Missing latitude.
3. Missing longitude.
4. Missing radius.
5. Latitude below minimum.
6. Latitude above maximum.
7. Longitude below minimum.
8. Longitude above maximum.
9. Invalid radius.
10. Radius below approved minimum.
11. Radius above approved maximum.
12. Partial numeric input.
13. `NaN` equivalent input.
14. Infinite-value equivalent input.
15. Boundary coordinate values.

### Distance calculation tests

Use named and documented test coordinates.

Verify:

1. Same point returns zero distance.
2. Known points produce a result within a documented tolerance.
3. Port inside the radius is included.
4. Port outside the radius is excluded.
5. Port on the approved radius boundary follows the approved inclusion rule.
6. Port without coordinates is excluded.
7. Distance calculation does not mutate coordinates.
8. Latitude and longitude are not reversed.
9. Result ordering is deterministic.
10. Distance is not exposed unless approved.
    Avoid brittle assertions requiring unrealistic floating-point equality.

### Individual port retrieval tests

Verify:

1. Existing GUID returns a port.
2. Unknown valid GUID returns the approved not-found error.
3. Invalid GUID returns the approved request error.
4. Port code in the path is not treated as a GUID.
5. Canonical representation is supported.
6. Mobile representation is supported.
7. Source data is not mutated.

### Map-port projection tests

Verify:

1. Result is a GeoJSON `FeatureCollection` .
2. Dataset is identified as `map-ports` .
3. Source dataset is identified as `ports` .
4. Source collection ID is preserved where approved.
5. Source collection version is preserved.
6. CRS metadata follows the approved design.
7. Feature count is correct.
8. A valid port becomes a Point feature.
9. Feature ID is the port GUID.
10. Approved properties are present.
11. Coordinates use `[longitude, latitude]` .
12. Coordinates are numeric.
13. Ports without coordinates are excluded.
14. Canonical ports remain unchanged.
15. Derived output is deterministic.
16. `map-ports` is not stored independently.

### Bounding-box tests

Verify:

1. Valid bounding box is accepted.
2. Port inside is included.
3. Port outside is excluded.
4. Port on each boundary follows the approved inclusion rule.
5. Fewer than four values are rejected.
6. More than four values are rejected.
7. Empty values are rejected.
8. Non-numeric values are rejected.
9. Partial numeric values are rejected.
10. Invalid latitude ranges are rejected.
11. Invalid longitude ranges are rejected.
12. Minimum latitude above maximum latitude is rejected.
13. Longitude ordering follows the approved antimeridian rule.
14. Ports without coordinates are excluded.
15. Source data is not mutated.

### Active-state tests

Verify:

1. Default standard port query behaviour.
2. `includeInactive=false` .
3. `includeInactive=true` .
4. Strict boolean parsing.
5. Invalid boolean rejection.
6. Approved map-port active-state behaviour.
7. Active state is not inferred from coordinate presence.

### Pagination and sorting tests

Verify:

1. Search pagination uses Step 15.
2. Total count is calculated before pagination.
3. Maximum limit is enforced.
4. Approved sorting works.
5. Sorting does not mutate source data.
6. Full collection retrieval is not accidentally truncated.
7. Map-port pagination follows the approved API behaviour.

### Authentication tests

Verify:

1. Missing credentials return unauthorised.
2. Invalid credentials return unauthorised.
3. Missing read permission returns forbidden.
4. Read permission allows access.
5. Authentication Service unavailability maps correctly.
6. No token is exposed.
7. Controllers do not call Authentication Service directly.

### ETag and cache tests

Verify:

1. Port JSON responses include the approved ETag.
2. Mobile responses follow approved ETag behaviour.
3. Map-port responses have deterministic ETag behaviour.
4. Matching `If-None-Match` can return `304` .
5. `304` has no body.
6. Approved cache headers are returned.
7. Derived map ETag changes when the source ports collection changes.
8. Controllers do not calculate incompatible ETags.

### Error tests

Verify:

1. Invalid GUID uses the standard error.
2. Unknown GUID uses the standard not-found error.
3. Invalid location parameters use the standard validation error.
4. Invalid bounding boxes use the standard validation error.
5. Unsupported representation uses the standard error.
6. Unloaded ports collection maps correctly.
7. Correlation ID is included.
8. Stack traces are not exposed.
9. S3 and store internals are not exposed.
10. Complete port records are not included in errors.

## Route-level integration tests

Use Hapi injection and existing dependency-injection conventions.

Test:

HTTP

```text
GET /api/v1/reference-data/ports
GET /api/v1/reference-data/ports/{id}
GET /api/v1/reference-data/map/ports
```

Cover:

1. Full canonical port collection.
2. Full mobile port collection.
3. General text search.
4. Port-code filter.
5. Country-code filter.
6. Valid radius search.
7. Invalid or incomplete radius search.
8. Pagination.
9. Sorting.
10. Include-inactive behaviour.
11. Existing port by GUID.
12. Unknown port GUID.
13. Invalid GUID.
14. Canonical single-port response.
15. Mobile single-port response.
16. Complete GeoJSON map-port response.
17. Bounding-box-filtered map response.
18. Port without coordinates omitted from map response.
19. Port without coordinates retained in JSON response.
20. Correct GeoJSON content type.
21. Conditional request returning `304` .
22. Unauthorised request.
23. Forbidden request.
24. Authentication Service unavailable.
25. Ports collection unavailable.
26. Correlation-header propagation.
27. Standard error envelope.
28. Absence of independently persisted map-port data.
    Tests must use:

- The In-Memory Data Store or approved test double.
- The Validation Module test implementation.
- No real Authentication Service.
- No S3.
- No Floci.
- No database.
- No Redis.

## Architecture-boundary tests

Add or update tests confirming:

1. Port routes do not import the AWS SDK.
2. Port query code does not import the Persistence Module.
3. Port routes do not import the Authentication Service client.
4. Only the Query Module accesses the In-Memory Data Store according to the approved boundary.
5. `map-ports` is not independently persisted.
6. `map-ports` has no upload registration.
7. No database or Redis dependency is introduced.
8. No Step 19 or Step 20 endpoints are added.

## Regression testing

Run:

- Port query configuration tests.
- Port mobile projector tests.
- Radius-search tests.
- Distance-calculation tests.
- Map-port projector tests.
- Bounding-box tests.
- Port route integration tests.
- Step 15 common query-engine tests.
- Step 13 common API tests.
- Step 12 authentication tests.
- Existing Step 16 and Step 17 tests.
- The complete repository test suite.
- Test coverage.
- Linting.
- Formatting checks.
  Do not defer Step 18 tests to Steps 26 through 28.

## Defra SonarCloud review

After implementation and tests pass, analyse all code created or modified by Step 18 against the configured Defra SonarCloud rules.

Use the repository’s configured SonarCloud project and:

Plain Text

```text
https://sonarcloud.io/organizations/defra/rules
```

Review for:

- Magic numbers
- Hardcoded Earth radius
- Hardcoded coordinate limits
- Hardcoded radius limits
- Duplicate query parameter strings
- Excessive cognitive complexity
- Duplicate filtering logic
- Deep conditionals
- Unsafe numeric parsing
- Floating-point comparison issues
- Latitude and longitude reversal
- Input mutation
- In-place sorting
- Unsafe regular expressions
- Unhandled promise rejections
- Broad catch blocks
- Dead code
- Unused exports
- Weak assertions
- Sensitive-data logging
- Incorrect GeoJSON
- Incorrect HTTP content type
- Incorrect ETag handling
- Missing authentication checks
- Port codes converted to numbers
- Business codes used as GUIDs
- Direct S3 access
- Persisted derived map-port data
  Use named constants for approved mathematical and geographic values.

Use JSON files for substantial declarative fixtures where consistent with repository conventions.

Do not resolve findings by:

- Disabling Sonar rules globally
- Adding broad suppressions
- Excluding port files
- Weakening tests
- Removing assertions
- Changing approved API behaviour silently
  For each Step 18 finding:

1. Record the rule identifier.
2. Identify the file and line.
3. Explain the risk.
4. Apply the smallest scope-safe correction.
5. Rerun focused tests.
6. Rerun linting and formatting.
7. Rerun available Sonar analysis.
   If a finding requires changing an approved contract or behaviour, stop and ask for clarification.

If SonarCloud runs only in CI, state clearly that final verification remains pending CI.

## Security and privacy considerations

- Require read authentication for all three routes.
- Never log bearer tokens.
- Never expose S3 information.
- Never expose stack traces.
- Do not expose complete stored collections in errors.
- Validate all location parameters strictly.
- Use bounded radius limits.
- Avoid expensive uncontrolled computations.
- Do not construct dynamic executable expressions.
- Preserve port-code strings and leading zeros.
- Prevent canonical data mutation.
- Use synthetic port data in tests.
- Do not add user-specific or favourite data.
- Do not persist derived GeoJSON output.
- Expose only approved properties in map features.
- Preserve correlation identifiers safely.

## Documentation requirements

Add or update focused documentation covering:

- Port collection endpoint.
- Port-by-GUID endpoint.
- Derived map-port endpoint.
- Supported port query parameters.
- General text search.
- Port-code filter.
- Country-code filter.
- Radius-search parameters and units.
- Radius validation.
- Bounding-box syntax.
- Coordinate order.
- Canonical port representation.
- Mobile port representation.
- GeoJSON map-port representation.
- Ports without coordinates.
- GUID versus port code.
- Active-state behaviour.
- Authentication requirements.
- ETag and conditional requests.
- Standard errors.
- Derived and non-persisted status of `map-ports` .
  Do not duplicate the full implementation plan or API design.

## In scope

- Port collection GET route
- Port-by-GUID GET route
- Derived map-port GET route
- Port query configuration
- General port search
- Port-code filter
- Country-code filter
- Radius search
- Distance calculation
- Mobile port projector
- Derived GeoJSON projector
- Bounding-box filtering
- Read authorisation integration
- ETag and conditional-request integration
- Standard error integration
- Unit tests
- Route-level integration tests
- Architecture-boundary tests
- Defra Sonar review
- Focused documentation

## Out of scope

Do not implement:

- Changes to the approved plan
- Port schema redesign
- Port validation redesign
- New persistence behaviour
- Direct S3 or Floci access
- Persisted `map-ports`
- `map-ports` upload
- Cache-refresh redesign
- Authentication Service contract changes
- Login or token issuance
- Species endpoints
- Map-land endpoints
- Statistical-area endpoints
- Favourites
- Catch records
- Port item mutation
- Upload validation
- Full collection replacement
- Seed-data bootstrap
- New database functionality
- Redis
- New geospatial database or search service
- Final OpenAPI work assigned to Step 31
- Metrics or audit work assigned to Step 25
- Deployment infrastructure

## Expected deliverables

The approved Step 18 deliverables are:

1. Port routes.
2. Port mobile projector.
3. Location-search implementation.
4. Derived map-port projector.
5. GeoJSON response.
6. Unit tests.
7. Route-level integration tests.
   Also produce:

8. Approved implementation plan saved as:
   Plain Text

```text
github-prompts/Step 18-implement-port-query-endpoints-location-search-and-map-projection-plan.md
```

1. Architecture-boundary verification.
2. Focused port endpoint documentation.
3. Defra SonarCloud review result for Step 18 changes.

## Approved completion criteria

The step must satisfy the approved plan criteria:

- Port GUID remains the resource ID.
- Port code remains separately searchable.
- Radius search validates all required parameters.
- Map ports are not independently persisted or uploaded.
- Port JSON and map projections cannot drift.
  The implementation must also demonstrate:

- All three approved routes are registered.
- Read permission is enforced.
- General search and filters reuse Step 15.
- Ports without coordinates remain in normal JSON results.
- Ports without coordinates are excluded from GeoJSON.
- GeoJSON coordinates use longitude-first order.
- Bounding-box filtering is deterministic.
- Distance calculations use approved units and limits.
- Canonical, mobile, and map responses originate from the same active ports collection.
- Projections do not mutate canonical data.
- Standard errors and ETags reuse common utilities.
- Required unit and integration tests pass.
- No later-step functionality is implemented.
- Step 18 code has been reviewed against Defra SonarCloud rules.

## Verification

Inspect `package.json` and use the repository’s actual scripts.

Run the applicable equivalents of:

Shell

```text
npm test -- <port-query-configuration-tests>
npm test -- <port-mobile-projector-tests>
npm test -- <location-search-tests>
npm test -- <map-port-projector-tests>
npm test -- <port-route-tests>
npm test -- <architecture-boundary-tests>
npm test
npm run test:coverage
npm run lint
npm run format:check
```

Run the repository’s Sonar or static-analysis command if one exists.

Format every file created or modified by Step 18.

If the repository-wide formatting check reports unrelated generated artifacts:

1. Confirm every file changed by Step 18 passes Prettier.
2. Do not reformat unrelated generated conversation or metadata files.
3. Report remaining warnings accurately.
4. Do not claim that the repository-wide command passed if it failed.
   If a pre-existing failure occurs:

5. Record the exact command.
6. Record the relevant output.
7. Determine whether Step 18 caused it.
8. Fix failures introduced by Step 18.
9. Do not broaden the scope silently.
10. Ask for clarification if resolution requires unrelated work.
    No real S3, Floci, Authentication Service, database, or Redis integration is required for Step 18 route tests.

## Final response requirements

After implementation, report:

1. Summary of completed work.
2. Saved Step 18 plan path.
3. Files created.
4. Files modified.
5. Port routes implemented.
6. Supported query parameters.
7. General search fields.
8. Port-code matching behaviour.
9. Country-code matching behaviour.
10. Mobile field mapping.
11. Missing-coordinate behaviour.
12. Radius units and validation.
13. Distance-calculation approach.
14. Radius-boundary behaviour.
15. Bounding-box syntax and boundary behaviour.
16. Antimeridian policy.
17. Map-port GeoJSON structure.
18. Map-port metadata.
19. Active-state behaviour.
20. Pagination and sorting behaviour.
21. Authentication and authorisation behaviour.
22. ETag and conditional-request behaviour.
23. Standard error behaviour.
24. Unit tests and results.
25. Route integration tests and results.
26. Complete test-suite result.
27. Coverage result.
28. Lint result.
29. Formatting result.
30. Architecture-boundary result.
31. Defra SonarCloud analysis method.
32. Sonar findings introduced by Step 18.
33. Sonar fixes applied.
34. Whether final SonarCloud CI verification remains pending.
35. Confirmation that port GUID remains the resource ID.
36. Confirmation that port code remains a separate business identifier.
37. Confirmation that `map-ports` was not independently persisted or uploaded.
38. Confirmation that no database or Redis functionality was introduced.
39. Confirmation that no direct S3, Floci, or Authentication Service access was added.
40. Confirmation that no later-step functionality was implemented.
41. Work deferred to subsequent approved steps.
42. Remaining ambiguities, risks, or owner decisions.
    Do not modify the approved implementation plan.

If you reach any ambiguity, ask me to clarify.
