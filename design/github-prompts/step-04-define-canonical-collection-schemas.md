# Step 04: Define Canonical Collection Schemas

## Recommended reasoning effort

- Planning phase: High
- Implementation phase: High

## Role

Act as a senior Node.js backend engineer working on the Reference Data Service for the Catch Recording application.

Implement versioned, machine-validatable canonical schemas for the persisted reference-data collections.

This step defines structural schemas, schema registration, valid examples, invalid fixtures, and schema-version compatibility rules. It must not implement persistence, business validation, normalisation, querying, API routes, caching, authentication, or collection replacement.

## Required working mode

Start in Plan mode.

Before proposing changes:

1. Inspect the complete repository.
2. Read the current Reference Data Service implementation plan.
3. Read the approved plans for Steps 01, 02, and 03.
4. Inspect all implementation completed in Steps 01, 02, and 03.
5. Inspect the shared domain contracts created in Step 03, including:

- Dataset identifiers
- Dataset capability definitions
- Representation identifiers
- Collection envelope contracts
- Collection metadata contracts
- Manifest contracts
- Validation contracts
- Repository contract
- In-Memory Data Store contract
- Service-error contract

6. Inspect `package.json` and determine:

- Existing schema-validation dependencies
- Existing Hapi or Joi conventions
- Whether JSON Schema, Joi, Ajv, or another mechanism is already used
- JavaScript or TypeScript conventions
- Test framework and fixture conventions

7. Search the repository for:

- Existing schema definitions
- JSON fixtures
- GeoJSON fixtures
- UUID-validation conventions
- Date and timestamp formats
- Existing validation utilities

8. Inspect the agreed Reference Data Service API design and any legacy schema analysis available in the repository.
9. Confirm that no database connection or database model is required.
10. Identify any conflict or ambiguity before implementation.
    Do not modify files during planning.

Produce a file-by-file implementation plan and wait for approval.

After the plan is approved, the first implementation action must be to save the approved plan as:

Plain Text

```text
github-prompts/Step 04-define-canonical-collection-schemas-plan.md
```

Only after saving the approved plan may source-code implementation begin.

## Project context

The Reference Data Service manages these reference-data domains:

- Vessels
- Gears
- Ports
- Species
- Map land
- Map statistical areas
- Derived map ports
  Canonical data must remain as close as practical to the legacy schema while using GUIDs as stable technical identifiers.

Existing business identifiers must remain separate from GUIDs.

Examples include:

- Vessel CFR
- Vessel registration number
- Vessel external mark
- Gear code
- Port code
- Species FAO code
- Statistical-area code
  Map-location data is the principal new domain not clearly represented in the legacy reference-data schemas.

## Mandatory architecture constraints

### No database

The Reference Data Service does not use a database.

Do not introduce:

- MongoDB
- Redis
- DynamoDB
- PostgreSQL
- MySQL
- SQLite
- Database schemas
- Database models
- Database migrations
- ORM or ODM dependencies
- Database repositories
- Database connections
  The schemas created in this step describe JSON or GeoJSON files, not database records.

### Persistence ownership

- S3-compatible object storage is the durable source of truth.
- Only the Persistence Module may communicate with AWS S3 or Floci.
- Do not implement S3 access in this step.
- Schema modules must not import AWS SDK types.

### In-memory storage

- Active canonical collections will later be stored as process-local JSON objects.
- Do not implement the In-Memory Data Store in this step.
- Do not introduce Redis.

### Authentication ownership

- Only the Validation Module may communicate with the Authentication Service.
- Do not implement authentication or authorisation in this step.

### Schema responsibility

This step defines structural validity only.

Business validation belongs to Steps 08 and 09.

Examples of structural validation appropriate for this step include:

- Required properties
- Property types
- UUID formats
- Date and timestamp formats
- Enumerated structural values
- Array and object shapes
- Additional-property policy
- GeoJSON structural shape
  Examples of business validation not appropriate for this step include:

- Cross-record uniqueness
- CFR uniqueness
- FAO-code uniqueness
- Relationship resolution across records
- Date ordering
- Gear applicability consistency
- Duplicate official species names
- Polygon-topology validity
- Collection version conflicts
- Business-code ownership
- Uploaded dataset matching the route

## Objective

Create versioned canonical schemas for all persisted reference-data collections.

The implementation must provide:

1. A common collection envelope schema.
2. A manifest schema.
3. Canonical vessel schema.
4. Canonical gear schema.
5. Canonical port schema.
6. Canonical species schema.
7. Map-land GeoJSON schema.
8. Map-statistical-area GeoJSON schema.
9. Valid example collections.
10. Invalid structural fixtures.
11. A central schema registry.
12. Schema-version compatibility rules.
13. Focused schema tests.

## Schema version

Implement schema version:

Plain Text

```text
1.0
```

Schema versions must be centrally defined.

Do not scatter the string `1.0` across unrelated modules.

The schema registry must reject unsupported schema versions deterministically.

Do not implement automatic schema migration.

## Common schema conventions

Apply these conventions consistently unless the repository already has an approved conflicting convention.

### GUIDs

- Use the property name `id` for canonical resource identifiers.
- Use `collectionId` for collection identifiers.
- Use `manifestId` for manifest identifiers.
- Require valid UUID format.
- Do not generate UUIDs in schema code.
- Do not use business codes as UUID substitutes.

### Timestamps and dates

Use:

- RFC 3339 or ISO 8601 date-time values for timestamps
- ISO 8601 full-date values for date-only properties
  Do not silently convert date values in this step.

### Optional values

Choose and document one consistent optional-value convention based on repository standards:

- Property omitted, or
- Explicit `null` where the API design requires nullable values
  Do not allow both arbitrarily unless there is a compatibility reason.

### Additional properties

Prefer explicit schemas.

Use `additionalProperties: false` , or the equivalent supported by the chosen schema mechanism, where doing so does not discard required legacy fields.

If legacy data contains unresolved properties, document the ambiguity rather than silently allowing an unrestricted object.

### Strings

Apply reasonable structural limits where already established by the legacy schema or approved API design.

Do not invent restrictive lengths without evidence.

### Numeric values

Require actual JSON numbers for canonical numeric fields.

Do not use numeric strings in canonical schemas.

Conversion of permitted numeric strings belongs to the normalisation step.

### Collection item counts

The envelope must require a non-negative integer `itemCount` .

Do not implement the business check that `itemCount` equals the actual array length in this step. That belongs to common validation.

## 1. Common collection envelope schema

Define a reusable versioned collection envelope.

The common envelope must support:

JSON

```text
{
  "dataset": "ports",
  "collectionId": "0be553de-f430-49f7-b120-1e8e5ad972dc",
  "schemaVersion": "1.0",
  "version": "2026.09.11.1",
  "generatedAt": "2026-09-11T08:30:00Z",
  "effectiveFrom": "2026-09-11T00:00:00Z",
  "itemCount": 1,
  "items": []
}
``
```

Required structural properties:

- `dataset`
- `collectionId`
- `schemaVersion`
- `version`
- `generatedAt`
- `itemCount`
- Collection content
  Optional structural properties:

- `effectiveFrom`
- Other approved collection-level descriptive metadata already established by the design
  The dataset property must use the centrally defined persisted dataset identifiers.

`map-ports` must not be accepted as a persisted collection dataset.

Support JSON item collections and GeoJSON feature collections without creating incompatible duplicate metadata definitions.

## 2. Manifest schema

Define a schema for the active reference-data manifest.

The manifest should support:

JSON

```text
{
  "manifestId": "c7b49c26-d6c0-4ab1-9318-cd1c862f4768",
  "version": "2026.09.11.3",
  "generatedAt": "2026-09-11T08:32:14Z",
  "datasets": []
}
```

Each persisted manifest entry must structurally support:

- Dataset identifier
- Collection GUID
- Schema version
- Collection version
- Format
- ETag
- Checksum
- Item or feature count
- Size in bytes
- Last-modified timestamp
- Internal object reference where required by the Persistence Module
  The manifest schema must not require an independent `map-ports` entry.

Do not implement manifest persistence or activation.

## 3. Vessel canonical schema

Define the canonical vessel item schema while preserving known legacy concepts.

Support:

- `id` , required GUID
- `name` , required string
- `namePln` , optional or nullable string
- `identifiers` , required object
- CFR
- UVI
- MMSI
- IRCS
- External mark
- Registration number
- Vessel type code
- Registration country code
- Length overall in metres
- Status
- Active-from date
- Active-to date
  Expected conceptual shape:

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

Do not add `homePort` .

Do not require the schema to prove uniqueness of natural identifiers.

Do not require the schema to prove that at least one natural identifier exists unless this can be expressed clearly without duplicating future business validation.

Do not normalise identifier casing.

## 4. Gear canonical schema

Define schemas for:

- Gear collection
- Gear item
- Gear category
- Gear characteristic definition
- Gear-to-characteristic applicability relationship
- Characteristic data type
- Vessel-length applicability
  Support these concepts:

### Gear

- GUID
- Code
- Name
- Type
- Category GUID
- Pair-fishing capability
- Applicable characteristics
- Active state

### Category

- GUID
- Code
- Name

### Characteristic

- GUID
- Code
- Name
- Data type
- Unit
- Minimum value
- Maximum value

### Applicable characteristic

- Relationship GUID
- Characteristic GUID
- `fixed`
- `required`
- Vessel-length applicability

### Vessel-length applicability

- Under 10 metres
- 10 to 12 metres
- Over 12 metres
  Expected conceptual shape:

JSON

```text
{
  "categories": [],
  "characteristics": [],
  "items": []
}
```

Preserve `fixed` and `required` as separate boolean properties.

Do not infer that `fixed` means the same as a mobile required measurement.

Do not validate cross-record category or characteristic references in this step.

Do not implement mobile measurement projection.

## 5. Port canonical schema

Define the canonical port item schema.

Support:

- `id` , required GUID
- `code` , required string
- `name` , required string
- `countryCode` , required string
- Optional coordinate
- Active state
  Coordinate shape:

JSON

```text
{
  "latitude": 50.3661,
  "longitude": -4.1427
}
```

Apply structural numeric ranges where supported:

- Latitude between `-90` and `90`
- Longitude between `-180` and `180`
  Allow a port without a coordinate.

Do not permit only latitude or only longitude inside a coordinate object.

Do not implement radius search or derived map-port generation.

## 6. Species canonical schema

Define schemas for:

- Species item
- Country-scoped common name
- Local name
  Support:

### Species

- GUID
- FAO code
- Scientific name
- Common names
- Local names
- Active state

### Common name

- GUID
- Country code
- Name

### Local name

- GUID
- Language code
- Name
- Official indicator
  Expected conceptual shape:

JSON

```text
{
  "id": "da465aa5-abcf-443a-bc7e-62e78978bca7",
  "faoCode": "COD",
  "scientificName": "Gadus morhua",
  "commonNames": [],
  "localNames": [],
  "active": true
}
```

Use structurally valid country and language-code formats where the repository has an appropriate established mechanism.

Do not implement display-name precedence.

Do not validate uniqueness of FAO codes.

Do not validate exclusivity of official local names.

## 7. Map-land GeoJSON schema

Define a canonical schema for the map-land collection.

The root must be structurally compatible with a GeoJSON `FeatureCollection` .

Support:

- Collection metadata
- Feature collection
- GUID feature identifiers
- Polygon geometry
- MultiPolygon geometry
- Optional approved feature properties
  Canonical coordinates must be JSON numbers.

Coordinates must follow GeoJSON longitude-first ordering.

Do not implement coordinate-system conversion.

Do not attempt to validate full geospatial topology using only structural schema rules.

Do not require a database or geospatial extension.

## 8. Map-statistical-area GeoJSON schema

Define a canonical schema for statistical-area reference data.

Support:

- GeoJSON `FeatureCollection`
- GUID feature ID
- Statistical-area code
- Area name
- Area type
- Optional parent code
- Optional parent name
- Optional area measurement
- Optional centroid
- Polygon or MultiPolygon geometry
  Expected feature shape:

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

If both the GeoJSON feature `id` and `properties.id` are retained, document that equality is a business-validation rule for a later step.

Do not implement parent-area resolution.

Do not implement bounding-box filtering.

## 9. Derived map-ports schema decision

Do not create a persisted canonical collection schema for `map-ports` .

If useful for future API response validation, define only a reusable derived GeoJSON feature shape or response schema.

Any such schema must clearly state:

- It is derived from the canonical ports collection.
- It is not uploadable.
- It is not independently persisted.
- It is not included as an authoritative manifest dataset.
  Do not implement the projection.

## 10. Schema registry

Create a central schema registry or resolver that can identify the correct schema from:

- Dataset
- Schema version
- Collection format where necessary
  The registry must:

- Use Step 03 dataset constants.
- Support schema version `1.0` .
- Reject unsupported datasets.
- Reject unsupported schema versions.
- Prevent `map-ports` from resolving to an uploadable persisted schema.
- Avoid importing controllers, routes, S3 adapters, or stores.
- Avoid circular dependencies.
- Return schema definitions or validator functions according to repository conventions.
  Do not create a second dataset registry that duplicates Step 03 capabilities.

## 11. Schema-version compatibility policy

Document and implement the minimal compatibility rules for this step:

- `1.0` is the only supported version.
- Unknown versions are rejected.
- No implicit downgrade is performed.
- No implicit upgrade is performed.
- Schema migration is outside scope.
- Future versions must be registered explicitly.
- Stored collection schema versions remain part of collection metadata.
  Do not design a speculative migration framework.

## 12. Valid examples

Create one small, valid example collection for each persisted dataset:

- Vessels
- Gears
- Ports
- Species
- Map land
- Map statistical areas
  Examples must:

- Use stable synthetic GUIDs.
- Use fictional or safe public-sector-style sample data.
- Conform to schema version `1.0` .
- Be small enough for tests and documentation.
- Include meaningful optional-field examples.
- Avoid real personal information.
- Avoid copying production data.
- Distinguish GUIDs from business codes.
  Valid examples are structural fixtures, not the complete seed data introduced in a later step.

## 13. Invalid fixtures

Create focused invalid fixtures for common structural failures.

At minimum, cover:

- Missing required collection field
- Unsupported dataset
- Invalid collection GUID
- Unsupported schema version
- Invalid generated timestamp
- Negative item count
- Invalid item GUID
- Wrong property type
- Unexpected property where additional properties are prohibited
- Invalid port coordinate range
- Incomplete port coordinate object
- Invalid species common-name structure
- Invalid species local-name structure
- Invalid gear applicability structure
- Invalid GeoJSON root type
- Invalid GeoJSON geometry type
- Non-numeric GeoJSON coordinate
- Missing statistical-area code
  Keep each invalid fixture focused on one primary failure where practical.

Do not use business-validation fixtures for duplicate codes or unresolved references in this step.

## Structural validation output

Use the repository’s existing validation mechanism to provide deterministic schema-validation output.

A structural validation failure should make it possible for later validation code to identify:

- Dataset
- Schema version
- Invalid property path
- Validation keyword or stable issue category
- Safe message
  Do not implement the final public API error response.

Do not expose stack traces through validation results.

## Schema implementation rules

1. Reuse the existing validation library where suitable.
2. Do not introduce multiple competing schema libraries.
3. If a new dependency is required, justify it in the plan before implementation.
4. Prefer reusable schema fragments for:

- GUIDs
- Dates
- Timestamps
- Coordinates
- Dataset identifiers
- Collection metadata

5. Avoid duplicating the dataset list from Step 03.
6. Keep schemas versioned.
7. Keep structural validation separate from business validation.
8. Keep schema files independent from Hapi routes.
9. Keep schemas independent from AWS SDK and S3.
10. Keep schemas independent from the In-Memory Data Store.
11. Keep schemas independent from the Authentication Service.
12. Do not create database models.
13. Do not generate GUIDs.
14. Do not normalise values.
15. Do not mutate validated input.
16. Do not add default values during validation unless explicitly approved and documented.
17. Do not remove unknown legacy fields silently.
18. Avoid unrelated refactoring.

## Suggested file organisation

Adapt to the repository structure established by Steps 02 and 03.

A possible structure is:

Plain Text

```text
src/
  common/
    schemas/
      fragments/
        guid.js
        date.js
        timestamp.js
        coordinate.js
        geojson.js
      v1/
        collection-envelope.js
        manifest.js
        vessels.js
        gears.js
        ports.js
        species.js
        map-land.js
        map-statistical-areas.js
      schema-registry.js
      schema-versions.js
```

Possible fixture organisation:

Plain Text

```text
test/
  fixtures/
    reference-data/
      valid/
      invalid/
```

Do not force this structure if the repository already has a coherent equivalent.

Follow existing conventions for colocated tests or central fixture directories.

## In scope

- Schema version constant
- Reusable structural schema fragments
- Common collection envelope schema
- Manifest schema
- Vessel canonical schema
- Gear canonical schema
- Port canonical schema
- Species canonical schema
- Map-land GeoJSON schema
- Map-statistical-area GeoJSON schema
- Optional derived map-port response shape
- Central schema registry
- Valid structural examples
- Invalid structural fixtures
- Schema unit tests
- Schema compatibility documentation

## Out of scope

Do not implement:

- Any database connection or model
- MongoDB
- Redis
- DynamoDB
- SQL persistence
- ORM or ODM functionality
- S3 client or Persistence Module implementation
- Floci provisioning
- In-Memory Data Store implementation
- Cache refresh
- Authentication Service integration
- Hapi routes
- API handlers
- Request authorisation
- Multipart uploads
- Full collection replacement
- Manifest persistence
- Business-code uniqueness
- Cross-record relationship validation
- Date-order validation
- Dataset-specific business validation
- Data normalisation
- Numeric-string conversion
- Coordinate-system conversion
- Mobile projections
- Search, filtering, sorting, or pagination
- OpenAPI generation
- Production seed data
- Deployment infrastructure

## Required tests

Add focused tests proving that:

1. Each valid example passes its schema.
2. Missing required collection properties fail validation.
3. Invalid collection GUIDs fail validation.
4. Invalid item GUIDs fail validation.
5. Unsupported schema versions are rejected.
6. Unsupported datasets are rejected.
7. `map-ports` cannot resolve as a persisted upload schema.
8. Vessel structural fields use the expected types.
9. Vessel business identifiers remain separate from `id` .
10. Gear categories and characteristics have valid structural shapes.
11. Gear `fixed` and `required` remain separate fields.
12. Port coordinates accept valid numeric values.
13. Port coordinates reject out-of-range values.
14. Port coordinates reject incomplete coordinate objects.
15. Species common names use the expected shape.
16. Species local names use the expected shape.
17. Map-land accepts Polygon and MultiPolygon features.
18. Map schemas reject invalid root or geometry types.
19. GeoJSON schemas reject non-numeric coordinates.
20. Statistical-area features require GUIDs and area codes.
21. Validation does not mutate the supplied input.
22. Schema modules can be imported without circular-dependency errors.
23. Tests do not require Docker, Floci, S3, Redis, MongoDB, or another database.
    Do not add business-validation assertions that belong to Steps 08 or 09.

## Documentation requirements

Document:

- Supported canonical datasets.
- Schema version `1.0` .
- Schema registry usage.
- Collection-envelope structure.
- Manifest structure.
- GUID identity rules.
- Difference between GUIDs and business codes.
- JSON versus GeoJSON collections.
- Canonical schema versus mobile projection.
- Structural validation versus business validation.
- `map-ports` as a derived, non-uploadable representation.
- Absence of database models.
- Future version-registration expectations.
  Use the repository’s established documentation location.

Avoid duplicating the full API design.

## Security and privacy considerations

- Use synthetic fixtures.
- Do not include access tokens, credentials, or production object keys.
- Do not include real vessel-owner or user information.
- Apply reasonable structural string and collection limits only where approved.
- Avoid schemas that permit arbitrarily nested uncontrolled objects.
- Ensure validation errors do not include stack traces.
- Avoid returning entire rejected collection payloads in validation output.
- Treat future upload payload size and geometry-complexity controls as later security work.
- Do not allow schema defaults to silently create security-sensitive values.

## Expected deliverables

1. Approved plan saved as:
   Plain Text

```text
github-prompts/Step 04-define-canonical-collection-schemas-plan.md
```

1. Schema-version definitions.
2. Reusable schema fragments.
3. Common collection-envelope schema.
4. Manifest schema.
5. Vessel canonical schema.
6. Gear canonical schema.
7. Port canonical schema.
8. Species canonical schema.
9. Map-land canonical GeoJSON schema.
10. Map-statistical-area canonical GeoJSON schema.
11. Central schema registry.
12. Valid example collections.
13. Focused invalid fixtures.
14. Schema tests.
15. Schema compatibility documentation.

## Acceptance criteria

This step is complete only when:

- The approved plan is saved before implementation begins.
- Schema version `1.0` is centrally defined.
- Every persisted dataset has a versioned canonical schema.
- The collection envelope is reusable across datasets.
- The manifest has a machine-validatable schema.
- Every canonical resource requires a GUID.
- Business codes remain separate from GUIDs.
- Vessel concepts from the agreed legacy-aligned model are preserved.
- Gear categories, characteristics, and vessel-length applicability are structurally represented.
- Gear `fixed` and `required` remain separate.
- Ports support optional valid coordinates.
- Species retain scientific, common, and local names.
- Map data uses structurally valid GeoJSON.
- Map coordinates require numeric values.
- `map-ports` is not treated as an independently persisted upload dataset.
- Unsupported schema versions are rejected.
- Structural schemas do not perform business-validation responsibilities.
- Validation does not mutate input.
- No database connection, database model, or database abstraction is introduced.
- MongoDB and Redis are not introduced.
- No S3, Floci, authentication, cache, API, or upload implementation is added.
- All schema tests pass.
- Existing tests continue to pass.
- Linting passes.
- Formatting checks pass for files created or modified by this step.
- Documentation is updated.

## Verification

Inspect `package.json` and use the repository’s actual commands.

Run all applicable equivalents of:

Shell

```text
npm run lint
npm run format:check
npm test
npm run test:coverage
npm start
```

Also run the schema test files in isolation before running the complete suite.

If the repository-wide formatting check reports unrelated generated artifacts:

1. Format all source, test, fixture, and documentation files created or modified by Step 04.
2. Do not reformat unrelated generated design or conversation artifacts.
3. Report remaining unrelated formatting warnings accurately.
4. Do not claim successful repository-wide formatting if the command still exits unsuccessfully.
   If a pre-existing test or formatting failure is discovered:

5. Record the exact command and output.
6. Determine whether Step 04 caused the failure.
7. Fix failures introduced by Step 04.
8. Do not broaden the scope silently.
9. Ask for clarification if resolving the issue requires unrelated changes.
   No database, Docker, Floci, S3, or Authentication Service testing is expected for this step.

## Final response requirements

After implementation, report:

1. Summary of completed work.
2. Saved plan-file path.
3. Files created.
4. Files modified.
5. Schema versions supported.
6. Schemas added.
7. Reusable schema fragments added.
8. Valid examples and invalid fixtures added.
9. Tests added.
10. Commands executed and results.
11. Any remaining repository-wide formatting warnings.
12. Confirmation that structural and business validation remain separated.
13. Confirmation that GUIDs and business codes remain separate.
14. Confirmation that no database connection or abstraction was introduced.
15. Confirmation that MongoDB and Redis were not introduced.
16. Confirmation that no S3 or Floci implementation was added.
17. Confirmation that no Authentication Service implementation was added.
18. Work deferred to later steps.
19. Remaining assumptions, risks, or owner decisions.
    If you reach any ambiguity, ask me to clarify.
