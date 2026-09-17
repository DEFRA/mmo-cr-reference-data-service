# Step 20: Implement Map-Location Query Endpoints

## Recommended reasoning effort

- Planning phase: High
- Implementation phase: High
- Defra Sonar review: Medium

## Role

Act as a senior Node.js backend engineer implementing the Reference Data Service for the Catch Recording application.

Implement the map-location query endpoints exactly as defined by Step 20 of the approved Reference Data Service implementation plan.

Do not change, reorder, expand, reduce, or reinterpret the approved implementation plan.

## Approved objective

Expose land and statistical-area reference data using GeoJSON.

## Approved dependencies

This step depends on:

- Step 13: Implement common API behaviour and error handling
- Step 15: Implement the common collection query engine
  Before implementation, verify that Step 13, Step 15, and their required dependencies are complete.

Inspect the implementations from Steps 16 through 19 for reusable route, controller, query, testing, authentication, ETag, and error-handling conventions.

Do not silently implement missing work belonging to another step.

## Mandatory ambiguity rule

If any ambiguity, conflict, missing contract, missing field definition, or inconsistency is discovered:

1. Stop the current planning or implementation activity.
2. Describe the exact ambiguity.
3. Identify the affected requirement, file, schema, contract, or previous implementation step.
4. Show the relevant existing implementation.
5. Present the smallest set of viable options.
6. Recommend one option with technical rationale.
7. Explain the impact of each option.
8. Ask me to clarify or approve the decision.
9. Wait for my response before proceeding.
   Do not resolve ambiguity by making an assumption.

In particular, stop and ask for clarification if the approved design or current implementation does not define:

- Whether the land endpoint returns one `FeatureCollection` or another GeoJSON root type.
- Whether a land feature can be retrieved individually.
- Whether statistical-area `{id}` refers only to the feature GUID.
- Whether an area code may ever be accepted through the `{id}` route.
- Exact query parameter names.
- Exact versus partial text matching.
- Case-sensitive or case-insensitive area-code matching.
- Parent-code matching semantics.
- Bounding-box parameter syntax.
- Bounding-box boundary inclusion.
- Antimeridian support.
- Handling of bounding boxes that cross the antimeridian.
- Whether polygon intersection means any overlap, containment, centroid inclusion, or another rule.
- Whether holes inside polygons affect bounding-box matching.
- Whether malformed persisted geometry causes the entire request to fail or the affected feature to be excluded.
- Whether map responses are paginated.
- Whether map responses support canonical and mobile views.
- Whether inactive statistical areas exist and how they are filtered.
- Whether land features have searchable names or codes.
- Whether statistical areas with unresolved optional parent codes remain queryable.
- How ETags are generated for filtered GeoJSON responses.
- What cache headers apply to complete and filtered map responses.
- Whether CRS information is represented in metadata and its exact shape.
- Maximum bounding-box query size or maximum returned geometry size.
- Whether geometry simplification is required.
- Whether output feature order follows canonical source order or an approved sort order.
  Do not invent these behaviours.

## Required working mode

Start in Plan mode.

Before proposing changes:

1. Inspect the complete repository.
2. Read the approved Reference Data Service implementation plan.
3. Read the approved implementation prompts and saved plans for Steps 01 through 19.
4. Inspect the implementation completed through Step 19.
5. Inspect the canonical map schemas and valid fixtures created in Step 04:

- `map-land`
- `map-statistical-areas`

6. Inspect map validation implemented in Step 09.
7. Inspect map normalisation implemented in Step 10.
8. Inspect the In-Memory Data Store implementation.
9. Inspect the Authentication Service integration from Step 12.
10. Inspect common API behaviour and error handling from Step 13.
11. Inspect the manifest API from Step 14.
12. Inspect the common collection query engine from Step 15.
13. Inspect map-port GeoJSON and bounding-box conventions implemented in Step 18.
14. Inspect endpoint, query-configuration, testing, ETag, and route-registration patterns from Steps 16 through 19.
15. Inspect the dataset capabilities and confirm:

- `map-land` is queryable, uploadable, persisted, and GeoJSON.
- `map-statistical-areas` is queryable, uploadable, persisted, and GeoJSON.
- `map-ports` remains outside Step 20 because it was implemented as a derived layer in Step 18.

16. Inspect existing geometry and bounding-box utilities.
17. Inspect existing request validation, response validation, correlation, cache-header, and service-error utilities.
18. Inspect current map fixtures and test conventions.
19. Inspect current Defra SonarCloud conventions and configuration.
20. Review the current working tree:
    Shell

```text
git status --short
git diff --stat
```

1. Determine whether any Step 20 routes, map query configurations, or spatial filters have already been partially implemented.
2. Verify partial implementation against the approved Step 20 scope.
3. Identify all ambiguities before completing the implementation plan.
   Do not modify source files during planning.

Produce a concise, file-by-file implementation plan and wait for approval.

After the plan is approved, the first implementation action must be to save the approved plan as:

Plain Text

```text
github-prompts/Step 20-implement-map-location-query-endpoints-plan.md
```

Only after saving the approved plan may source-code implementation begin.

## Approved scope

Implement:

HTTP

```text
GET /api/v1/reference-data/map/land
GET /api/v1/reference-data/map/statistical-areas
GET /api/v1/reference-data/map/statistical-areas/{id}
``
```

Support filtering by:

- General query
- Area code
- Parent code
- Bounding box
  Ensure responses use:

- `application/geo+json`
- WGS84
- Longitude before latitude
- Numeric coordinates
- GUID feature IDs

## Approved deliverables

- Map routes
- Bounding-box filter
- Statistical-area search
- GeoJSON response handling
- Unit tests
- Route-level integration tests

## Architecture context

The map-location query flow must preserve these boundaries:

Plain Text

```text
Map route
  -> Reference Data Controller
  -> Validation Module
  -> Query Module
  -> Common Collection Query Engine
  -> In-Memory Data Store
```

For spatial filtering:

Plain Text

```text
Canonical GeoJSON FeatureCollection
  -> Approved bounding-box filter
  -> Filtered GeoJSON FeatureCollection
```

The active canonical map collections remain the source of truth.

The Query Module must retrieve map collections through the In-Memory Data Store contract.

## Mandatory architecture constraints

### No direct persistence access

The map controller, map query configuration, and spatial-filter utilities must not:

- Import the AWS SDK.
- Access S3.
- Access Floci.
- Call the Persistence Module directly.
- Read GeoJSON fixture files at runtime.
- Read map files from the file system.
  All active map data must come through the Query Module and In-Memory Data Store contracts.

### No database

Do not introduce:

- MongoDB
- Redis
- DynamoDB
- SQL persistence
- A spatial database
- PostGIS
- Elasticsearch
- An ORM or ODM
- Database indexes
- Database queries
- Database connections
  Spatial filtering must operate on the process-local canonical GeoJSON collections.

### No direct Authentication Service access

The map controller must use the Validation Module for authentication and read authorisation.

Do not:

- Call the Authentication Service directly.
- Decode bearer tokens in routes.
- Trust token claims outside the Validation Module.
- Bypass the approved read permission.

### No source-data mutation

Map queries and spatial filters must not mutate:

- The active GeoJSON collections.
- Feature arrays.
- Feature properties.
- Geometry objects.
- Coordinate arrays.
- Collection metadata.
- Query input.
- Bounding-box input.
- Stored feature ordering.

### No geometry normalisation

Do not:

- Convert coordinate reference systems.
- Change coordinate order.
- Close polygon rings.
- Repair malformed geometry.
- Simplify geometry.
- Round coordinates.
- Generate centroids.
- Generate missing GUIDs.
- Generate missing area codes.
- Modify parent relationships.
  Normalisation was implemented in Step 10.

Step 20 consumes canonical WGS84 GeoJSON.

### No unrelated endpoint work

Do not implement:

- Port map endpoints already assigned to Step 18.
- Vessel endpoints.
- Gear endpoints.
- Port JSON endpoints.
- Species endpoints.
- Upload endpoints.
- Item-level mutations.
- Seed-data bootstrap.
- New persistence behaviour.
- New cache-refresh behaviour.
- New authentication behaviour.

## Canonical map-land model

Use the canonical `map-land` schema and fixtures implemented in Step 04.

The root must remain a valid GeoJSON `FeatureCollection` .

Supported canonical geometry types are those approved by the schema, expected to include:

- `Polygon`
- `MultiPolygon`
  Every maintained feature must preserve its GUID.

Coordinates must remain:

- Numeric
- WGS84
- Longitude first
- Latitude second
  Do not introduce an alternative map model.

## Canonical statistical-area model

Use the canonical `map-statistical-areas` schema implemented in Step 04.

The expected conceptual feature shape is:

JSON

```text
{
  "type": "Feature",
  "id": "12639177-7614-4616-83cd-6141ecb83924",
  "properties": {
    "id": "12639177-7614-4616-83cd-6141ecb83924",
    "code": "27D86",
    "name": "ICES subrectangle 27D86",
    "areaType": "ices-subrectangle",
    "parentCode": "27D8",
    "parentName": "ICES rectangle 27D8",
    "areaKm2": 312.48,
    "centroid": {
      "latitude": 50.25,
      "longitude": -4.5
    }
  },
  "geometry": {
    "type": "Polygon",
    "coordinates": []
  }
}
```

This example is illustrative.

Use the actual Step 04 schema and existing implementation as authoritative.

The feature GUID is the resource identifier.

The statistical-area code remains a business identifier.

## Endpoint 1: Retrieve map land

Implement:

HTTP

```text
GET /api/v1/reference-data/map/land
```

The endpoint must:

- Retrieve the active canonical `map-land` collection through the Query Module.
- Return a valid GeoJSON `FeatureCollection` .
- Use `application/geo+json` .
- Preserve GUID feature identifiers.
- Preserve canonical geometry.
- Preserve numeric longitude-first coordinates.
- Support the approved bounding-box filter.
- Require approved read authorisation.
- Use existing correlation, ETag, cache-header, and error utilities.
- Avoid mutating the canonical collection.
  Do not add text, code, or parent-code filters to land unless the approved API design explicitly assigns those filters to land.

If the filter applicability is unclear, ask for clarification.

## Endpoint 2: Retrieve or search statistical areas

Implement:

HTTP

```text
GET /api/v1/reference-data/map/statistical-areas
```

The endpoint must:

- Retrieve the active canonical `map-statistical-areas` collection.
- Return a GeoJSON `FeatureCollection` .
- Support general query.
- Support exact area-code filtering.
- Support parent-code filtering.
- Support bounding-box filtering.
- Use `application/geo+json` .
- Preserve GUID feature identifiers.
- Preserve canonical properties and geometry.
- Require approved read authorisation.
- Use common query, correlation, ETag, cache, and error behaviour.
- Avoid mutating the canonical collection.
  Reuse the Step 15 query engine and its dataset-filter extension mechanism where applicable.

Do not create a second general query engine.

## Endpoint 3: Retrieve one statistical area by GUID

Implement:

HTTP

```text
GET /api/v1/reference-data/map/statistical-areas/{id}
```

Requirements:

- Resolve the feature by GUID.
- Validate the route parameter using existing validation conventions.
- Return a valid GeoJSON `Feature` .
- Return `application/geo+json` .
- Return the approved not-found error when the GUID does not exist.
- Require read permission.
- Preserve correlation and caching behaviour.
- Avoid mutating the canonical feature.
  Do not accept a statistical-area code as the `{id}` value.

Area code remains a searchable business identifier rather than a technical resource identifier.

## GeoJSON response requirements

### FeatureCollection responses

Collection endpoints must return:

JSON

```text
{
  "type": "FeatureCollection",
  "features": []
}
```

Include only metadata approved by the existing API design.

Do not add custom top-level properties that would conflict with the current canonical schema or GeoJSON response contract.

If collection metadata is approved, preserve:

- Dataset
- Collection GUID
- Collection version
- Schema version
- Feature count
- WGS84 or CRS indication
  Do not expose:

- S3 object keys
- AWS metadata
- Authentication data
- Internal cache details

### Individual feature response

The `{id}` endpoint must return:

JSON

```text
{
  "type": "Feature",
  "id": "12639177-7614-4616-83cd-6141ecb83924",
  "properties": {},
  "geometry": {}
}
```

Preserve the canonical feature properties and geometry.

Do not wrap the feature in another `FeatureCollection` unless the approved API design explicitly requires that behaviour.

### Content type

Use:

Plain Text

```text
application/geo+json
```

Do not return a GeoJSON body with a generic text content type.

Use the existing Step 13 content-type utilities.

### Coordinate rules

Every returned coordinate must:

- Remain a JSON number.
- Use WGS84.
- Use longitude-first ordering.
- Remain unchanged from the canonical collection.
  Do not transform canonical coordinates during retrieval.

## Statistical-area general query

Support a general query through the Step 15 search mechanism.

Potential approved searchable fields include:

- Area name
- Area code
- Area type
- Parent code
- Parent name
  Use only fields approved by the API design and current schema.

Do not:

- Search serialised geometry.
- Search coordinate arrays.
- Search GUIDs as general text unless explicitly approved.
- Use caller-provided regular expressions.
- Implement fuzzy or phonetic search.
- Introduce an external search engine.
  Use the matching semantics established in Step 15.

## Area-code filter

Support exact area-code filtering.

Expected conceptual request:

HTTP

```text
GET /api/v1/reference-data/map/statistical-areas?code=27D86
```

Use the exact query parameter defined by the approved API design.

Requirements:

- Map the filter to the canonical area-code property.
- Preserve the area code as a string.
- Keep the area code separate from the feature GUID.
- Use approved casing semantics.
- Use exact matching for explicit code filters.
- Return an empty `FeatureCollection` when no code matches, unless the approved API contract states otherwise.
- Do not interpret the code as a numeric value.

## Parent-code filter

Support parent-code filtering.

Expected conceptual request:

HTTP

```text
GET /api/v1/reference-data/map/statistical-areas?parentCode=27D8
```

Requirements:

- Map the filter to the canonical parent-code property.
- Treat missing optional parent codes safely.
- Use approved exact and casing semantics.
- Avoid inferring parent codes from area-code prefixes.
- Avoid resolving parent relationships through persistence.
- Preserve canonical feature properties.
- Combine with other filters according to Step 15 semantics.
  Do not reject otherwise valid features merely because an optional parent code is absent.

Use the final parent-reference decisions established during Step 09.

## Filter combination

Use the Step 15 approved filter-combination semantics.

Examples include:

HTTP

```text
?query=rectangle&parentCode=27D8
```

HTTP

```text
?code=27D86&bbox=-6,49,2,56
``
```

HTTP

```text
?query=ices&parentCode=27D8&bbox=-6,49,2,56
```

Do not independently choose AND or OR semantics.

If Step 15 does not establish the required behaviour, ask for clarification.

## Bounding-box filter

Support an approved bounding-box query.

Expected conceptual syntax:

HTTP

```text
?bbox=-6.0,49.5,2.0,56.0
```

Expected coordinate order:

Plain Text

```text
minimum longitude,
minimum latitude,
maximum longitude,
maximum latitude
```

Use the exact syntax established by the approved API design and Step 18 conventions.

Do not create a second incompatible bounding-box syntax.

### Bounding-box validation

Validate:

- Exactly four values.
- Every value is a finite number.
- Minimum and maximum longitude are within `-180` to `180` .
- Minimum and maximum latitude are within `-90` to `90` .
- Minimum latitude does not exceed maximum latitude.
- Longitude ordering follows the approved antimeridian policy.
- Empty values are rejected.
- Partial numeric values are rejected.
- `NaN` and infinite values are rejected.
- Unexpected extra delimiters are rejected.
  Use named constants for coordinate boundaries.

Do not use permissive partial parsing.

### Spatial matching semantics

Apply the approved bounding-box matching rule.

For Polygon and MultiPolygon features, the implementation must explicitly use the approved definition of a match.

Possible definitions include:

- Geometry intersects the bounding box.
- Geometry is completely contained by the bounding box.
- Geometry centroid is inside the bounding box.
- At least one coordinate is inside the bounding box.
  Do not choose one of these silently.

Use the existing approved geometry utility if Step 18 or another earlier step established one that correctly supports Polygon and MultiPolygon intersection.

A point-only bounding-box utility from Step 18 must not be assumed to support polygons.

### Polygon and MultiPolygon support

Spatial filtering must handle:

- Polygon exterior rings
- Polygon holes where relevant
- MultiPolygon geometry
- Boundary contact
- Bounding box entirely inside a polygon
- Polygon entirely inside a bounding box
- Disjoint geometry
  Do not implement a geometrically incorrect vertex-only test if the approved requirement is true intersection, because a bounding box can be inside a polygon without containing any polygon vertex.

If a new geometry library is required:

1. Stop during planning.
2. Identify the exact requirement.
3. Evaluate existing dependencies.
4. Explain the security, size, licence, maintenance, and Sonar implications.
5. Recommend the smallest appropriate option.
6. Ask for approval before adding the dependency.
   Do not add a large geospatial dependency without approval.

### Antimeridian behaviour

If antimeridian-crossing bounding boxes are approved:

- Implement and test them explicitly.
- Ensure longitude comparisons are correct.
- Avoid assuming minimum longitude must always be less than maximum longitude.
  If antimeridian support is not defined, ask for clarification.

Do not silently reject or incorrectly process such requests.

### Spatial-filter results

The filtered response must:

- Remain valid GeoJSON.
- Preserve complete matched features.
- Preserve canonical geometry coordinates.
- Include an accurate feature count where metadata requires one.
- Preserve deterministic feature ordering.
- Avoid mutating the active canonical collection.

## Query Module requirements

The Query Module must:

- Use the common Step 15 query engine.
- Use map-specific query configuration.
- Read through the In-Memory Data Store contract.
- Retrieve the active `map-land` or `map-statistical-areas` collection.
- Use approved pure spatial-filter utilities.
- Preserve canonical collection and feature metadata.
- Avoid direct persistence access.
- Avoid direct Authentication Service access.
  Do not create a separate map storage service.

## Map query configuration

Define focused query configuration for:

### Map land

- Dataset: `map-land`
- Feature accessor
- GUID field
- Approved bounding-box filter
- Approved sorting or source-order behaviour
- GeoJSON format

### Map statistical areas

- Dataset: `map-statistical-areas`
- Feature accessor
- GUID field
- Area-code field
- General search fields
- Area-code filter
- Parent-code filter
- Bounding-box filter
- Approved sorting or source-order behaviour
- GeoJSON format
  Do not include:

- Fixture-specific values
- Hapi response objects
- AWS metadata
- Authentication tokens
- Database query syntax
- Executable caller-supplied property paths

## Pagination and sorting

Use the approved Step 15 behaviour only if the API design applies pagination or sorting to map responses.

Do not assume that large GeoJSON responses are paginated.

If map pagination is not defined, stop and ask for clarification.

If pagination is not approved:

- Do not return misleading offset and limit metadata.
- Preserve the approved full-layer response behaviour.
  If sorting is approved:

- Restrict sorting to approved feature properties.
- Do not sort coordinate arrays.
- Do not mutate source features.
- Use deterministic tie-breaking.

## Authentication and authorisation

Require the approved read permission through the Validation Module.

Expected permission:

Plain Text

```text
reference-data.read
```

Use the final permission value implemented in Step 12 if different.

Requirements:

- Missing or invalid credentials map to unauthorised.
- Missing read permission maps to forbidden.
- Authentication Service unavailability maps to the approved dependency error.
- No route calls the Authentication Service directly.
- No token appears in logs, errors, or responses.
- Apply the approved read policy consistently to all three routes.

## Error behaviour

Reuse the Step 03 service-error model and Step 13 HTTP mappings.

Expected cases include:

- Invalid statistical-area GUID
- Statistical area not found
- Invalid general query
- Invalid area code
- Invalid parent code
- Invalid bounding box
- Unsupported filter
- Map collection not loaded
- Invalid canonical geometry encountered during query
- Unauthorised request
- Forbidden request
- Authentication Service unavailable
- Unexpected internal failure
  Do not create a new map-specific public error envelope.

Errors must:

- Include the approved correlation identifier.
- Use stable error codes.
- Use safe messages.
- Identify invalid query fields where applicable.
- Avoid returning complete geometry.
- Avoid returning complete features.
- Avoid exposing S3 or cache internals.
- Avoid exposing stack traces.
- Avoid exposing bearer tokens.

## ETag and caching

Use common ETag and cache utilities established by Steps 13 through 15.

Requirements:

- Complete map responses use the approved active collection ETag.
- Filtered map responses use deterministic approved ETag behaviour.
- Matching `If-None-Match` can return `304` .
- A `304` response contains no body.
- GeoJSON responses use approved cache headers.
- ETag behaviour must account for query filters if the filtered body differs.
- Controllers must not implement an incompatible local checksum strategy.
- The ETag must change when the active source collection changes.
  If filtered-response ETag behaviour is not established, ask for clarification.

## Controller requirements

The Reference Data Controller must:

- Register all three approved routes.
- Parse approved route and query parameters.
- Invoke authentication and authorisation through the Validation Module.
- Invoke the Query Module.
- Apply GeoJSON content type.
- Apply approved cache and ETag headers.
- Map service errors through common error handling.
  The controller must not:

- Access the In-Memory Data Store directly if the Query Module owns access.
- Access S3 or Floci.
- Call the Authentication Service directly.
- Traverse geometry directly.
- Implement polygon intersection.
- Mutate GeoJSON.
- Perform map validation or normalisation.

## Performance requirements

Map layers may contain large geometries.

Implement a clear and proportionate in-memory solution.

Requirements:

- Avoid serialising entire features merely to search properties.
- Avoid repeatedly traversing geometry unnecessarily.
- Parse the bounding box once per request.
- Reuse precomputed feature bounds only if an approved existing mechanism exists.
- Avoid mutating or annotating canonical features with cached values.
- Avoid uncontrolled recursion.
- Avoid quadratic comparisons where a linear scan is sufficient.
- Do not introduce a database or external spatial search engine.
- Do not perform geometry simplification unless explicitly approved.
  If actual collection size creates a material performance concern, document the evidence and ask for clarification.

Do not change the approved architecture independently.

## Test fixtures

Reuse canonical map JSON fixtures from Step 04 where practical.

Add focused synthetic fixtures for:

- Polygon feature
- MultiPolygon feature
- Polygon with a hole
- Bounding box inside a polygon
- Polygon inside a bounding box
- Partial overlap
- Boundary contact
- Disjoint geometry
- Multiple statistical-area codes
- Parent and child area properties
- Optional missing parent code
- Feature inside and outside a filter
- Antimeridian case if approved
- Empty result collection
- Multiple features with deterministic ordering
  Use stable synthetic GUIDs.

Store substantial declarative GeoJSON fixtures in JSON files.

Do not embed large coordinate arrays directly in JavaScript test files.

Do not use production or licensed map data without approval.

## Required unit tests

Testing is part of Step 20 and must be completed in this step.

### Map-land query-configuration tests

Verify:

1. Dataset is `map-land` .
2. Feature accessor is configured correctly.
3. GUID field is configured.
4. GeoJSON format is configured.
5. Bounding-box filter is registered.
6. No statistical-area-only filters are exposed unless approved.
7. No Step 15 common logic is duplicated.

### Statistical-area query-configuration tests

Verify:

1. Dataset is `map-statistical-areas` .
2. Feature accessor is configured.
3. GUID field is configured.
4. Area-code field is configured.
5. Parent-code filter is configured.
6. Approved search fields are configured.
7. Bounding-box filter is configured.
8. GeoJSON format is configured.
9. No database or persistence behaviour is present.

### GeoJSON preservation tests

Verify:

1. FeatureCollection type is preserved.
2. Feature type is preserved.
3. Feature GUID is preserved.
4. Feature properties are preserved.
5. Polygon geometry is preserved.
6. MultiPolygon geometry is preserved.
7. Numeric coordinates remain numbers.
8. Coordinate ordering remains longitude first.
9. Source collection is not mutated.
10. Nested geometry arrays are not mutated.

### Statistical-area general search tests

Verify approved searches against:

- Area name
- Area code
- Area type
- Parent code
- Parent name
  Also verify:

1. Unapproved properties are not searched.
2. Geometry and coordinates are not searched.
3. No match returns an empty `FeatureCollection` .
4. Matching follows Step 15 semantics.
5. Search is deterministic.
6. Source data is not mutated.
7. Caller input is not interpreted as executable regular expression syntax.

### Area-code filter tests

Verify:

1. Matching code returns the feature.
2. No match returns an empty `FeatureCollection` .
3. Code is kept separate from GUID.
4. Matching follows approved casing semantics.
5. Code remains a string.
6. Source data is not mutated.

### Parent-code filter tests

Verify:

1. A matching child feature is returned.
2. A nonmatching feature is excluded.
3. A feature with no parent code is handled safely.
4. Parent code is not inferred from area code.
5. Matching follows approved casing semantics.
6. Source feature properties are not mutated.

### Bounding-box parser tests

Verify:

1. Four valid finite values are accepted.
2. Fewer than four values are rejected.
3. More than four values are rejected.
4. Empty values are rejected.
5. Non-numeric values are rejected.
6. Partial numeric values are rejected.
7. Longitude below minimum is rejected.
8. Longitude above maximum is rejected.
9. Latitude below minimum is rejected.
10. Latitude above maximum is rejected.
11. Minimum latitude above maximum latitude is rejected.
12. Longitude ordering follows approved antimeridian policy.
13. Input is not mutated.

### Polygon bounding-box tests

Verify:

1. Disjoint polygon is excluded.
2. Polygon entirely inside the bounding box is included.
3. Bounding box entirely inside the polygon follows approved intersection semantics.
4. Partial overlap is included where intersection is approved.
5. Boundary contact follows the approved inclusion rule.
6. Polygon holes are handled correctly.
7. Polygon coordinates are not mutated.

### MultiPolygon bounding-box tests

Verify:

1. Disjoint MultiPolygon is excluded.
2. One intersecting polygon causes the feature to match where approved.
3. Multiple intersecting polygons do not duplicate the feature.
4. Boundary contact follows approved behaviour.
5. Nested coordinate arrays are not mutated.
6. Results remain deterministic.

### Antimeridian tests

If antimeridian support is approved, verify:

1. Crossing bounding box is accepted.
2. Features on both sides of the antimeridian can match.
3. Nonmatching features are excluded.
4. Ordinary bounding boxes continue to work.
5. Longitude values are not rewritten.
   If antimeridian support is explicitly excluded, verify that crossing boxes produce the approved validation error.

### Individual statistical-area tests

Verify:

1. Existing GUID returns a GeoJSON Feature.
2. Unknown valid GUID returns the approved not-found error.
3. Invalid GUID returns the approved request error.
4. Area code in the path is not treated as a GUID.
5. Returned content type is GeoJSON.
6. Feature properties and geometry are preserved.
7. Source feature is not mutated.

### Authentication tests

Verify:

1. Missing credentials return unauthorised.
2. Invalid credentials return unauthorised.
3. Missing read permission returns forbidden.
4. Read permission allows access.
5. Authentication Service unavailability maps correctly.
6. No bearer token is exposed.
7. Controllers do not call the Authentication Service directly.

### ETag and caching tests

Verify:

1. Complete map responses include the approved ETag.
2. Filtered map responses use deterministic approved ETags.
3. Matching `If-None-Match` can return `304` .
4. A `304` response has no body.
5. GeoJSON cache headers are present.
6. ETag changes when the active source collection changes.
7. Different filters do not incorrectly share incompatible cached responses.
8. Controllers do not create incompatible ETags.

### Error tests

Verify:

1. Invalid GUID uses the standard error.
2. Unknown GUID uses the standard not-found error.
3. Invalid bounding box uses the standard validation error.
4. Unsupported filter uses the standard error.
5. Unloaded map collection maps correctly.
6. Correlation ID is included.
7. Stack traces are not exposed.
8. Complete geometry is not returned in errors.
9. S3 and store details are not exposed.
10. Standard Step 13 error envelopes are used.

## Route-level integration tests

Use Hapi injection and existing dependency-injection conventions.

Test:

HTTP

```text
GET /api/v1/reference-data/map/land
GET /api/v1/reference-data/map/statistical-areas
GET /api/v1/reference-data/map/statistical-areas/{id}
```

Cover:

1. Complete map-land FeatureCollection.
2. Bounding-box-filtered map-land response.
3. Complete statistical-area FeatureCollection.
4. General statistical-area search.
5. Area-code filter.
6. Parent-code filter.
7. Combined filters.
8. Bounding-box-filtered statistical-area response.
9. Empty filtered FeatureCollection.
10. Existing statistical area by GUID.
11. Unknown statistical-area GUID.
12. Invalid GUID.
13. Area code rejected as path ID.
14. Polygon response.
15. MultiPolygon response.
16. Numeric coordinates.
17. Longitude-first coordinate ordering.
18. Correct `application/geo+json` content type.
19. Conditional request returning `304` .
20. Correct cache headers.
21. Unauthorised request.
22. Forbidden request.
23. Authentication Service unavailable.
24. Map-land collection unavailable.
25. Statistical-area collection unavailable.
26. Invalid bounding box.
27. Correlation-header propagation.
28. Standard error envelope.
29. Canonical source immutability.
30. Absence of direct persistence access.
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

1. Map routes do not import the AWS SDK.
2. Map query code does not import the Persistence Module.
3. Map routes do not import the Authentication Service client.
4. Only the Query Module accesses the In-Memory Data Store according to the approved boundary.
5. Spatial filters do not depend on Hapi.
6. Spatial filters do not mutate canonical map data.
7. No database or Redis dependency is introduced.
8. No upload or item-mutation endpoint is added.
9. Step 18 `map-ports` behaviour is not duplicated or replaced.

## Regression testing

Run:

- Map query-configuration tests.
- Statistical-area search tests.
- Bounding-box parser tests.
- Polygon spatial tests.
- MultiPolygon spatial tests.
- Map route integration tests.
- Step 18 map-port tests.
- Step 15 common query-engine tests.
- Step 13 common API tests.
- Step 12 authentication tests.
- Existing Steps 16 through 19 tests.
- The complete repository test suite.
- Test coverage.
- Linting.
- Formatting checks.
  Do not defer Step 20 testing to Steps 26 through 28.

## Defra SonarCloud review

After implementation and tests pass, analyse all code created or modified by Step 20 against the configured Defra SonarCloud rules.

Use the repository’s configured SonarCloud project and:

Plain Text

```text
https://sonarcloud.io/organizations/defra/rules
```

Review for:

- Magic numbers
- Hardcoded coordinate bounds
- Duplicate query parameter strings
- Excessive cognitive complexity
- Deeply nested geometry traversal
- Recursive functions without safe bounds
- Duplicate polygon and MultiPolygon logic
- Unsafe numeric parsing
- Latitude and longitude reversal
- Input mutation
- In-place feature sorting
- Unsafe regular expressions
- Unhandled promise rejections
- Broad catch blocks
- Dead code
- Unused exports
- Weak assertions
- Sensitive-data logging
- Invalid GeoJSON output
- Incorrect content type
- Incorrect bounding-box intersection
- Incorrect boundary handling
- Incorrect antimeridian handling
- Incorrect ETag behaviour
- Missing authentication
- Area codes used as GUIDs
- Direct S3 access
- Large declarative coordinate arrays in JavaScript
  Use named constants for:

- Coordinate limits
- GeoJSON type values
- Content type
- Query parameter names
- CRS or WGS84 identifiers where required
  Use JSON files for substantial GeoJSON test fixtures.

Do not resolve findings by:

- Disabling Sonar rules globally
- Adding broad suppressions
- Excluding map files
- Weakening tests
- Removing geometry assertions
- Replacing correct geometry behaviour with an inaccurate simpler implementation
- Changing approved API behaviour silently
  For each Step 20 finding:

1. Record the Sonar rule identifier.
2. Identify the file and line.
3. Explain the risk.
4. Apply the smallest scope-safe correction.
5. Rerun focused tests.
6. Rerun linting and formatting.
7. Rerun available Sonar analysis.
   If a finding requires changing an approved contract, dependency, spatial semantic, or API behaviour, stop and ask for clarification.

If SonarCloud runs only in CI, state clearly that final verification remains pending CI.

## Security and privacy considerations

- Require read authentication for all three routes.
- Never log bearer tokens.
- Never expose S3 details.
- Never expose stack traces.
- Do not return complete geometry in errors.
- Parse bounding boxes strictly.
- Avoid unsafe dynamic evaluation.
- Avoid uncontrolled recursion.
- Avoid denial-of-service through unnecessarily repeated geometry traversal.
- Use bounded request parameters.
- Preserve canonical map data immutably.
- Use synthetic GeoJSON fixtures.
- Do not use unapproved production or copyrighted map data.
- Do not expose internal persistence metadata.
- Preserve correlation identifiers safely.
- Return only approved feature properties.
- Do not add personal or user-specific data.

## Documentation requirements

Add or update focused documentation covering:

- Map-land endpoint.
- Statistical-area collection endpoint.
- Statistical-area-by-GUID endpoint.
- General query fields.
- Area-code filter.
- Parent-code filter.
- Bounding-box syntax.
- Bounding-box matching semantics.
- Boundary inclusion.
- Antimeridian policy.
- GeoJSON response types.
- `application/geo+json` .
- WGS84.
- Longitude-first coordinate order.
- GUID versus area code.
- Authentication requirements.
- ETag and conditional requests.
- Cache behaviour.
- Standard errors.
- Any approved geometry limitations.
  Do not duplicate the entire implementation plan or API design.

## In scope

- Map-land GET route
- Statistical-area collection GET route
- Statistical-area-by-GUID GET route
- Map query configurations
- General statistical-area search
- Area-code filter
- Parent-code filter
- Bounding-box parsing
- Polygon spatial filtering
- MultiPolygon spatial filtering
- GeoJSON response handling
- Read-authorisation integration
- ETag and conditional-request integration
- Standard error integration
- Unit tests
- Route-level integration tests
- Architecture-boundary tests
- Defra Sonar review
- Focused documentation

## Out of scope

Do not implement:

- Changes to the approved implementation plan
- Canonical schema redesign
- Map validation redesign
- Map normalisation changes
- Geometry repair
- Geometry simplification
- Coordinate conversion
- New persistence behaviour
- Direct S3 or Floci access
- Cache-refresh redesign
- Authentication Service contract changes
- Login or token issuance
- Port-map replacement
- Upload validation
- Full collection replacement
- Seed-data bootstrap
- Item-level mutations
- New database functionality
- Redis
- New external geospatial service
- Final OpenAPI work assigned to Step 31
- Metrics or audit work assigned to Step 25
- Deployment infrastructure

## Expected deliverables

The approved Step 20 deliverables are:

1. Map routes.
2. Bounding-box filter.
3. Statistical-area search.
4. GeoJSON response handling.
5. Unit tests.
6. Route-level integration tests.
   Also produce:

7. Approved implementation plan saved as:
   Plain Text

```text
github-prompts/Step 20-implement-map-location-query-endpoints-plan.md
```

1. Architecture-boundary verification.
2. Focused map endpoint documentation.
3. Defra SonarCloud review result for Step 20 changes.

## Approved completion criteria

The step must satisfy the approved plan criteria:

- Returned map data is valid GeoJSON.
- Features remain identifiable by GUID and area code.
- Bounding-box requests return only intersecting or otherwise approved matching features.
- Malformed bounding boxes return `400` .
- Large map responses use appropriate cache headers.
  The implementation must also demonstrate:

- All three approved routes are registered.
- Read permission is enforced.
- Statistical-area query behaviour reuses Step 15.
- GeoJSON responses use `application/geo+json` .
- Coordinates remain numeric.
- Coordinates remain longitude first.
- Data remains WGS84.
- Area codes remain separate from GUID resource IDs.
- Polygon and MultiPolygon filters follow approved spatial semantics.
- Spatial filtering does not mutate canonical data.
- Standard errors and ETags reuse common utilities.
- Required unit and integration tests pass.
- No later-step functionality is implemented.
- Step 20 code has been reviewed against Defra SonarCloud rules.

## Verification

Inspect `package.json` and use the repository’s actual scripts.

Run the applicable equivalents of:

Shell

```text
npm test -- <map-query-configuration-tests>
npm test -- <statistical-area-search-tests>
npm test -- <bounding-box-tests>
npm test -- <polygon-spatial-tests>
npm test -- <multipolygon-spatial-tests>
npm test -- <map-route-tests>
npm test -- <architecture-boundary-tests>
npm test
npm run test:coverage
npm run lint
npm run format:check
```

Run the repository’s Sonar or static-analysis command if one exists.

Format every file created or modified by Step 20.

If the repository-wide formatting check reports unrelated generated artifacts:

1. Confirm every file changed by Step 20 passes Prettier.
2. Do not reformat unrelated generated conversation or metadata files.
3. Report remaining warnings accurately.
4. Do not claim the repository-wide command passed if it failed.
   If a pre-existing failure occurs:

5. Record the exact command.
6. Record the relevant output.
7. Determine whether Step 20 caused it.
8. Fix failures introduced by Step 20.
9. Do not broaden scope silently.
10. Ask for clarification if resolution requires unrelated work.
    No real S3, Floci, Authentication Service, database, Redis, or external geospatial-service integration is required for Step 20 route tests.

## Final response requirements

After implementation, report:

1. Summary of completed work.
2. Saved Step 20 plan path.
3. Files created.
4. Files modified.
5. Map routes implemented.
6. Map-land response behaviour.
7. Statistical-area search fields.
8. Area-code matching behaviour.
9. Parent-code matching behaviour.
10. Bounding-box syntax.
11. Bounding-box matching semantics.
12. Boundary inclusion behaviour.
13. Antimeridian policy.
14. Polygon handling.
15. MultiPolygon handling.
16. GeoJSON response shapes.
17. GeoJSON content type.
18. WGS84 handling.
19. Coordinate order.
20. Feature ordering.
21. Pagination and sorting behaviour, if applicable.
22. Authentication and authorisation behaviour.
23. ETag and conditional-request behaviour.
24. Cache-header behaviour.
25. Standard error behaviour.
26. Unit tests and results.
27. Route integration tests and results.
28. Complete test-suite result.
29. Coverage result.
30. Lint result.
31. Formatting result.
32. Architecture-boundary result.
33. Defra SonarCloud analysis method.
34. Sonar findings introduced by Step 20.
35. Sonar fixes applied.
36. Whether final SonarCloud CI verification remains pending.
37. Confirmation that GUIDs remain resource identifiers.
38. Confirmation that area codes remain separate business identifiers.
39. Confirmation that canonical geometry was not mutated.
40. Confirmation that no database or Redis functionality was introduced.
41. Confirmation that no direct S3, Floci, or Authentication Service access was added.
42. Confirmation that no later-step functionality was implemented.
43. Work deferred to subsequent approved steps.
44. Remaining ambiguities, risks, or owner decisions.
    Do not modify the approved implementation plan.

If you reach any ambiguity, ask me to clarify.
