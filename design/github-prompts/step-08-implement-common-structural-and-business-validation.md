# Step 08: Implement Common Structural and Business Validation

## Recommended reasoning effort

- **Planning phase:** High
- **Implementation phase:** High

## Copilot operating mode

Start in **Plan mode** .

Before modifying any source file:

1. Inspect the complete repository.
2. Read the approved plans and implementation outputs from previous steps.
3. Identify existing domain types, schemas, validation utilities, error contracts, test conventions, and module boundaries.
4. Determine which validation responsibilities already exist and which remain to be implemented.
5. Produce a repository-specific implementation plan.
   Do not assume the repository is empty.

Do not begin implementation until the plan has been reviewed and approved.

After plan approval, the **first implementation action** must be to save the approved plan as:

Plain Text

```text
github-prompts/Step 08-implement-common-structural-and-business-validation-plan.md
```

Only after saving the approved plan may implementation begin.

## Objective

Implement the reusable validation foundation for Reference Data Service collection files.

This step must provide common validation that can be applied consistently across vessels, gears, ports, species, and map-location collections.

The validation must distinguish between:

1. **Structural validation** , which determines whether a collection conforms to the expected technical shape.
2. **Common business validation** , which determines whether identifiers, versions, counts, codes, dates, duplicates, and relationships comply with shared Reference Data Service rules.
   This step must establish the common validation pipeline and extension points needed by later dataset-specific validation work.

Do not implement the complete upload API, S3 persistence workflow, collection activation process, or mobile projections in this step.

## Project context

The Reference Data Service is a Node.js and Hapi.js backend service responsible for managing and serving reference data for the Catch Recording application.

Supported reference-data domains are:

- Vessels
- Gears
- Ports
- Species
- Map-location data, including statistical areas and supporting map collections
  Reference data is persisted as complete JSON or GeoJSON collection files in S3.

The service also maintains parsed and normalised JSON objects in process memory for efficient reads.

The service supports:

- Retrieval of complete reference-data collections
- Search and filtered retrieval
- Validation of complete collection files
- Replacement of a complete reference-data collection
  The service does not support item-level create, update, patch, or delete operations.

## Architectural constraints

Preserve these constraints:

1. The **Validation Module** owns structural and business validation.
2. The **Validation Module** is the only application component permitted to communicate with the Authentication Service, although Authentication Service integration is outside the scope of this validation step unless already implemented.
3. The **Persistence Module** is the only application component permitted to access S3.
4. The validation implementation must not access S3 directly.
5. The validation implementation must not depend directly on Hapi.js request objects.
6. The validation implementation must operate on domain inputs and return domain validation results.
7. Canonical schemas must remain aligned with legacy schemas wherever practical.
8. Every maintained reference-data entity uses a GUID or UUID as its stable technical identifier.
9. Business identifiers remain separate from GUIDs.
10. The validation foundation must support both JSON collections and GeoJSON map collections.
11. Invalid data must not proceed to persistence or collection activation.
12. Validation must not mutate the supplied input.
13. Normalisation and validation are separate responsibilities.
14. Redis or another external cache must not be introduced.

## Existing implementation alignment

Before planning changes, inspect the repository for:

- Existing Validation Module structure
- Existing collection-envelope types
- Existing manifest types
- Supported dataset identifiers
- Existing JSON Schema definitions
- Existing schema-validation libraries
- Existing runtime validation libraries
- Existing validation result types
- Existing API error types
- Existing problem-details or error-envelope conventions
- Existing GUID validation utilities
- Existing date and version validation utilities
- Existing duplicate-detection utilities
- Existing test helpers and fixture builders
- Existing canonical schemas
- Existing GeoJSON types
- Existing normalisation interfaces
- Existing logging conventions
- Existing dependency-injection conventions
- Existing controller validation
- Existing Hapi.js route validation
- Existing validation packages and package versions
  Retain useful existing conventions.

Do not introduce a second validation framework unless the existing framework cannot satisfy the agreed requirements. If a replacement or additional library is necessary, explain the reason, migration impact, and alternatives in the plan.

## Validation responsibilities

The implementation must clearly separate these validation layers.

### Layer 1: Parsing

Parsing determines whether the input can be read as the expected file format.

Examples:

- Valid JSON
- Valid GeoJSON JSON document
- Supported root value type
  Parsing errors must not be reported as business-rule failures.

### Layer 2: Structural validation

Structural validation determines whether the parsed document conforms to the applicable schema.

Examples:

- Required properties exist
- Property types are correct
- GUID fields contain syntactically valid GUIDs
- Date-time fields use the required representation
- Enum values are supported
- Collection items are represented by an array
- GeoJSON roots use `FeatureCollection`
- Unknown properties are handled according to the agreed schema policy

### Layer 3: Common business validation

Common business validation applies shared rules that cannot be expressed adequately through basic structural schemas.

Examples:

- Collection dataset matches the expected dataset
- Collection version is valid
- Item count matches the actual number of records
- GUIDs are unique within the appropriate scope
- Required business codes are unique
- Effective dates are internally consistent
- Referenced IDs resolve within the expected collection scope
- Parent-child relationships do not contain invalid references
- Collection metadata is internally consistent

### Layer 4: Dataset-specific business validation

Dataset-specific validators apply rules unique to vessels, gears, ports, species, or map-location data.

This step must define the extension mechanism for dataset-specific validation.

Implement only dataset-specific behaviour already required to prove the common framework. Avoid prematurely implementing all later dataset-specific validation rules unless the current repository plan explicitly places those rules in Step 08.

## Common collection-envelope validation

Validate the common collection envelope established by the project.

Adapt property names to the approved repository contracts. Do not create an incompatible alternative envelope.

The common envelope is expected to include concepts equivalent to:

JSON

```text
{
  "dataset": "ports",
  "collectionId": "0be553de-f430-49f7-b120-1e8e5ad972dc",
  "schemaVersion": "1.0",
  "version": "2026.09.11.1",
  "generatedAt": "2026-09-11T08:30:00Z",
  "effectiveFrom": "2026-09-11T00:00:00Z",
  "itemCount": 2,
  "items": []
}
```

Validate at minimum:

- The root is an object.
- `dataset` is present.
- `dataset` is supported.
- `collectionId` is present.
- `collectionId` is a valid GUID.
- `schemaVersion` is present.
- `schemaVersion` is supported.
- `version` is present.
- `version` conforms to the approved collection-version format.
- `generatedAt` is a valid date-time where required.
- `effectiveFrom` is valid when supplied.
- `itemCount` is a non-negative integer.
- `items` is an array for standard JSON collections.
- `itemCount` equals the actual number of items.
- Required properties are not null unless explicitly allowed.
- Unknown-property handling follows the approved schema policy.
  Do not silently coerce structurally invalid values during validation.

## Supported dataset validation

Use the central supported-dataset type or registry created by previous steps.

The expected maintained datasets include:

Plain Text

```text
vessels
gears
ports
species
map-land
map-statistical-areas
```

A derived `map-ports` projection may exist, but it is not independently uploaded or maintained.

Requirements:

- Dataset validation must be case-sensitive unless the approved design explicitly states otherwise.
- Unsupported datasets must return a machine-readable validation issue.
- The route or use-case dataset can be supplied as expected context.
- A mismatch between the expected dataset and the file's declared dataset must be reported.
- The validator must not infer the dataset from filenames.
- Dataset aliases must not be introduced without an approved requirement.

## GUID validation

Use GUIDs as stable technical identifiers.

Validate:

- Collection GUIDs
- Item GUIDs
- Nested entity GUIDs
- Relationship GUIDs
- GeoJSON feature GUIDs
- Parent and referenced GUIDs where applicable
  Requirements:

- Use one documented GUID policy consistently.
- Accept the GUID versions already approved by the repository.
- Do not regenerate a valid supplied GUID.
- Do not replace invalid GUIDs automatically.
- Detect duplicate GUIDs within the applicable scope.
- Report both the duplicate value and affected paths when safe.
- Do not confuse GUIDs with business identifiers.
  If the repository has not established whether validation should accept any RFC-compatible UUID or only selected versions, call out that ambiguity in the plan.

## Business-code validation

Business codes include values such as:

- CFR
- UVI
- MMSI
- IRCS
- Vessel external mark
- Vessel registration number
- Gear code
- Gear category code
- Gear characteristic code
- Port code
- FAO species code
- Statistical-area code
  Common validation must support reusable rules for:

- Required codes
- Optional codes
- Empty-string handling
- Leading and trailing whitespace detection
- Maximum length
- Approved character patterns
- Case-sensitive or case-insensitive uniqueness
- Duplicate detection
- Stable issue paths
  Do not create one universal code format for all datasets.

The common framework must allow each dataset validator to define the relevant code rules.

Business codes must remain separate from GUIDs in validation errors, types, and messages.

## Duplicate validation

Provide reusable duplicate-detection capabilities for:

- Top-level item GUIDs
- Business codes
- Nested entity GUIDs
- Nested scoped codes
- Compound logical keys
- Official-name constraints
- Relationship identifiers
- Statistical-area codes
  The duplicate utility must support:

- Case-sensitive comparison
- Case-insensitive comparison
- Optional normalised comparison keys
- A clear scope
- Stable source paths
- More than one duplicate group in a single validation run
- Safe reporting of rejected values
  Do not stop at the first duplicate unless the validation policy explicitly requires fail-fast behaviour.

The preferred validation behaviour is to collect all safely discoverable issues in one run.

## Date validation

Provide reusable date validation for:

- `generatedAt`
- `effectiveFrom`
- Optional effective-to values
- Dataset-specific active-from and active-to values
  Requirements:

- Validate syntax and semantic validity.
- Follow the project's approved ISO 8601 representation.
- Distinguish dates from date-times where the model requires that distinction.
- Reject impossible dates.
- Validate shared start/end ordering rules.
- Do not depend on the server's local timezone.
- Do not silently convert ambiguous local timestamps.
- Include the affected property path in validation issues.
  Do not introduce temporal business rules such as rejecting all future effective dates unless that rule is explicitly approved.

## Count and metadata validation

Validate internal consistency for metadata that can be checked without persistence access.

For JSON collections:

- `itemCount` matches `items.length` .
  For GeoJSON collections:

- `featureCount` matches `features.length` , if feature count is declared.
  For nested collection sections:

- Validate declared counts only where the approved schema includes those counts.
  Do not validate persisted S3 properties such as object size, object version, S3 ETag, or last-modified date in this step.

## Relationship validation framework

Provide a reusable mechanism for validating references within a collection.

Examples include:

- Gear `categoryId` referencing a category
- Gear characteristic relationships referencing characteristic definitions
- Statistical-area child features referencing parent areas
- Other approved nested references
  The relationship-validation mechanism must support:

- Building an index of available GUIDs or codes
- Validating that a reference resolves
- Reporting unresolved references
- Reporting the source path
- Reporting the expected target scope
- Detecting duplicate target identifiers
- Avoiding repeated full-array scans where practical
- Unit testing independently from a dataset schema
  Cross-collection references requiring another active collection are outside scope unless existing approved contracts explicitly require them at this stage.

Do not access the in-memory store or S3 to resolve relationships in this common validation step.

## Validation result model

Implement or align a framework-neutral validation result equivalent to:

TypeScript

```text
type ValidationResult = {
  valid: boolean;
  issues: ValidationIssue[];
  warnings: ValidationWarning[];
};
``
```

A validation issue should support concepts equivalent to:

TypeScript

```text
type ValidationIssue = {
  code: string;
  message: string;
  path?: string;
  rejectedValue?: unknown;
  context?: Record<string, unknown>;
};
```

A validation warning should use a similarly stable shape.

Adapt names to existing approved repository types.

Requirements:

- `valid` is `false` when one or more errors exist.
- Warnings alone do not make a result invalid.
- Error codes are stable and machine-readable.
- Messages are safe and understandable.
- Paths identify the relevant input location.
- Paths use one consistent notation.
- Rejected values are included only when safe.
- Validation issues must not contain stack traces.
- Internal exceptions must not leak through validation results.
- The validation result must not contain Hapi.js response objects.

## Error codes

Reuse existing approved error codes when available.

Otherwise, establish common validation codes equivalent to:

Plain Text

```text
invalid_document
invalid_root_type
required_property_missing
invalid_property_type
unsupported_dataset
dataset_mismatch
invalid_guid
duplicate_guid
unsupported_schema_version
invalid_collection_version
invalid_date
invalid_date_range
invalid_item_count
duplicate_business_code
unresolved_reference
invalid_enum_value
unexpected_property
invalid_geojson_structure
business_rule_failed
```

Requirements:

- Error code names use one consistent convention.
- A specific code is preferred over a generic code.
- Dataset-specific validators may add more specific codes later.
- API HTTP-status mapping must remain separate from low-level validation.
- Validation codes must not embed array positions or user values.

## Validation pipeline

Implement a reusable pipeline equivalent to:

Plain Text

```text
parse input
  -> validate common structure
  -> validate dataset structure
  -> validate common business rules
  -> validate dataset-specific business rules
  -> combine issues and warnings
  -> return validation result
```

The pipeline must:

- Keep each stage independently testable.
- Avoid persistence access.
- Avoid Authentication Service access.
- Avoid Hapi.js coupling.
- Avoid mutating input.
- Preserve deterministic issue ordering.
- Support standard JSON and GeoJSON collections.
- Support validation-only functionality in a later step.
- Support full upload validation in a later step.
- Support validation during cache loading where appropriate.
- Allow dataset-specific validator registration without large conditional chains.
  If normalisation precedes some business validation in the approved design, keep raw structural validation and post-normalisation business validation explicitly separated. Do not hide normalisation inside a validator.

## Dataset-validator registry

Create or align a registry that maps supported dataset identifiers to their structural and business validators.

The registry should make it possible to:

- Resolve the validator for a supported dataset.
- Reject unsupported datasets.
- Register a dataset-specific validator.
- Keep dataset validation isolated.
- Test registry completeness.
- Ensure every maintained dataset has an explicit validation strategy.
- Represent derived, non-uploadable datasets separately where needed.
  Avoid a single validation file containing all dataset rules.

Avoid switch statements distributed across controllers and services.

## GeoJSON structural foundation

Map-location collections require additional common structural checks.

Implement or establish extension points for:

- Root `FeatureCollection` type
- `features` array
- Feature object structure
- Feature GUID
- `properties` object
- Geometry presence
- Supported geometry types
- Numeric coordinate values
- Longitude-first coordinate ordering
- Polygon ring closure
- Non-empty geometry
  Do not implement advanced geospatial topology validation unless already approved for this step.

Advanced validation deferred to dataset-specific map work may include:

- Self-intersection checks
- Polygon overlap policy
- Parent-area containment
- Complex CRS conversion
- Area calculations
  The common validator must not silently convert a non-WGS84 collection. Conversion belongs to the Data Normalisation Module.

## Structural versus business validation examples

The following classifications should be preserved.

### Structural failures

Plain Text

```text
items is not an array
collectionId is not a string
generatedAt is not a valid date-time representation
a required property is missing
a GeoJSON document is not a FeatureCollection
a property contains an unsupported enum value
```

### Business failures

Plain Text

```text
itemCount does not equal the number of items
two records use the same GUID
two ports use the same port code
the collection dataset does not match the requested dataset
an active-to date precedes active-from
a gear references a missing category
a statistical area references a missing parent
```

Do not collapse all failures into a generic schema error.

## Validation behaviour

Unless an existing approved decision states otherwise:

- Collect all safely detectable validation issues.
- Return issues in deterministic order.
- Order issues by validation stage and then input path.
- Continue independent checks after one field fails when safe.
- Avoid cascading duplicate issues caused by one missing property.
- Skip dependent business checks when their required structural inputs are invalid.
- Do not throw for ordinary invalid input.
- Throw only for unexpected internal failures.
- Convert expected schema-library failures into domain validation issues.
- Return no mutated or partially corrected copy of the collection.

## API error integration

The Validation Module must produce domain validation results.

The API layer will later map validation failures to the agreed API error envelope.

The expected future API response is conceptually:

JSON

```text
{
  "error": {
    "code": "collection_validation_failed",
    "message": "The uploaded collection contains validation errors.",
    "traceId": "42e9acba-016e-47af-841d-903bd8e9dc36",
    "dataset": "ports",
    "details": [
      {
        "path": "items[17].id",
        "code": "invalid_guid",
        "message": "The value must be a valid GUID."
      }
    ]
  }
}
```

This step may implement an adapter to the existing standard error model if that model already exists.

Do not implement upload endpoints solely to demonstrate validation.

Do not include request trace IDs inside pure validation functions.

## Security and privacy requirements

- Treat collection input as untrusted.
- Apply configured input-size limits at the appropriate boundary.
- Avoid catastrophic regular expressions.
- Avoid unbounded recursion when validating nested data.
- Do not evaluate executable content.
- Do not dynamically import a validator based on an untrusted path.
- Do not include complete collection contents in validation logs.
- Do not expose stack traces through validation issues.
- Redact or omit unsafe rejected values.
- Avoid logging vessel identifiers or other potentially sensitive values unnecessarily.
- Define reasonable limits for issue collection to prevent a malicious file from creating an unbounded response.
- When an issue limit is reached, include a safe truncation indicator.
- Keep validation deterministic to support audit and troubleshooting.
- Do not make network calls during validation.
  Document any security-related limits introduced by this step.

## Performance requirements

Validation must be suitable for complete collection files.

Design for:

- Linear-time duplicate detection using maps or sets
- Reusable indexes for relationship checks
- Avoiding repeated scans of large collections
- Configurable maximum issue count
- Predictable memory consumption
- No unnecessary deep cloning of complete collections
- No JSON serialisation solely for equality checks
- No network or persistence operations
  Do not introduce premature streaming validation unless required by current repository constraints.

If expected maximum collection sizes are unknown, record that as an assumption and keep limits configurable.

## Logging requirements

Validation logging must follow existing structured logging conventions.

Log only summary information such as:

- Dataset
- Collection ID when structurally valid
- Collection version when structurally valid
- Validation duration
- Item or feature count
- Error count
- Warning count
- Whether issue output was truncated
  Do not log:

- Complete uploaded collections
- Authentication tokens
- Credentials
- Entire rejected records
- Stack traces for ordinary validation failures
  Unexpected validator failures may include protected diagnostic stack traces in server logs, according to repository conventions.

## Unit test requirements

Add comprehensive unit tests for the common validation foundation.

At minimum, cover:

### Collection structure

- Valid common collection envelope
- Missing required property
- Invalid root value
- Invalid property type
- Unsupported schema version
- Unsupported dataset
- Expected dataset mismatch
- Invalid collection GUID
- Invalid collection version
- Invalid generated date
- Invalid effective date
- Empty collection where allowed
- Empty collection where prohibited by configured rule
- Unknown property behaviour

### Item and identifier rules

- Valid item GUIDs
- Invalid item GUID
- Duplicate item GUID
- Duplicate nested GUID
- GUID versus business-code separation
- Multiple duplicate groups
- Stable duplicate issue paths

### Business-code rules

- Valid unique codes
- Duplicate codes
- Case-sensitive uniqueness
- Case-insensitive uniqueness
- Optional missing code
- Empty required code
- Invalid code pattern
- Invalid code length

### Count and date rules

- Correct item count
- Incorrect item count
- Valid date range
- End before start
- Timezone-independent validation

### Relationships

- Valid reference
- Missing reference
- Duplicate target identifier
- Multiple unresolved references
- Stable relationship issue paths

### Result behaviour

- Valid result with no issues
- Invalid result with multiple issues
- Warning-only result remains valid
- Deterministic issue ordering
- Maximum issue-count behaviour
- Safe rejected-value handling
- Input object remains unchanged
- Schema-library failures map to domain issues
- Unexpected internal failure remains distinguishable

### Registry

- Every supported maintained dataset has an explicit validator registration or documented placeholder strategy
- Unsupported datasets cannot resolve a validator
- Derived `map-ports` is not treated as an independently uploadable dataset
- Dataset-specific validators can be substituted in tests

### GeoJSON foundation

- Valid FeatureCollection
- Invalid root type
- Missing features array
- Missing feature GUID
- Invalid geometry structure
- Non-numeric coordinate
- Empty geometry
- Unclosed polygon ring according to the approved validation policy
  Use focused fixtures and builders. Avoid copying large collection documents into every test.

## Integration test requirements

If the repository has an established integration-test layer, add integration tests that exercise the Validation Module through its public application interface.

Integration tests should verify:

- A valid collection reaches the expected validation result.
- A structurally invalid collection is rejected.
- Multiple business issues are returned.
- Dataset-specific validator resolution works.
- Validation does not access S3.
- Validation does not call the Authentication Service.
- Validation output maps correctly to the existing API error model where that integration already exists.
  Do not require Floci, Docker, or a real Authentication Service for common validation tests.

Normal `npm test` must remain Docker-free according to the approved repository decision.

Do not place these tests under the Floci-specific test configuration unless a test genuinely requires Floci.

## Documentation requirements

Update the appropriate repository documentation with:

- Validation architecture
- Structural versus business validation
- Validation pipeline stages
- Validation result model
- Common error codes
- Dataset-validator registration
- GUID policy
- Business-code policy
- Duplicate handling
- Date policy
- GeoJSON structural policy
- Maximum issue-count policy
- Security considerations
- Performance considerations
- How to add a dataset-specific validator
- How to test validators
- Work deferred to later steps
  Include a short example showing how a dataset-specific validator composes with the common validation pipeline.

## Explicit exclusions

Do not implement:

- Complete upload API routes
- Multipart parsing unless already needed by an approved earlier step
- S3 reads or writes
- Floci provisioning or seed collection management
- Active manifest persistence
- Atomic collection replacement
- Rollback orchestration
- Cache refresh scheduling
- Complete mobile response projections
- Authentication Service calls
- API Gateway integration
- Fargate deployment
- Item-level mutation endpoints
- Redis or another external cache
- Automatic correction of invalid GUIDs
- Automatic replacement of duplicate business codes
- Silent data normalisation
- Full advanced geospatial topology validation
- Cross-collection validation requiring persisted collections unless previously approved

## Required plan content

The plan must include:

1. Current validation-related repository structure.
2. Existing validation libraries and versions.
3. Existing domain and error types.
4. Existing common collection contract.
5. Existing dataset schemas.
6. Existing conventions to retain.
7. Gaps against this step.
8. Proposed validation layers.
9. Proposed module and file structure.
10. Proposed validation result and issue types.
11. Proposed error-code catalogue.
12. Proposed dataset-validator registry.
13. Proposed structural validation approach.
14. Proposed common business-rule approach.
15. Proposed duplicate and relationship validation approach.
16. Proposed GeoJSON extension strategy.
17. Proposed maximum issue-count policy.
18. Exact files to create.
19. Exact files to modify.
20. Files intentionally left unchanged.
21. Unit-test approach.
22. Integration-test approach.
23. Documentation updates.
24. Security and privacy considerations.
25. Performance considerations.
26. Verification commands.
27. Assumptions and unresolved ambiguities.
28. Work explicitly deferred to later steps.

## Expected deliverables

- Approved plan saved as: Plain Text 1 github-prompts/Step 08-implement-common-structural-and-business-validation-plan.md
- Common structural validation implementation.
- Common business validation implementation.
- Collection-envelope validation.
- Supported-dataset validation.
- Reusable GUID validation.
- Reusable business-code validation.
- Reusable duplicate detection.
- Reusable date and date-range validation.
- Item-count consistency validation.
- Reusable intra-collection relationship validation.
- Validation result and issue types.
- Stable common validation error codes.
- Dataset-validator registry or equivalent extension mechanism.
- GeoJSON structural-validation foundation.
- Maximum issue-count protection.
- Unit tests.
- Appropriate integration tests.
- Updated validation documentation.
- Completion report.

## Acceptance criteria

- Common validation is owned by the Validation Module.
- Validation operates on domain inputs rather than Hapi.js request objects.
- Validation does not access S3.
- Validation does not call the Authentication Service.
- Validation does not mutate input.
- Structural and business failures remain distinguishable.
- Collection envelopes are validated consistently.
- Unsupported datasets are rejected.
- Dataset mismatches are reported.
- Collection and item GUIDs are validated.
- Duplicate GUIDs are detected.
- Business codes remain separate from GUIDs.
- Duplicate business codes can be detected according to dataset-defined comparison rules.
- Item and feature counts are checked.
- Common date ranges are checked.
- Intra-collection references can be validated efficiently.
- Validators collect multiple safely detectable issues.
- Issue ordering is deterministic.
- Error codes are stable and machine-readable.
- Issue paths consistently identify affected input fields.
- Unsafe rejected values are omitted or redacted.
- The maximum number of reported issues is bounded.
- Dataset-specific validators can be registered without modifying controllers.
- Standard JSON and GeoJSON collections are supported.
- `map-ports` is not treated as an independently uploadable collection.
- No invalid GUID is automatically replaced.
- No normalisation is hidden inside validation.
- No complete collection input is written to logs.
- Normal tests remain Docker-free.
- Unit tests cover valid, invalid, boundary, and multi-error scenarios.
- Type checking passes.
- Linting passes, or pre-existing failures are clearly distinguished.
- Existing tests continue to pass.
- Documentation accurately describes the implemented validation behaviour.
- Work outside this step remains deferred.

## Verification

Use the repository's actual package manager and scripts.

Run the applicable equivalents of:

Plain Text

```text
install dependencies
run type checking
run linting
run common validation unit tests
run validation integration tests
run the complete Docker-free test suite
run the build
verify a valid collection
verify a structurally invalid collection
verify a collection containing multiple business failures
verify duplicate GUID detection
verify duplicate business-code detection
verify item-count mismatch detection
verify invalid date-range detection
verify unresolved relationship detection
verify deterministic issue ordering
verify issue-count truncation
verify a valid GeoJSON FeatureCollection
verify an invalid GeoJSON collection
verify that validation does not mutate the input
verify that common validation performs no S3 calls
verify that common validation performs no Authentication Service calls
```

Record exact commands and results in the completion report.

If a verification failure is caused by a pre-existing issue outside this step:

1. Record the exact failing command.
2. Identify the likely pre-existing cause.
3. Explain whether the failure blocks this step.
4. Do not broaden implementation scope silently.
5. Ask for clarification if resolving the issue would require an architectural change.

## Completion response

Provide a concise implementation report containing:

- Repository state discovered
- Validation approach selected
- Validation library used
- Files created
- Files modified
- Common rules implemented
- Error codes introduced or reused
- Dataset-validator registrations
- Tests added
- Verification commands and results
- Security and privacy controls
- Performance safeguards
- Existing issues not introduced by this step
- Work deferred to subsequent steps
- Remaining assumptions, risks, or owner decisions
  if you reach any ambiguity ask me to clarify
