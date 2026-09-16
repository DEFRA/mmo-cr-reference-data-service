# Step 09: Implement Dataset-Specific Validation

## Recommended reasoning effort

- Planning phase: High
- Implementation phase: High

## Role

Act as a senior Node.js backend engineer implementing the Reference Data Service for the Catch Recording application.

Implement dataset-specific validation exactly as defined by Step 09 of the approved Reference Data Service implementation plan.

Do not change, reorder, expand, reduce, or reinterpret the approved plan.

## Approved objective

Apply the business rules unique to each reference-data collection.

## Required working mode

Start in Plan mode.

Before proposing changes:

1. Inspect the complete repository.
2. Read the approved Reference Data Service implementation plan.
3. Read the approved implementation prompts and saved plans for Steps 01 through 08.
4. Inspect the implementation completed through Step 08.
5. Inspect the shared domain contracts created in Step 03.
6. Inspect the canonical schemas, schema registry, and fixtures created in Step 04.
7. Inspect the common validation engine, validation utilities, error structures, and tests implemented in Step 08.
8. Inspect all existing vessel, gear, port, species, and map fixtures.
9. Inspect repository conventions for:

- Validation functions
- Validation result aggregation
- Error codes
- Property paths
- Dataset identifiers
- Unit tests
- JSON fixtures
- Linting
- Formatting
- SonarCloud compliance

10. Confirm that structural schema checks already implemented in Step 04 are not being duplicated unnecessarily.
11. Confirm that common rules implemented in Step 08 are reused rather than reimplemented.
12. Review the current working tree:
    Shell

```text
git status --short
git diff --stat
```

1. Identify any mismatch between:

- The approved Step 09 scope
- The Step 04 canonical schemas
- The Step 08 common validation engine
- The currently implemented data shapes

1. Raise any ambiguity before implementation.
   Do not modify files during planning.

Produce a concise, file-by-file implementation plan and wait for approval.

After the plan is approved, the first implementation action must be to save the approved plan as:

Plain Text

```text
github-prompts/Step 09-implement-dataset-specific-validation-plan.md
```

Only after saving the approved plan may source-code implementation begin.

## Approved scope

Implement dataset-specific validation for:

- Vessels
- Gears
- Ports
- Species
- Map land
- Map statistical areas
  The implementation must provide:

- A validator for every uploadable dataset.
- Valid and invalid fixtures.
- Unit tests for every approved rule.
- Consistent validation-error output.
  Do not expand this scope without explicit approval.

## Architecture context

The Validation Module:

- Performs request and collection validation.
- Validates GUIDs, business codes, metadata, and relationships.
- Returns structured validation results.
- Will later own communication with the Authentication Service.
- Must not access S3 or Floci.
- Must not manage the in-memory cache.
- Must not normalise data.
- Must not implement API routes.
  This step adds dataset-specific business validation on top of:

- Structural schemas from Step 04.
- Common validation behaviour from Step 08.

## Mandatory architecture constraints

### No database

The Reference Data Service does not use a database.

Do not introduce:

- MongoDB
- Redis
- DynamoDB
- SQL storage
- An ORM or ODM
- Database models
- Database repositories
- Database connections
- Database validation queries
  All validation must operate on the supplied in-memory JSON or GeoJSON collection.

### No persistence access

Do not:

- Import the AWS SDK.
- Access S3.
- Access Floci.
- Read files from persisted object storage.
- Write validation results to storage.
- Call the Persistence Module.
  The caller supplies the complete collection to validate.

### No authentication implementation

Do not:

- Call the Authentication Service.
- Validate bearer tokens.
- Implement permissions.
- Add authentication routes or plugins.
  Authentication integration belongs to Step 12.

### No normalisation

Do not modify the supplied collection.

Do not:

- Trim text.
- Change casing.
- Convert numeric strings.
- Generate GUIDs.
- Correct dates.
- Close polygon rings.
- Convert coordinates.
- Sort records.
- Add defaults.
- Remove unknown properties.
  Normalisation belongs to Step 10.

### No API behaviour

Do not implement:

- Hapi routes
- Request handlers
- HTTP status mapping
- Upload endpoints
- Multipart parsing
- Public API error responses
  Common API behaviour belongs to Step 13, and upload behaviour belongs to Steps 21 and 22.

## Validation pipeline boundaries

Preserve these responsibilities:

### Step 04 structural schemas

Responsible for structural checks such as:

- Required fields
- Property types
- GUID syntax
- Date syntax
- Timestamp syntax
- Array and object shapes
- Structural GeoJSON shapes
- Numeric coordinate ranges where encoded in schemas

### Step 08 common validation

Responsible for reusable collection-level rules such as:

- Supported dataset
- Matching route and payload dataset
- Supported schema version
- Collection metadata
- Item-count consistency
- Duplicate GUIDs
- Common business-code checks
- Common date checks
- Upload size
- Content type
- Shared relationship handling where implemented

### Step 09 dataset-specific validation

Responsible only for rules unique to:

- Vessels
- Gears
- Ports
- Species
- Map collections
  Do not duplicate Step 04 or Step 08 logic unless a thin dataset-specific composition layer is required.

## General implementation requirements

### 1. Reuse the Step 08 validation engine

Implement every dataset validator through the common validation contracts and aggregation mechanism created in Step 08.

Do not create:

- A second validation result format.
- A second error model.
- A second collection validation pipeline.
- Dataset-specific exceptions that bypass normal validation results.
- A competing dataset registry.
  Every validator must return the common validation-result shape.

### 2. Central validator registry

Provide or extend a central resolver that selects the appropriate dataset validator.

The registry must:

- Use the dataset constants and capabilities from Step 03.
- Resolve every uploadable dataset.
- Reject unsupported datasets deterministically.
- Reject `map-ports` for upload validation because it is derived.
- Avoid duplicating dataset capability configuration.
- Avoid importing Hapi, AWS SDK, or persistence implementations.
- Avoid circular dependencies.
  Do not redesign the central Step 08 validation pipeline if an appropriate resolver already exists.

### 3. Validation aggregation

Where practical, collect multiple independent findings in one pass.

Requirements:

- Do not stop at the first duplicate if more duplicates can be identified safely.
- Do not run dependent checks when prerequisite data is structurally unusable.
- Avoid producing many misleading secondary errors from one malformed field.
- Return deterministic error ordering.
- Use stable error codes.
- Include precise property paths.
- Include item indexes where relevant.
- Include rejected values only when safe.
- Include the dataset and correlation identifier through the existing contracts where supplied.

### 4. Input immutability

Validation must not mutate:

- Collection envelopes
- Items
- Nested arrays
- Nested objects
- GeoJSON coordinates
- Metadata
  Add tests that compare input before and after validation.

## Vessel validation

Implement the approved vessel-specific rules.

### 1. Natural identifier requirement

Each vessel must contain at least one supported natural identifier.

Supported identifiers are those defined by the canonical vessel schema, including:

- CFR
- UVI
- MMSI
- IRCS
- External mark
- Registration number
  Treat missing, `null` , and empty values consistently with the Step 04 schema and Step 08 common utilities.

Do not use vessel name or `namePln` as a substitute natural identifier.

### 2. Natural identifier uniqueness

Within one vessel collection, validate uniqueness of each supplied identifier type:

- CFR
- UVI
- MMSI
- IRCS
- External mark
- Registration number
  Requirements:

- Ignore absent or approved nullable values.
- Detect duplicate non-empty values.
- Report every affected item deterministically where practical.
- Identify the specific identifier path.
- Do not merge different identifier types into one shared namespace.
- Do not replace GUID identity with a natural identifier.
  Use the approved casing semantics. If casing semantics are not defined, preserve exact values and raise the ambiguity instead of inventing case-insensitive behaviour.

### 3. Vessel length

Validate that `lengthOverallMetres` , when present, is not negative.

Reuse structural numeric validation from Step 04.

Do not calculate vessel-length bands in this step.

### 4. Active date range

When both dates are supplied:

- `activeTo` must not precede `activeFrom` .
  Follow the canonical date format established in Step 04.

Do not normalise or reinterpret invalid dates.

## Gear validation

Implement the approved gear-specific rules.

### 1. Unique codes

Validate uniqueness within the gear collection for:

- Gear codes
- Category codes
- Characteristic codes
  Each code type has its own namespace.

Do not treat a category code matching a gear code as a duplicate unless the approved legacy rules explicitly require global uniqueness.

### 2. Category references

Each gear `categoryId` must resolve to a category in the same canonical gear collection.

Report:

- Gear item path
- Missing referenced GUID
- Stable relationship error code
  Do not fetch categories from persistence or another service.

### 3. Characteristic references

Each applicable-characteristic relationship must reference a characteristic defined in the same gear collection.

If relationship records have their own GUIDs, preserve and report those paths accurately.

Do not create missing characteristics.

### 4. Supported characteristic data types

Validate every characteristic data type against the approved list already defined by the canonical schema or repository constants.

Do not create a new, conflicting data-type list.

If no complete approved list exists:

1. Stop.
2. Identify the currently represented values.
3. Ask for clarification.
4. Do not guess additional data types.

### 5. Numeric ranges

Where both minimum and maximum values are supplied:

- Minimum must not exceed maximum.
  Do not infer units or convert values.

Do not impose arbitrary ranges not present in the approved design.

### 6. Vessel-length applicability

Every applicable characteristic must enable at least one approved vessel-length band:

- Under 10 metres
- 10 to 12 metres
- Over 12 metres
  Use the exact property names established by the Step 04 schema.

Do not calculate applicability for a particular vessel in this step.

### 7. Preserve `fixed` and `required`

Treat `fixed` and `required` as independent canonical properties.

Do not:

- Infer one from the other.
- Rewrite either value.
- Map either property to mobile measurement behaviour.
- Reject a combination unless the approved legacy rules explicitly prohibit it.
  The exact mobile interpretation of `fixed` remains deferred.

## Port validation

Implement the approved port-specific rules.

### 1. Unique port codes

Validate that each non-empty port code is unique within the collection.

Use the approved casing semantics.

Do not treat the port code as the resource GUID.

### 2. Country code format

Validate country codes using the format established by the Step 04 canonical schema or approved repository utility.

Reuse an existing approved country-code definition.

Do not introduce a third-party country database or network lookup.

Do not reject legacy-valid values without evidence from the approved design.

### 3. Latitude and longitude range

Validate:

- Latitude from `-90` through `90` .
- Longitude from `-180` through `180` .
  If Step 04 already guarantees these structural ranges, compose or reuse that validation rather than duplicating it unnecessarily.

### 4. Coordinate pairing

A port coordinate must contain both:

- Latitude
- Longitude
  A port may have no coordinate.

It must not contain only one coordinate component.

Do not generate coordinates.

## Species validation

Implement the approved species-specific rules.

### 1. Unique FAO codes

Validate that every supplied FAO code is unique within the species collection.

Do not use the FAO code as the resource GUID.

Use approved casing semantics.

### 2. Country-code formats

Validate country codes on country-scoped common names.

Reuse the approved country-code validator or structural definition.

Do not call an external country reference-data service.

### 3. Language-code formats

Validate local-name language codes using the approved BCP 47-compatible format or repository utility established by the canonical schema.

Do not require unsupported language libraries without approval.

### 4. Nested-name GUID uniqueness

Validate uniqueness of GUIDs used by nested species name records.

At minimum, cover:

- Common-name IDs
- Local-name IDs
  Follow the approved namespace decision from Steps 04 and 08.

If it is unclear whether nested GUIDs must be unique only inside one species, inside each nested array, or across the complete species collection, stop and ask for clarification.

Do not invent the uniqueness scope.

### 5. Official local-name constraints

Validate the approved rule for official local names.

Unless the existing design or implementation specifies otherwise, the intended rule is:

- No more than one official local name for the same species and language code.
  Do not apply this rule across unrelated species.

Do not remove or select an official name.

Mobile name selection belongs to Step 19.

## Map validation

Implement approved validation for both:

- `map-land`
- `map-statistical-areas`

### 1. FeatureCollection root

Confirm the canonical root is a GeoJSON `FeatureCollection` .

Reuse the Step 04 structural schema.

Do not create a separate incompatible GeoJSON model.

### 2. Feature GUIDs

Validate that maintained map features use GUID identifiers according to the canonical schemas.

Reuse common duplicate-GUID checks where applicable.

### 3. Statistical-area code uniqueness

For `map-statistical-areas` , validate that statistical-area codes are unique.

Do not apply this requirement to land features unless land features carry an approved unique business code.

### 4. Numeric coordinates

Confirm all coordinates are actual JSON numbers.

Do not convert numeric strings.

Do not modify coordinate arrays.

### 5. WGS84 coordinate ranges

For each coordinate pair, validate:

- Longitude from `-180` through `180` .
- Latitude from `-90` through `90` .
  Coordinates follow GeoJSON longitude-first order.

Apply the validation recursively to:

- Polygon rings
- MultiPolygon rings
  Do not perform coordinate-system conversion.

### 6. Closed polygon rings

Every linear ring must:

- Contain the approved minimum number of coordinate positions.
- Have a final coordinate position equal to the first coordinate position.
  Compare coordinate values, not array references.

Do not close an open ring automatically.

### 7. Non-empty geometries

Reject:

- Empty Polygon coordinate arrays.
- Polygons with no valid rings.
- Empty MultiPolygon coordinate arrays.
- MultiPolygons containing only empty polygon arrays.
- Other empty geometry structures prohibited by the canonical model.
  Do not attempt to repair geometries.

### 8. Parent-area references

For statistical areas, each supplied `parentCode` must resolve to an area code in the same collection where the approved collection model expects parent areas to be included.

Validate the exact hierarchy represented by the canonical fixtures and approved design.

Do not:

- Fetch parent areas externally.
- Generate parent records.
- Infer a parent from code prefixes unless explicitly approved.
- Require `parentCode` when it is optional.
  If the current schema contains child areas but does not guarantee that parent features are present in the same collection, stop and ask for clarification before enforcing same-collection resolution.

## Error requirements

Use the common validation-error structure from Step 08.

Use existing error codes where available.

If Step 08 does not yet define a required code, add the smallest consistent code through the established central mechanism.

Potential categories include:

Plain Text

```text
missing_natural_identifier
duplicate_business_code
duplicate_identifier
invalid_date_range
invalid_numeric_range
missing_relationship
unsupported_characteristic_type
missing_applicability
invalid_country_code
invalid_language_code
duplicate_official_name
invalid_coordinate
coordinate_out_of_range
invalid_geometry
open_polygon_ring
empty_geometry
missing_parent_reference
```

Use repository naming conventions rather than creating inconsistent variants.

Error messages must:

- Be deterministic.
- Be safe for eventual API exposure.
- Identify the invalid field clearly.
- Avoid exposing the complete collection.
- Avoid stack traces.
- Avoid credentials or environment details.

## Validator composition requirements

Provide a clear validator per uploadable dataset.

A possible organisation is:

Plain Text

```text
src/
  validation/
    datasets/
      vessels-validator.js
      gears-validator.js
      ports-validator.js
      species-validator.js
      map-land-validator.js
      map-statistical-areas-validator.js
      dataset-validator-registry.js
```

Adapt to the source structure established in Steps 02 and 08.

Do not force this structure if the repository already has an equivalent convention.

Each validator should:

1. Accept the canonical collection and validation context.
2. Avoid mutating input.
3. Reuse Step 08 utilities.
4. Return the common validation-result format.
5. Produce deterministic issue ordering.
6. Remain independent from Hapi, S3, Floci, and the in-memory store.

## Fixtures

Create valid and invalid fixtures for every dataset-specific rule.

Use JSON fixture files for declarative data where consistent with the repository’s Step 04 fixture conventions and SonarCloud requirements.

Fixtures must:

- Use synthetic GUIDs.
- Avoid real personal or sensitive information.
- Be focused.
- Identify one primary invalid condition where practical.
- Avoid large duplicated payloads unless needed for clarity.
- Pass Step 04 structural validation when testing a Step 09 business rule, unless the test specifically covers composition with structural validation.
- Avoid magic-number findings in executable JavaScript.
  Do not modify valid Step 04 fixtures destructively.

Create focused copies or fixture builders according to existing repository conventions.

## Required tests

Testing is part of Step 09 and must be completed in this step.

Use the repository’s existing test framework and conventions.

### Vessel tests

Add passing and failing tests for:

1. A vessel containing a supported natural identifier.
2. A vessel containing no natural identifier.
3. Duplicate CFR.
4. Duplicate UVI.
5. Duplicate MMSI.
6. Duplicate IRCS.
7. Duplicate external mark.
8. Duplicate registration number.
9. Absent optional identifiers not being treated as duplicates.
10. Negative vessel length.
11. Zero vessel length if structurally permitted.
12. Valid active date range.
13. `activeTo` before `activeFrom` .
14. Input immutability.
15. Deterministic error paths and ordering.

### Gear tests

Add passing and failing tests for:

1. Unique gear codes.
2. Duplicate gear codes.
3. Unique category codes.
4. Duplicate category codes.
5. Unique characteristic codes.
6. Duplicate characteristic codes.
7. Valid category reference.
8. Missing category reference.
9. Valid characteristic reference.
10. Missing characteristic reference.
11. Supported characteristic data type.
12. Unsupported characteristic data type.
13. Valid numeric range.
14. Minimum greater than maximum.
15. At least one vessel-length applicability flag enabled.
16. No vessel-length applicability flag enabled.
17. `fixed` and `required` preserved independently.
18. Input immutability.
19. Deterministic error paths and ordering.

### Port tests

Add passing and failing tests for:

1. Unique port codes.
2. Duplicate port codes.
3. Valid country code.
4. Invalid country code.
5. Port with no coordinate.
6. Port with both coordinate values.
7. Latitude without longitude.
8. Longitude without latitude.
9. Latitude below its minimum.
10. Latitude above its maximum.
11. Longitude below its minimum.
12. Longitude above its maximum.
13. Boundary coordinate values.
14. Input immutability.
15. Deterministic error paths and ordering.

### Species tests

Add passing and failing tests for:

1. Unique FAO codes.
2. Duplicate FAO codes.
3. Valid common-name country code.
4. Invalid common-name country code.
5. Valid local-name language code.
6. Invalid local-name language code.
7. Unique common-name GUIDs.
8. Duplicate common-name GUIDs.
9. Unique local-name GUIDs.
10. Duplicate local-name GUIDs.
11. One official local name per species and language.
12. Multiple official local names for the same species and language.
13. Official names for different languages.
14. Official names belonging to different species.
15. Input immutability.
16. Deterministic error paths and ordering.

### Map-land tests

Add passing and failing tests for:

1. Valid FeatureCollection.
2. Valid Polygon.
3. Valid MultiPolygon.
4. Numeric coordinates.
5. Numeric-string coordinate rejection.
6. Longitude outside WGS84 range.
7. Latitude outside WGS84 range.
8. Closed Polygon ring.
9. Open Polygon ring.
10. Empty Polygon.
11. Empty MultiPolygon.
12. Duplicate feature GUID where common validation does not already cover it.
13. Input immutability.
14. Deterministic error paths and ordering.

### Map-statistical-area tests

Add passing and failing tests for:

1. Unique area codes.
2. Duplicate area codes.
3. Valid feature GUID.
4. Valid parent reference where required.
5. Missing parent reference where enforcement is approved.
6. Optional parent code when allowed.
7. Valid Polygon.
8. Valid MultiPolygon.
9. WGS84 coordinate ranges.
10. Closed rings.
11. Non-empty geometry.
12. Input immutability.
13. Deterministic error paths and ordering.

### Registry and integration tests

Add focused tests confirming:

1. Every uploadable dataset resolves to a validator.
2. Unsupported datasets are rejected.
3. `map-ports` is rejected as an upload-validation target.
4. The common Step 08 validation pipeline invokes the correct dataset validator.
5. Structural and common validation findings can be combined with dataset findings.
6. One invalid dataset does not invoke another dataset’s validator.
7. No validator performs external service calls.
8. No validator mutates input.
9. Validation results conform to the Step 08 contract.

## Regression testing

Run:

- Every Step 09 validator test in isolation.
- Step 08 common validation tests.
- Step 04 schema tests.
- The complete repository test suite.
- Test coverage.
- Linting.
- Formatting checks.
  Do not defer these tests to Step 26.

## SonarCloud considerations

Avoid introducing:

- Magic numbers in executable source or test code.
- Copy-and-paste validation logic.
- Excessive cognitive complexity.
- Deeply nested conditionals.
- Mutable exported singleton state.
- Large declarative fixtures in JavaScript.
- Broad suppressions.
- Unhandled branches.
- Duplicate string literals for field names and error codes where central constants are appropriate.
  Prefer:

- Small reusable utilities.
- Named constants for approved numerical boundaries.
- JSON fixtures for declarative data.
- Focused validator functions.
- Clear early exits when prerequisite structures are invalid.
- Deterministic issue aggregation.
  Do not disable SonarCloud rules globally.

## Documentation requirements

Add or update focused validation documentation describing:

- The distinction between structural, common, and dataset-specific validation.
- Vessel validation rules.
- Gear validation rules.
- Port validation rules.
- Species validation rules.
- Map validation rules.
- Error aggregation.
- Input immutability.
- Validator registry usage.
- Deferred normalisation behaviour.
- Known unresolved business-rule decisions.
  Do not duplicate the complete implementation plan or API design.

## Security and privacy considerations

- Do not log complete collections.
- Do not return entire rejected items in validation errors.
- Include rejected values only when safe and necessary.
- Do not include credentials, tokens, or environment data in errors.
- Avoid uncontrolled recursive validation that could create denial-of-service risk.
- Use bounded and understandable geometry traversal.
- Do not perform network lookups while validating country or language codes.
- Use synthetic fixture data.
- Treat vessel reference data as requiring controlled handling even though catch records are outside this service.
- Do not mutate supplied data.
- Do not retain failed validation input globally.

## In scope

- Vessel-specific validation
- Gear-specific validation
- Port-specific validation
- Species-specific validation
- Map-land validation
- Map-statistical-area validation
- Dataset validator registry or resolver
- Integration with the Step 08 common validation pipeline
- Valid and invalid fixtures
- Unit tests for every approved rule
- Input-immutability tests
- Focused validation documentation

## Out of scope

Do not implement:

- Changes to the approved implementation plan
- Structural schema redesign
- A competing common validation engine
- Data normalisation
- Automatic data repair
- GUID generation
- Coordinate conversion
- Mobile projections
- Querying
- Search
- Pagination
- Hapi routes
- HTTP error mapping
- Authentication Service integration
- Permissions
- S3 or Floci access
- Persistence operations
- In-memory store changes
- Cache refresh
- Startup hydration
- Multipart parsing
- Upload endpoints
- Collection activation
- Seed data
- OpenAPI contracts
- Deployment infrastructure
- Database or Redis functionality

## Expected deliverables

The approved Step 09 deliverables are:

1. Validator for each uploadable dataset.
2. Valid and invalid fixtures.
3. Unit tests for every approved rule.
4. Consistent validation-error output.
   Also produce:

5. Approved implementation plan saved at:
   Plain Text

```text
github-prompts/Step 09-implement-dataset-specific-validation-plan.md
```

1. Dataset validator registry or equivalent resolver.
2. Focused dataset-validation documentation.

## Approved completion criteria

The step must satisfy the approved plan criteria:

- Every dataset-specific rule has a passing and failing test.
- Validation does not destructively reinterpret legacy fields.
- Invalid map geometry cannot become active.
- Errors clearly identify the affected dataset and item.
  The implementation must also demonstrate:

- Every uploadable dataset resolves to the correct validator.
- `map-ports` is rejected as an upload-validation target.
- Validators reuse the Step 08 common validation contracts and utilities.
- Input data is never mutated.
- No external services are called.
- No normalisation or repair is performed.
- Required tests are implemented within Step 09.
- No later-step functionality is introduced.

## Verification

Inspect `package.json` and use the repository’s actual commands.

Run the applicable equivalents of:

Shell

```text
npm test -- <step-09-validator-tests>
npm test -- <step-08-common-validation-tests>
npm test -- <step-04-schema-tests>
npm test
npm run test:coverage
npm run lint
npm run format:check
```

If the repository has a build or type-check script, run it as well.

Format all source, test, fixture, and documentation files created or modified in Step 09.

If the repository-wide formatting check reports unrelated generated artifacts:

1. Confirm every file changed by Step 09 passes Prettier.
2. Do not reformat unrelated generated conversation or metadata files.
3. Report remaining warnings accurately.
4. Do not claim the repository-wide formatting command passed if it failed.
   If a pre-existing failure occurs:

5. Record the exact command.
6. Record the relevant failure output.
7. Determine whether Step 09 caused it.
8. Fix failures introduced by Step 09.
9. Do not broaden scope silently.
10. Ask for clarification if resolving the issue requires unrelated work.
    No Docker, Floci, S3, Authentication Service, Redis, or database tests are required for Step 09.

## Final response requirements

After implementation, report:

1. Summary of completed work.
2. Saved Step 09 plan path.
3. Files created.
4. Files modified.
5. Vessel rules implemented.
6. Gear rules implemented.
7. Port rules implemented.
8. Species rules implemented.
9. Map rules implemented.
10. Validator registry or resolver approach.
11. Validation error codes added or reused.
12. Fixtures added.
13. Tests added.
14. Focused test results.
15. Complete test-suite result.
16. Coverage result.
17. Lint result.
18. Formatting result.
19. SonarCloud considerations addressed.
20. Confirmation that input data is not mutated.
21. Confirmation that legacy fields are not reinterpreted destructively.
22. Confirmation that no database or Redis functionality was introduced.
23. Confirmation that no S3, Floci, authentication, API, cache, normalisation, upload, or activation functionality was introduced.
24. Work deferred to later approved steps.
25. Remaining assumptions, risks, or owner decisions.
    Do not modify the approved implementation plan.

If you reach any ambiguity, ask me to clarify.
