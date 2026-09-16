# Step 10: Implement Canonical Data Normalisation

## Recommended reasoning effort

- **Planning phase:** High
- **Implementation phase:** High

## Copilot operating mode

Start in **Plan mode** .

Before modifying any source file:

1. Inspect the complete repository.
2. Read the approved master implementation plan.
3. Read the approved plans and implementation summaries from all completed steps.
4. Inspect the existing canonical schemas, common validation, persistence contracts, tests, fixtures, and module boundaries.
5. Identify existing normalisation code and determine whether it should be retained, extended, moved, or replaced.
6. Produce a repository-specific implementation plan based on the code that actually exists.
   Do not assume the repository is empty.

Do not begin implementation until the plan has been reviewed and approved.

After plan approval, the **first implementation action** must be to save the approved plan as:

Plain Text

```text
github-prompts/Step 10-implement-canonical-data-normalisation-plan.md
```

Only after saving the approved plan may implementation begin.

## Objective

Implement the **Data Normalisation Module** responsible for converting structurally valid reference-data collection inputs into deterministic canonical representations.

The normalisation process must:

- Preserve the meaning and coverage of the legacy reference-data schemas wherever practical.
- Preserve valid supplied GUIDs.
- Preserve business identifiers separately from GUIDs.
- Apply only safe, deterministic transformations.
- Produce canonical JSON or GeoJSON objects suitable for subsequent business validation, persistence, in-memory storage, and API projection.
- Produce structured warnings describing non-destructive changes.
- Reject or report ambiguous transformations rather than guessing.
- Avoid mutating the supplied input.
- Remain independent of Hapi.js, S3, Floci, the Authentication Service, and the in-memory data store.
  This step must implement canonical input normalisation only.

It must not implement mobile response projections, complete upload endpoints, S3 activation, cache refresh, or item-level mutations.

## Project context

The Reference Data Service is a Node.js and Hapi.js backend service for the Catch Recording application.

The service manages these maintained reference-data domains:

- Vessels
- Gears
- Ports
- Species
- Map-location data, including land and statistical-area collections
  Reference-data collections are persisted as complete JSON or GeoJSON files in S3.

The Reference Data Service keeps parsed and normalised JSON objects in process memory for efficient queries.

The API supports complete collection retrieval and filtered search.

Collection management is limited to uploading and replacing a complete reference-data collection.

The service does not support item-level create, update, patch, or delete operations.

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
  Preserve these ownership rules:

1. The **Data Normalisation Module** owns canonical transformation rules.
2. The **Validation Module** owns structural and business validation.
3. The **Persistence Module** is the only application component permitted to access S3.
4. The **Validation Module** is the only application component permitted to call the Authentication Service.
5. The Data Normalisation Module must not access S3 or Floci.
6. The Data Normalisation Module must not call the Authentication Service.
7. The Data Normalisation Module must not depend on Hapi.js request or response objects.
8. The Data Normalisation Module must not update the in-memory data store directly.
9. The Data Normalisation Module must not persist files.
10. The Data Normalisation Module must not generate API responses.
11. Normalisation and validation must remain separate, explicit stages.
12. Redis or another external cache must not be introduced.

## Repository assessment

Before preparing the implementation plan, inspect the repository for:

- Existing `Data Normalisation Module` folders or files
- Existing collection-envelope types
- Existing canonical schemas
- Existing dataset registries
- Existing structural and business validators
- Existing validation result and warning types
- Existing issue-path conventions
- Existing GUID utilities
- Existing date utilities
- Existing code-format utilities
- Existing GeoJSON types and helpers
- Existing immutable-object or cloning utilities
- Existing checksum or canonical-serialisation utilities
- Existing error classes and error mapping
- Existing logger interfaces
- Existing test fixtures and builders
- Existing vessel, gear, port, species, and map sample data
- Existing dependency-injection conventions
- Existing JavaScript or TypeScript module conventions
- Existing performance and file-size limits
- Existing legacy-schema mapping decisions
- Existing normalisation rules introduced by earlier steps
- Existing tests that imply expected normalisation behaviour
  Retain compatible existing conventions.

Do not introduce duplicate normalisation frameworks or competing result models.

If earlier implemented code conflicts with this prompt, identify the conflict in the plan and follow the approved master plan and current repository decisions.

## Definitions

### Structural validation

Structural validation determines whether the input has the required technical shape and types.

Examples:

- The root value is an object.
- `items` is an array.
- `collectionId` is a string containing a valid GUID.
- A port coordinate is represented by numeric values.
- A GeoJSON root is a `FeatureCollection` .
  Structural validation belongs to the Validation Module.

### Canonical normalisation

Canonical normalisation applies safe and deterministic transformations to structurally usable input.

Examples:

- Trimming leading and trailing whitespace.
- Applying approved casing rules to business codes.
- Converting an explicitly permitted numeric string to a number.
- Converting a permitted date representation to the canonical ISO representation.
- Replacing an approved missing optional representation with the canonical representation.
- Ensuring deterministic property and collection ordering where the approved canonical contract requires it.
- Converting a supported map coordinate representation to WGS84 when the conversion inputs are explicit and unambiguous.
  Canonical normalisation belongs to the Data Normalisation Module.

### Business validation

Business validation determines whether the normalised data satisfies domain rules.

Examples:

- Duplicate GUIDs.
- Duplicate port codes.
- Invalid active date ranges.
- Missing gear category relationships.
- `itemCount` not matching the normalised item count.
  Business validation belongs to the Validation Module.

Do not conceal validation failures by normalising invalid business data.

## Required normalisation pipeline

Implement or align a reusable pipeline equivalent to:

Plain Text

```text
structurally validated input
  -> resolve dataset normaliser
  -> normalise common collection metadata
  -> normalise dataset-specific content
  -> collect deterministic warnings
  -> return normalised collection and warnings
  -> run business validation separately
```

The complete future upload workflow is expected to be equivalent to:

Plain Text

```text
parse
  -> structural validation
  -> canonical normalisation
  -> business validation
  -> persistence
  -> activation
  -> in-memory refresh
```

This step owns only the canonical normalisation stage and its direct unit and integration tests.

If the existing approved pipeline orders some checks differently, document the reason and preserve a clear separation between structural validation, normalisation, and business validation.

## Normalisation input contract

The normaliser must receive:

- A supported dataset identifier
- A structurally valid collection object
- Explicit normalisation context when required
- An optional schema version when not already available in the envelope
  The normaliser must not infer the dataset from:

- A filename
- An S3 object key
- A URL
- A Hapi.js route
- Arbitrary collection contents
  The dataset declared by the collection must remain subject to validation against the expected dataset.

## Normalisation result contract

Implement or align a framework-neutral result equivalent to:

TypeScript

```text
type NormalisationResult<T> = {
  value: T;
  changed: boolean;
  warnings: NormalisationWarning[];
};
```

A warning should support concepts equivalent to:

TypeScript

```text
type NormalisationWarning = {
  code: string;
  message: string;
  path?: string;
  originalValue?: unknown;
  normalisedValue?: unknown;
  context?: Record<string, unknown>;
};
```

Adapt the names to existing approved repository conventions.

Requirements:

- `value` contains the complete canonical collection.
- `changed` is `true` only when at least one value changed.
- `warnings` are deterministic and machine-readable.
- Warning codes are stable.
- Input paths use the same convention as validation paths.
- Unsafe values are omitted or redacted.
- Warning messages do not contain stack traces.
- Ordinary normalisation changes do not throw.
- Ambiguous or unsupported transformations must produce a defined failure or issue rather than guessed output.
- The output type must preserve dataset-specific canonical typing where the repository supports it.
  If the repository already distinguishes between warnings and normalisation errors, preserve that model.

## Immutability requirements

Normalisation must not mutate:

- The input collection
- Individual input records
- Nested arrays
- Nested objects
- GeoJSON coordinate arrays
- Shared test fixture objects
  Requirements:

- Return a new canonical value when changes are required.
- Reuse immutable values only when safe and consistent with repository conventions.
- Do not use JSON serialisation as a generic deep-cloning mechanism.
- Preserve non-mutating behaviour when normalisation fails.
- Add explicit tests proving that the input remains unchanged.
  Avoid unnecessary full deep clones when the input is already canonical.

## Idempotency requirements

Canonical normalisation must be idempotent.

For every supported collection:

Plain Text

```text
normalise(normalise(input).value).value
```

must be deeply equivalent to:

Plain Text

```text
normalise(input).value
```

The second pass should produce:

- `changed: false`
- No new warnings caused by the first normalisation pass
  Add idempotency tests for every implemented dataset normaliser.

## Valid GUID preservation

Every maintained entity uses a GUID or UUID as its stable technical identifier.

Normalisation must:

- Preserve valid supplied GUID values.
- Preserve GUID values used by nested entities and relationships.
- Never generate a replacement GUID for an invalid supplied value.
- Never derive a GUID from a business code.
- Never substitute a business code for a GUID.
- Never change GUID letter casing unless the project has an explicit canonical UUID-casing rule.
- Never remove GUIDs because related business codes are present.
  Invalid GUIDs are validation failures and must not be silently repaired.

If input records without GUIDs are permitted by a future migration workflow, that workflow must be approved separately and is outside this step.

## Business identifier preservation

Preserve business identifiers separately from GUIDs, including applicable values such as:

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
  Requirements:

- Do not use business codes as technical IDs.
- Do not discard legacy identifiers that are part of the approved canonical schema.
- Do not combine distinct identifiers into one field.
- Do not split identifiers unless an approved rule explicitly requires it.
- Apply dataset-specific casing rules only when approved.
- Preserve meaningful leading zeros, especially for port codes and other formatted identifiers.
- Do not convert identifier strings into numbers.
- Do not trim internal whitespace unless a dataset-specific rule explicitly permits it.

## Common collection normalisation

Implement common rules for the approved collection envelope.

Adapt property names to existing repository contracts.

The envelope is expected to contain concepts equivalent to:

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

Common normalisation may include:

- Trimming approved metadata strings.
- Applying the canonical schema-version representation.
- Applying the canonical collection-version representation where unambiguous.
- Normalising approved date-time values to UTC ISO 8601.
- Normalising optional absent values according to the schema policy.
- Recalculating `itemCount` only if the approved design assigns count derivation to normalisation.
- Preserving collection GUIDs.
- Preserving dataset identifiers exactly as approved.
  Do not silently change an unsupported dataset into a supported dataset.

Do not silently rewrite a collection version with ambiguous semantics.

If `itemCount` differs from the actual number of records and the approved design treats that as a business error, preserve the input count so the Validation Module can report the mismatch. Do not automatically conceal that error.

## String normalisation

Provide reusable string-normalisation helpers with explicit policies.

Supported behaviours may include:

- Trim leading whitespace.
- Trim trailing whitespace.
- Collapse internal whitespace only for fields with an approved rule.
- Convert empty optional strings to `null` only when the canonical schema requires `null` .
- Convert empty optional strings to omission only when the canonical schema requires omission.
- Apply uppercase or lowercase only to fields with explicit casing rules.
- Preserve Unicode content.
- Apply Unicode normalisation only when approved and tested.
- Preserve names and display text casing unless an explicit rule exists.
  Do not apply a global trim-and-uppercase operation to every string.

Each transformation must be associated with a field policy and, where appropriate, a warning.

## Numeric normalisation

Provide reusable numeric conversion only where explicitly allowed.

Requirements:

- Convert numeric strings only for fields defined as permitting legacy numeric-string input.
- Reject or report strings containing units.
- Reject or report locale-specific ambiguous formats unless explicitly supported.
- Preserve identifier strings containing digits.
- Preserve leading zeros in codes.
- Reject or report `NaN` , infinity, and values outside the supported range.
- Do not round values unless an approved precision rule exists.
- Do not convert empty strings to zero.
- Do not convert `null` to zero.
- Produce a warning when a permitted numeric string becomes a number.
  Examples of values that may be converted only under field-specific policy:

Plain Text

```text
"8.74" -> 8.74
"50.3661" -> 50.3661
"-4.1427" -> -4.1427
```

Examples that must remain strings:

Plain Text

```text
"0349"
"232001234"
"2026.09.11.1"
```

## Boolean normalisation

Normalise booleans only when explicitly permitted by an approved legacy mapping.

Potential accepted legacy representations may include:

Plain Text

```text
true
false
"true"
"false"
``
```

Do not automatically treat these values as booleans unless an explicit field policy permits it:

Plain Text

```text
1
0
"yes"
"no"
"Y"
"N"
```

If such mappings are required by legacy input, define them per field or schema version and cover them with tests.

Do not apply JavaScript truthiness as a normalisation rule.

## Date and time normalisation

Normalise approved date and date-time values consistently.

Requirements:

- Preserve date-only values as dates when the canonical property is date-only.
- Convert date-time values to the approved UTC ISO 8601 representation.
- Do not use the server's local timezone.
- Reject or report ambiguous timestamps without an offset when UTC cannot be safely assumed.
- Do not create current timestamps inside pure normalisation functions.
- Do not change business-effective dates based on the execution date.
- Preserve `null` or absence according to the canonical schema.
- Do not repair impossible dates.
- Produce warnings for safe format conversions.
  All date-related tests must run deterministically under `TZ=UTC` where the repository uses that convention.

## Null, omission, and empty-value policy

Use the canonical schemas as the source of truth.

For each optional field, define whether the canonical representation is:

- Property omitted
- Property present with `null`
- Empty array
- Empty object
- Empty string, only where explicitly meaningful
  Do not apply one global empty-value policy to all fields.

Requirements:

- Required missing fields remain validation failures.
- Optional empty strings may be normalised only according to an explicit field rule.
- Empty arrays must not become `null` when the canonical schema expects an array.
- Do not remove false boolean values.
- Do not remove numeric zero.
- Do not remove meaningful empty GeoJSON collections when allowed.
- Preserve semantic distinctions established by the legacy model.

## Deterministic ordering

Determine from the approved canonical schema whether ordering is semantically meaningful.

The preferred policy is:

- Preserve source order for top-level items unless an approved canonical ordering exists.
- Preserve source order for names, relationships, and features unless an approved ordering exists.
- Use deterministic sorting only where ordering is explicitly part of the canonical contract.
- Never sort GeoJSON coordinate arrays.
- Never sort polygon vertices.
- Never sort values in a way that changes business priority.
- Ensure warning ordering is deterministic.
  If deterministic serialisation is needed later for checksum generation, keep canonical serialisation distinct from semantic collection ordering unless the approved design says otherwise.

## Dataset normaliser registry

Implement or align a registry mapping maintained dataset identifiers to normalisers.

The registry must support:

- Common collection normalisation.
- Dataset-specific normaliser resolution.
- Explicit handling of unsupported datasets.
- Independent testing of each normaliser.
- Addition of future schema-version-specific normalisers.
- Separation of maintained datasets from derived projections.
- An explicit rule that `map-ports` is derived and not independently normalised as an uploaded collection.
  Avoid:

- Distributed switch statements.
- Dataset checks in controllers.
- Dynamic imports based on untrusted path values.
- One large normalisation function containing every dataset rule.

## Vessel normalisation

Implement canonical vessel normalisation based on the approved vessel schema.

Potentially normalisable fields include:

- Vessel name
- `namePln`
- CFR
- UVI
- MMSI
- IRCS
- External mark
- Registration number
- Vessel type code
- Registration country code
- Length overall
- Status
- Active dates
  Requirements:

- Preserve vessel GUID.
- Preserve all approved natural identifiers.
- Preserve leading zeros in identifiers.
- Do not infer missing CFR, UVI, MMSI, IRCS, registration number, or external mark from another field.
- Do not infer a home port.
- Do not build `namePln` unless an approved deterministic rule explicitly assigns that responsibility to normalisation.
- Apply country-code casing only according to the approved rule.
- Convert length to a number only when the approved legacy input permits numeric strings.
- Do not convert MMSI or registration numbers to numbers.
- Do not repair invalid active-date ranges.
- Preserve legacy semantics.

## Gear normalisation

Implement canonical gear normalisation based on the approved gear schema.

Potentially normalisable structures include:

- Gear records
- Gear categories
- Characteristic definitions
- Gear-to-characteristic relationships
- Data-type values
- Units
- Minimum and maximum values
- Pair-fishing capability
- Fixed and required indicators
- Vessel-length applicability
  Requirements:

- Preserve all GUIDs.
- Preserve gear, category, and characteristic codes.
- Preserve the legacy `fixed` property explicitly.
- Do not reinterpret `fixed` as the mobile distinction between required and variable measurement.
- Do not remove characteristic relationships.
- Convert numeric limits only through field-specific rules.
- Convert boolean representations only through field-specific legacy mappings.
- Apply canonical code casing only when approved.
- Preserve under-ten, ten-to-twelve, and over-twelve applicability as distinct values.
- Do not resolve missing references during normalisation.
- Do not generate missing categories or characteristics.
- Do not produce mobile measurement arrays in this step.

## Port normalisation

Implement canonical port normalisation based on the approved port schema.

Potentially normalisable fields include:

- Port name
- Port code
- Country code
- Latitude
- Longitude
- Active status
  Requirements:

- Preserve port GUID.
- Preserve leading zeros in port codes.
- Keep port codes as strings.
- Apply country-code casing according to the approved rule.
- Convert coordinate numeric strings only when structurally permitted.
- Do not swap latitude and longitude based on guesses.
- Do not infer missing coordinates.
- Do not geocode port names.
- Do not remove ports without coordinates.
- Do not create derived `map-ports` output in this step.
- Leave out-of-range coordinates for business validation rather than clamping them.

## Species normalisation

Implement canonical species normalisation based on the approved species schema.

Potentially normalisable structures include:

- Species records
- FAO codes
- Scientific names
- Country-scoped common names
- Local names
- Language codes
- Official-name indicators
  Requirements:

- Preserve species and nested name GUIDs.
- Preserve scientific names.
- Preserve all approved common and local names.
- Do not flatten multiple names into one canonical name.
- Do not resolve a mobile display name in this step.
- Apply FAO-code casing only according to the approved rule.
- Apply country-code casing only according to the approved rule.
- Normalise BCP 47 language tags only using an approved deterministic mechanism.
- Do not translate names.
- Do not infer language or country from name text.
- Do not remove non-official names.
- Do not automatically select one official name when duplicates exist.
- Duplicate official names remain a business-validation concern.

## Map-location normalisation

Implement canonical map normalisation for maintained map datasets.

Maintained uploadable map datasets include:

- `map-land`
- `map-statistical-areas`
  The derived `map-ports` dataset is not uploaded independently.

Potential normalisation includes:

- Converting permitted numeric coordinate strings to numbers.
- Converting an explicitly declared supported source CRS to WGS84.
- Applying canonical GeoJSON property names where an approved mapping exists.
- Normalising statistical-area codes according to approved rules.
- Closing an unclosed polygon ring only if the policy explicitly permits safe closure.
- Preserving feature GUIDs.
- Preserving polygon and multipolygon structure.
  Requirements:

- Output valid canonical GeoJSON.
- Use WGS84 coordinates.
- Use longitude first and latitude second.
- Preserve coordinate precision unless an approved precision rule exists.
- Do not swap coordinate order based only on value ranges.
- Do not infer a source CRS.
- Do not convert coordinates without explicit source-CRS information.
- Do not simplify geometries.
- Do not remove vertices.
- Do not repair self-intersections.
- Do not merge overlapping polygons.
- Do not infer missing parent areas.
- Do not generate missing statistical-area GUIDs.
- Do not calculate area or centroid unless explicitly included in the approved normalisation scope.
- Do not create `map-ports` in this step.
  If CRS conversion is required, use a mature existing library already present in the repository or justify any new dependency in the plan.

## Warning codes

Reuse existing approved warning codes when available.

Otherwise establish stable codes equivalent to:

Plain Text

```text
whitespace_trimmed
code_case_normalised
numeric_string_converted
boolean_string_converted
date_time_normalised
language_tag_normalised
empty_optional_value_normalised
polygon_ring_closed
source_crs_converted
property_name_mapped
deprecated_legacy_field_mapped
```

Requirements:

- Warning codes use the repository's naming convention.
- Warning messages are safe and concise.
- Warnings include stable paths.
- Warnings do not include complete records.
- Warnings do not expose sensitive values unnecessarily.
- One transformation should not produce duplicate warnings.
- Unsupported or ambiguous transformations must not be downgraded to harmless warnings.

## Normalisation failures

Normalisation must fail safely when:

- The dataset has no registered normaliser.
- A transformation is ambiguous.
- A legacy value cannot be converted without possible meaning loss.
- A declared source CRS is unsupported.
- A value is outside the representable target type.
- A required mapping is unavailable.
- A normalisation rule encounters an unexpected internal condition.
  Align with existing domain error conventions.

Do not map these failures directly to Hapi.js responses inside the Data Normalisation Module.

Do not convert an ambiguous transformation into `null` , an empty string, zero, or a generated value.

## Legacy-schema alignment

Canonical schemas must stay aligned with the legacy data model wherever practical.

Normalisation may adapt legacy representation differences, but it must not silently remove legacy semantics.

Requirements:

- Document every legacy-to-canonical field mapping implemented.
- Distinguish property renaming from semantic transformation.
- Preserve both GUIDs and business identifiers.
- Preserve nested gear structures.
- Preserve multiple species names.
- Preserve optional ports without coordinates.
- Preserve vessel natural identifiers.
- Identify map-location data as a newer reference-data domain.
- Do not claim a legacy field exists where none was identified.
- Keep mappings traceable and testable.
  If a legacy field has ambiguous meaning, preserve the original canonical field or reject the mapping pending clarification.

## Interaction with common validation

Step 08 implemented or established common structural and business validation.

Integrate normalisation without duplicating that work.

Requirements:

- Structural validation runs before normalisation.
- Normalisation receives structurally usable input.
- Business validation runs after normalisation where the approved pipeline requires it.
- Reuse Validation Module result and path conventions.
- Do not move duplicate detection into normalisation.
- Do not move unresolved-reference checks into normalisation.
- Do not move date-range correctness into normalisation.
- Do not use normalisation to make invalid data pass validation.
- Add integration tests proving the stage order.
  If the repository currently validates all business rules before normalisation, document the impact and propose the smallest safe alignment.

## Interaction with persistence

The Data Normalisation Module must not access the Persistence Module.

This step must not:

- Read active collections from S3.
- Write normalised collections to S3.
- Read or update manifests.
- Check persisted collection versions.
- Calculate S3 ETags.
- Call Floci.
- Create buckets.
- Seed local collections.
  The future Command Module will coordinate normalisation and persistence.

Normalisation tests must remain Docker-free.

## Interaction with API projections

Canonical input normalisation and mobile response normalisation are different responsibilities.

This step must not implement:

- `view=mobile`
- Mobile vessel summaries
- Mobile gear measurement projections
- Species display-name resolution
- Mobile port display names
- Derived map-port API responses
- Consumer-specific field removal
- API pagination or search projections
  Canonical output must retain enough information for later mobile projections.

## Security and privacy requirements

Treat all collection input as untrusted.

Requirements:

- Do not execute input content.
- Do not dynamically evaluate mappings.
- Do not dynamically import modules from input values.
- Avoid catastrophic regular expressions.
- Bound recursive operations.
- Respect configured collection and issue limits.
- Do not log complete collection contents.
- Do not log credentials or tokens.
- Avoid logging complete vessel identifiers.
- Redact unsafe original and normalised warning values.
- Do not make network calls.
- Do not load remote schemas.
- Do not access local files based on collection values.
- Do not permit prototype-pollution keys to alter application objects.
- Build output objects safely.
- Review third-party conversion libraries for maintenance, licence, and security impact.
  Document any new dependency and its security implications.

## Performance requirements

Normalisation must be appropriate for complete reference-data collections.

Design for:

- Linear traversal of collection items
- No repeated full-array scans without justification
- No network operations
- No persistence operations
- Controlled warning collection
- No unnecessary JSON serialisation
- No unnecessary deep cloning
- Reuse of mapping configuration
- Predictable memory usage
- Dataset-level performance tests where practical
  If collection-size expectations are unknown, record that assumption and keep relevant limits configurable.

Do not introduce worker threads or streaming transformation unless current repository evidence demonstrates a need.

## Logging and observability

Follow existing structured logging conventions.

The pure normalisation functions should not require a logger unless the repository architecture explicitly standardises one.

At the orchestration boundary, summary logging may include:

- Dataset
- Collection ID when available and valid
- Collection version
- Input count
- Output count
- Whether values changed
- Warning count
- Normalisation duration
  Do not log:

- Complete records
- Complete collection files
- Authentication tokens
- AWS credentials
- Full vessel identifiers
- Full rejected values
- Complete GeoJSON geometry
  Warnings returned to callers must remain separate from operational logs.

## Unit test requirements

Add comprehensive Docker-free unit tests.

### Common collection normalisation

Cover:

- Already canonical collection
- Leading and trailing metadata whitespace
- Canonical schema version
- Canonical collection version
- Valid date-time conversion
- Ambiguous date-time rejection
- Optional null and omission policy
- Item-count policy
- Unsupported dataset
- Input remains unchanged
- Idempotency
- Deterministic warnings
- Safe warning values

### String policies

Cover:

- Leading whitespace
- Trailing whitespace
- Internal whitespace preservation
- Approved internal whitespace collapse
- Empty optional string
- Empty required string remains invalid
- Unicode preservation
- Approved code casing
- Display-name casing preservation

### Numeric policies

Cover:

- Approved integer string conversion
- Approved decimal string conversion
- Negative decimal conversion where valid
- Identifier containing digits remains a string
- Leading-zero code remains a string
- Empty string does not become zero
- `null` does not become zero
- `NaN` rejection
- Infinity rejection
- Locale-ambiguous decimal rejection
- Value containing a unit rejection

### Boolean policies

Cover:

- Existing boolean values
- Approved `"true"` conversion
- Approved `"false"` conversion
- Unsupported `"yes"` value
- Unsupported numeric boolean value
- False values are not removed

### Date policies

Cover:

- Date-only preservation
- Offset date-time conversion to UTC
- UTC date-time remains canonical
- Ambiguous timestamp without offset
- Impossible date
- Null optional date
- Independence from local timezone
- Idempotency

### GUID handling

Cover:

- Valid GUID preserved exactly according to policy
- Nested GUID preserved
- Relationship GUID preserved
- Invalid GUID not replaced
- Missing GUID not generated
- Business code not promoted to GUID

### Vessel normalisation

Cover:

- Vessel name trimming according to policy
- Identifier preservation
- Identifier leading-zero preservation
- Country-code casing
- Numeric vessel-length conversion
- MMSI remains a string
- Active-date format conversion
- No home-port inference
- No identifier inference
- Idempotency

### Gear normalisation

Cover:

- Gear code casing
- Category and characteristic preservation
- Relationship GUID preservation
- Approved numeric limit conversion
- Approved boolean conversion
- Length-band preservation
- `fixed` property preservation
- No mobile measurement projection
- No missing-reference repair
- Idempotency

### Port normalisation

Cover:

- Port code remains a string
- Leading-zero port code preserved
- Country-code casing
- Latitude numeric-string conversion
- Longitude numeric-string conversion
- Null coordinate preservation
- No coordinate inference
- No coordinate swapping
- No coordinate clamping
- Port without coordinates remains present
- Idempotency

### Species normalisation

Cover:

- FAO-code casing
- Scientific-name preservation
- Common-name preservation
- Local-name preservation
- Language-tag normalisation
- Official indicator conversion where approved
- No display-name resolution
- No name translation
- Duplicate official names remain present for validation
- Idempotency

### Map normalisation

Cover:

- Valid canonical FeatureCollection
- Numeric-string coordinate conversion
- WGS84 output
- Longitude-first ordering preservation
- Explicit supported CRS conversion where implemented
- Missing CRS not guessed
- Unsupported CRS failure
- Feature GUID preservation
- Statistical-area code normalisation
- Polygon ring policy
- Multipolygon preservation
- No simplification
- No self-intersection repair
- No `map-ports` upload normaliser
- Input coordinate arrays remain unchanged
- Idempotency

### Registry

Cover:

- Every maintained uploadable dataset has a registered normaliser
- Unsupported dataset cannot resolve a normaliser
- `map-ports` is marked as derived or non-uploadable
- Schema-version-specific selection where implemented
- Normalisers can be replaced with test doubles

### Result behaviour

Cover:

- `changed: false` for canonical input
- `changed: true` when a value changes
- Multiple warnings
- Deterministic warning order
- Warning de-duplication
- Warning-count limit if applicable
- Safe redaction
- Normalisation failure remains distinguishable from validation failure
- Input remains unchanged after success
- Input remains unchanged after failure

## Integration test requirements

Add Docker-free integration tests through the Data Normalisation Module's public application interface.

Verify:

1. A structurally valid legacy-compatible collection becomes canonical.
2. Structural validation rejects unusable input before normalisation.
3. Business validation runs against the normalised output.
4. A transformation warning is preserved through the orchestration boundary.
5. Ambiguous conversion fails safely.
6. The registry selects the correct dataset normaliser.
7. The input remains unchanged.
8. Normalisation performs no S3 or Floci calls.
9. Normalisation performs no Authentication Service calls.
10. Normalisation does not update the in-memory data store.
11. A second normalisation pass makes no additional changes.
12. Existing error mapping preserves normalisation and validation distinctions.
    Normal `npm test` must remain Docker-free.

Do not add these tests to `vitest.floci.config.js` unless a test genuinely requires Floci. This step should not require Floci.

## Test fixture requirements

Use small, deterministic fixtures.

Requirements:

- Use valid fixed GUIDs.
- Keep business identifiers separate from GUIDs.
- Include canonical and legacy-compatible variants.
- Avoid production data.
- Avoid personal data.
- Avoid copying large real map datasets into the repository.
- Use small valid polygon or multipolygon examples.
- Centralise repeated fixture construction according to repository conventions.
- Prevent one test from mutating fixtures used by another test.
- Make expected warnings explicit.
  Do not modify Step 06 Floci resources or add full seed collections as part of this step.

## Documentation requirements

Update the appropriate repository documentation with:

- Purpose of canonical normalisation
- Difference between parsing, structural validation, normalisation, and business validation
- Normalisation pipeline
- Result and warning contracts
- Common normalisation rules
- Dataset normaliser registry
- GUID preservation policy
- Business-identifier preservation policy
- String policy
- Numeric-conversion policy
- Boolean-conversion policy
- Date and time policy
- Null and omission policy
- Ordering policy
- Vessel rules
- Gear rules
- Port rules
- Species rules
- Map-location rules
- Legacy-to-canonical mappings
- Idempotency guarantee
- Immutability guarantee
- Warning codes
- Unsupported and ambiguous conversion behaviour
- Security considerations
- Performance considerations
- How to add a new dataset or schema-version normaliser
- How normalisation integrates with Step 08 validation
- Work deferred to subsequent steps
  Include concise before-and-after examples for each maintained dataset where useful.

Do not include conversational filler in repository documentation.

## Explicit exclusions

Do not implement:

- Hapi.js upload routes
- Multipart file parsing unless already implemented and required by an approved earlier step
- S3 reads or writes
- Floci calls
- Local bucket provisioning
- Full seed collection management
- Manifest persistence
- Atomic collection activation
- Rollback orchestration
- Cache refresh
- In-memory store updates
- Authentication Service integration
- Mobile response projections
- Search
- Pagination
- API response shaping
- Item-level mutation endpoints
- Redis
- Automatic GUID creation or replacement
- Identifier inference
- Translation of species names
- Port geocoding
- Geometry simplification
- Geometry topology repair
- Automatic source-CRS guessing
- Automatic coordinate-order guessing
- Silent correction of business-rule failures

## Required plan content

The implementation plan must include:

1. Current normalisation-related repository structure.
2. Completed previous-step outputs relevant to this work.
3. Existing canonical schemas and dataset types.
4. Existing validation pipeline and stage ordering.
5. Existing normalisation utilities or mappings.
6. Existing conventions to retain.
7. Gaps against this step.
8. Proposed common normalisation contract.
9. Proposed result, warning, and failure types.
10. Proposed module and file structure.
11. Proposed dataset-normaliser registry.
12. Proposed common collection rules.
13. Proposed string, numeric, boolean, date, null, and ordering policies.
14. Proposed vessel rules.
15. Proposed gear rules.
16. Proposed port rules.
17. Proposed species rules.
18. Proposed map-location rules.
19. Proposed legacy-to-canonical mappings.
20. Proposed ambiguous-conversion behaviour.
21. Proposed immutability approach.
22. Proposed idempotency approach.
23. Proposed warning limits and redaction policy.
24. Any new dependency and justification.
25. Exact files to create.
26. Exact files to modify.
27. Files intentionally left unchanged.
28. Unit-test approach.
29. Integration-test approach.
30. Documentation updates.
31. Security and privacy considerations.
32. Performance considerations.
33. Verification commands.
34. Assumptions and unresolved ambiguities.
35. Work explicitly deferred to later steps.

## Expected deliverables

- Approved plan saved as: Plain Text 1 github-prompts/Step 10-implement-canonical-data-normalisation-plan.md
- Common canonical normalisation contracts.
- Normalisation result and warning model.
- Common collection-envelope normaliser.
- Reusable string normalisation policies.
- Reusable numeric conversion policies.
- Reusable boolean conversion policies where approved.
- Reusable date and date-time policies.
- Explicit null and omission policies.
- Dataset-normaliser registry.
- Vessel normaliser.
- Gear normaliser.
- Port normaliser.
- Species normaliser.
- Map-land normaliser.
- Map-statistical-areas normaliser.
- Explicit non-uploadable handling for derived `map-ports` .
- Stable warning codes.
- Safe failure behaviour for ambiguous transformations.
- Immutability tests.
- Idempotency tests.
- Dataset-specific unit tests.
- Docker-free integration tests.
- Updated documentation.
- Completion report.

## Acceptance criteria

- Canonical normalisation is owned by the Data Normalisation Module.
- The implementation follows existing repository conventions.
- The approved plan is saved before implementation begins.
- Structurally invalid input is not silently normalised.
- Normalisation does not mutate input.
- Normalisation is idempotent.
- Warning ordering is deterministic.
- Valid supplied GUIDs are preserved.
- Invalid GUIDs are not replaced.
- Missing GUIDs are not generated.
- Business identifiers remain separate from GUIDs.
- Leading zeros in business identifiers are preserved.
- Common metadata is normalised only through approved deterministic rules.
- Display names and natural-language text are not globally uppercased or otherwise altered.
- Numeric strings are converted only through field-specific policies.
- Identifier strings are never treated as general numbers.
- Boolean strings are converted only through explicit mappings.
- Date-time values use the approved canonical representation.
- Ambiguous timestamps are not guessed.
- Required missing values remain validation failures.
- False values and numeric zero are not removed.
- Vessel legacy identifiers are preserved.
- No home port is inferred.
- Gear categories, characteristics, relationships, and length applicability are preserved.
- The meaning of legacy `fixed` is not reinterpreted.
- Port codes remain strings.
- Ports without coordinates remain valid canonical records.
- Coordinates are not swapped or clamped.
- Species common and local names remain multi-valued.
- Species names are not translated or flattened.
- Map output uses canonical GeoJSON.
- Map output uses WGS84 when a safe explicit conversion is supported.
- Longitude-first coordinate ordering is preserved.
- Source CRS and coordinate order are not guessed.
- Geometry is not simplified or topologically repaired.
- `map-ports` is not treated as an independently uploaded collection.
- Normalisation does not access S3 or Floci.
- Normalisation does not call the Authentication Service.
- Normalisation does not update the in-memory store.
- Normalisation does not create API responses.
- No Redis dependency is introduced.
- Normal tests remain Docker-free.
- Unit tests cover common and dataset-specific rules.
- Integration tests prove validation, normalisation, and business-validation stage ordering.
- Existing tests continue to pass.
- Type checking passes.
- Linting passes, or pre-existing failures are clearly distinguished.
- Persistence tests continue to pass.
- Documentation accurately describes implemented behaviour.
- Work outside this step remains deferred.

## Verification

Use the repository's actual package manager, module system, and scripts.

Run the applicable equivalents of:

Plain Text

```text
install dependencies
run type checking
run linting
run canonical normalisation unit tests
run normalisation integration tests
run the complete Docker-free unit test suite
run persistence tests to detect regressions
run the build
normalise an already canonical collection
verify changed is false
normalise a legacy-compatible collection
verify changed is true
verify deterministic warnings
normalise the result a second time
verify idempotency
verify input immutability
verify valid GUID preservation
verify invalid GUIDs are not replaced
verify business codes remain strings
verify leading zeros are preserved
verify vessel normalisation
verify gear normalisation
verify port normalisation
verify species normalisation
verify map-land normalisation
verify map-statistical-areas normalisation
verify map-ports is not uploadable
verify numeric-string conversion policies
verify boolean conversion policies
verify date-time conversion under TZ=UTC
verify ambiguous date-time failure
verify safe handling of null and omitted values
verify supported explicit CRS conversion if implemented
verify unsupported CRS failure
verify coordinates are not guessed or swapped
verify no S3 or Floci calls occur
verify no Authentication Service calls occur
verify no in-memory store update occurs
```

Record the exact commands and results in the completion report.

If a verification failure is caused by an existing issue outside this step:

1. Record the exact failing command.
2. Identify the likely pre-existing cause.
3. Explain whether the issue blocks Step 10.
4. Do not broaden the implementation scope silently.
5. Ask for clarification if resolving the issue would require an architectural or schema decision.

## Completion response

Provide a concise implementation report containing:

- Repository state discovered
- Approved normalisation approach
- Files created
- Files modified
- Existing files deliberately left unchanged
- Common normalisation rules implemented
- Dataset-specific rules implemented
- Legacy-to-canonical mappings implemented
- Warning codes introduced or reused
- Dependencies introduced, if any
- Tests added
- Verification commands and results
- Test coverage results
- Immutability verification
- Idempotency verification
- Security and privacy controls
- Performance safeguards
- Existing issues not introduced by this step
- Work deferred to subsequent steps
- Remaining assumptions, risks, or decisions requiring owner input
  if you reach any ambiguity ask me to clarify
