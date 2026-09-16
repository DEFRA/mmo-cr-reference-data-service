# Step 15: Implement the Common Collection Query Engine

## Recommended reasoning effort

- Planning phase: High
- Implementation phase: High
- Defra Sonar review: Medium

## Role

Act as a senior Node.js backend engineer implementing the Reference Data Service for the Catch Recording application.

Implement the common collection query engine exactly as defined by Step 15 of the approved Reference Data Service implementation plan.

Do not change, reorder, expand, reduce, or reinterpret the approved plan.

## Approved objective

Provide reusable logic for:

- Full collection retrieval
- Individual item retrieval
- Filtering
- Searching
- Sorting
- Pagination

## Approved dependencies

This step depends on:

- Step 05: Implement the In-Memory Data Store
- Step 11: Implement the Cache Refresh Module and startup hydration
- Step 12: Implement Authentication Service integration
- Step 13: Implement common API behaviour and error handling
  Before implementation, verify that these dependencies are complete.

Do not silently implement missing work belonging to another step.

## Mandatory ambiguity rule

If any ambiguity, inconsistency, missing contract, or conflict is discovered:

1. Stop the current planning or implementation activity.
2. Describe the exact ambiguity.
3. Identify the affected requirement, contract, or file.
4. Show the relevant existing implementation.
5. Present the smallest set of viable options.
6. Recommend one option with technical rationale.
7. Explain the impact of each option.
8. Ask me to clarify or approve the decision.
9. Wait for my response before proceeding.
   Do not resolve ambiguity through an undocumented assumption.

In particular, ask for clarification if the existing approved design does not define:

- Exact versus partial text matching
- Case-sensitive versus case-insensitive matching
- AND versus OR semantics between filters
- Sort-field syntax
- Sort direction syntax
- Default sort order
- Whether pagination applies to full collection retrieval
- Whether full collection retrieval is selected by the absence of search parameters
- Behaviour for empty query-string values
- Behaviour for duplicate IDs or codes in a request
- Maximum number of IDs or codes accepted
- Active-state semantics for every dataset
- Whether GeoJSON collections use the same item query engine
- Whether derived `map-ports` is supported by the initial common engine
- Whether unknown dataset-specific filters are rejected or ignored
- Whether free-text matching includes business codes
- Whether search values are trimmed or normalised
- How canonical and mobile projections are selected
- How ETags differ between canonical and mobile responses
  Do not guess these behaviours.

## Required working mode

Start in Plan mode.

Before proposing changes:

1. Inspect the complete repository.
2. Read the approved Reference Data Service implementation plan.
3. Read the approved prompts and saved plans for Steps 01 through 14.
4. Inspect the implementation completed through Step 14.
5. Inspect the Query Module boundary established in Step 02.
6. Inspect the shared query contracts created in Step 03.
7. Inspect:

- Dataset identifiers
- Dataset capabilities
- Representation identifiers
- Collection envelopes
- Collection metadata
- Manifest contracts
- Query request contract
- Query result contract
- Pagination contract
- Sorting contract
- Service-error contract

8. Inspect the canonical schemas created in Step 04.
9. Inspect the In-Memory Data Store contract and implementation from Step 05.
10. Inspect the Cache Refresh Module and startup hydration from Step 11.
11. Inspect authentication and authorisation integration from Step 12.
12. Inspect common API, error, ETag, cache-header, and correlation utilities from Step 13.
13. Inspect the manifest query and route implementation from Step 14.
14. Inspect existing repository conventions for:

- Query services
- Factory functions
- Dependency injection
- Immutable data handling
- Request parsing
- Error mapping
- Unit tests
- Hapi injection tests

15. Inspect the current working tree:
    Shell

```text
git status --short
git diff --stat
```

1. Determine whether any query-engine behaviour has already been implemented.
2. Avoid duplicating or replacing suitable existing behaviour.
3. Identify every ambiguity before completing the plan.
   Do not modify source files during planning.

Produce a concise, file-by-file implementation plan and wait for approval.

After the plan is approved, the first implementation action must be to save the approved plan as:

Plain Text

```text
github-prompts/Step 15-implement-common-collection-query-engine-plan.md
```

Only after saving the approved plan may source-code implementation begin.

## Approved scope

Implement support for:

- Full collection retrieval
- Retrieval by GUID
- Exact business-code matching
- Multiple GUID selection
- Multiple business-code selection
- Free-text query
- Dataset-specific filters
- Offset and limit
- Maximum result limits
- Dataset-supported sorting
- Active-state filtering
- Canonical and mobile views
  Define deterministic behaviour for:

- Missing query parameters
- Unsupported filters
- Invalid GUIDs
- Invalid limits
- Empty results
- Unknown resource IDs
- Querying a collection that is not loaded

## Approved deliverables

- Reusable query engine
- Query parser
- Pagination metadata
- Dataset query configuration
- Query tests

## Architecture context

The common query flow must preserve these boundaries:

Plain Text

```text
Reference Data Controller
  -> Validation Module
  -> Query Module
  -> Common Collection Query Engine
  -> In-Memory Data Store
```

Where a mobile view is requested:

Plain Text

```text
Common Collection Query Engine
  -> Canonical-to-Mobile Projector
```

The Query Module:

- Retrieves data through the In-Memory Data Store contract.
- Does not access S3 or Floci.
- Does not call the Authentication Service directly.
- Does not mutate active collections.
- Does not implement dataset-specific mobile projection logic.
- Does not persist query results.

## Mandatory architecture constraints

### No direct persistence access

The query engine must not:

- Import the AWS SDK.
- Access S3.
- Access Floci.
- Call the Persistence Module.
- Read JSON files from disk.
- Load canonical fixtures at runtime.
  All active query data must come through the In-Memory Data Store contract.

### No direct Authentication Service access

The query engine must not:

- Forward bearer tokens.
- Call the Authentication Service.
- Decode tokens.
- Evaluate external roles or permissions directly.
  Authentication and read authorisation are owned by the Validation Module.

### No database

Do not introduce:

- MongoDB
- Redis
- DynamoDB
- SQL persistence
- An ORM or ODM
- Database indexes
- Database queries
- Query builders
- Database repositories
- Database connections
  All search and filtering operate on the process-local canonical JSON collections.

### No data mutation

Query operations must not mutate:

- Stored collections
- Stored items
- Nested objects
- Nested arrays
- Collection metadata
- Query input
- Dataset configuration
- Projection context
  Sorting must operate on a safe copy or equivalent non-mutating representation.

### No dataset endpoint implementation

This step implements the reusable query engine and its supporting configuration mechanism.

Do not implement:

- Vessel routes
- Gear routes
- Port routes
- Species routes
- Map routes
  Those belong to Steps 16 through 20.

A minimal internal test route or Hapi integration harness may be used only if required by established repository testing conventions. Do not expose a new production dataset endpoint.

## Query-engine design

Implement a reusable query engine that receives:

- Dataset identifier
- Query request
- Dataset query configuration
- In-Memory Data Store dependency
- Optional canonical-to-mobile projector
- Optional projection context
  The engine should return the existing Step 03 query-result contract.

Do not create a second incompatible query response model.

The query engine must remain independent from:

- Hapi request objects
- Hapi response toolkit
- AWS SDK types
- S3 object keys
- Authentication Service responses
- Database query syntax

## Dataset query configuration

Implement an extensible dataset query configuration mechanism.

Each dataset configuration must be able to define, where applicable:

- Dataset identifier
- Item collection accessor
- Resource GUID field
- Business-code fields
- General text-search fields
- Exact-match filters
- Dataset-specific filters
- Approved sortable fields
- Default sort
- Active-state field or resolver
- Mobile projector
- Projection-context handling
- Whether the dataset is JSON or GeoJSON
  Do not implement the full vessel, gear, port, species, or map-specific configurations that belong to Steps 16 through 20.

Provide only the base configuration contract, validation, and focused representative test configuration needed to prove the engine.

Do not create switch statements that require central query-engine modification for every new dataset when a configuration mechanism can express the behaviour.

Do not duplicate the Step 03 dataset registry.

## Full collection retrieval

Support retrieval of the complete active collection when no search, filter, identifier selection, pagination, or sorting request makes the operation a search.

The implementation must preserve the approved distinction between:

- Complete collection retrieval
- Filtered search retrieval
  Requirements:

- Retrieve the active collection from the In-Memory Data Store.
- Preserve the active collection metadata.
- Return the approved collection or query-result shape.
- Do not apply a default search limit accidentally to an explicit full collection request.
- Do not mutate the stored collection.
- Apply the requested canonical or mobile view.
- Return an approved unavailable error if the collection is not loaded.
  If the existing contracts do not define the exact full-collection response envelope, stop and ask for clarification.

## Retrieval by GUID

Support individual item retrieval by GUID through the reusable query engine.

Requirements:

- Use the centrally approved GUID field.
- Validate GUID syntax using existing validation utilities.
- Use exact GUID equality.
- Do not treat a business code as a GUID.
- Return the approved not-found service error when no item matches.
- Apply canonical or mobile projection as requested.
- Do not mutate the selected item.
- Preserve collection metadata needed by the caller.
  Do not implement HTTP route parameters in this step.

Provide an internal query operation that later endpoint steps can invoke.

## Multiple GUID selection

Support selecting multiple records with a collection of GUID values.

Requirements:

- Validate every supplied GUID.
- Apply the approved duplicate-input behaviour.
- Use deterministic result ordering.
- Respect approved limits on the number of supplied IDs.
- Do not treat missing IDs as an individual item `404` unless the approved contract requires that behaviour.
- Distinguish an empty result from an invalid request.
- Preserve canonical GUIDs in returned records.
  If missing IDs within a multi-ID request require partial results or an error and this is not already defined, ask for clarification.

## Business-code matching

Support exact business-code matching through dataset configuration.

Business codes include dataset-specific identifiers such as:

- CFR
- Gear code
- Port code
- FAO species code
- Statistical-area code
  Requirements:

- Use the configured canonical field path.
- Keep business codes separate from GUIDs.
- Do not allow business codes in GUID-only operations.
- Apply the approved case-sensitivity rule.
- Apply exact matching for explicit code filters.
- Avoid changing or normalising stored code values.
- Return deterministic results.
  Do not hard-code dataset business-code paths into the common query engine.

## Multiple business-code selection

Support selecting records using multiple business codes.

Requirements:

- Parse inputs using the common query parser.
- Reject malformed or excessive input according to approved limits.
- Use deterministic result ordering.
- Apply the approved duplicate-input behaviour.
- Apply exact code matching.
- Do not treat unmatched codes as GUID not-found conditions.
- Do not mutate the supplied code list.
  If multiple query-string encodings are possible, preserve the convention approved by Step 13 or existing API design.

## Free-text query

Implement reusable free-text matching over approved fields supplied by dataset configuration.

Requirements:

- Search only configured fields.
- Safely handle optional or nullable fields.
- Safely handle nested field paths.
- Do not search complete serialised objects.
- Do not search internal metadata.
- Do not search unapproved sensitive fields.
- Do not use dynamic evaluation.
- Do not construct unsafe regular expressions from caller input.
- Preserve deterministic results.
- Avoid mutating input or records.
  Use plain string matching according to the approved matching semantics.

Do not implement:

- Fuzzy search
- Phonetic search
- Relevance ranking
- External full-text search
- Database indexing
- Locale-specific collation
  unless an approved requirement already exists.

## Dataset-specific filters

Provide an extension mechanism for filters defined by later dataset steps.

A dataset-specific filter must:

- Have a centrally configured query parameter or internal filter name.
- Validate its input through an approved parser.
- Apply a pure predicate or equivalent operation.
- Avoid side effects.
- Avoid external calls.
- Avoid mutation.
- Return deterministic results.
- Be testable independently.
  The common engine must reject unsupported filters rather than silently ignoring them, unless the approved API design explicitly says otherwise.

Do not implement vessel-, gear-, port-, species-, or map-specific business filters in this step.

## Active-state filtering

Support a common active-state filter where the dataset configuration defines active-state behaviour.

The query engine must support the approved `includeInactive` option.

Requirements:

- Default to the approved active-only or all-items behaviour.
- Parse booleans strictly.
- Reject invalid boolean strings.
- Do not use JavaScript truthiness for query values.
- Allow dataset configuration to resolve activity from an approved field or function.
- Do not infer activity from unrelated fields.
- Do not modify active-state values.
  If the default active-state behaviour is not established in Step 15 contracts or API design, stop and ask for clarification.

## Pagination

Support:

- `offset`
- `limit`
  Requirements:

- Use validated non-negative integer offset.
- Use validated positive integer limit.
- Apply the approved default search limit.
- Apply the approved maximum result limit.
- Reject values above the maximum rather than silently allocating excessive memory, unless the approved design explicitly requires capping.
- Calculate total count before pagination.
- Return pagination metadata.
- Apply pagination after filtering and sorting.
- Do not apply search pagination accidentally to full collection retrieval when the approved full-collection mode is selected.
- Avoid magic numbers by using central configuration or named constants.
  Pagination metadata should support:

- Total matching records
- Offset
- Limit
- Number of returned records where required
  Use the existing Step 03 query-result contract.

Do not invent cursor-based pagination.

## Sorting

Support dataset-approved sorting.

Requirements:

- Sort only approved fields.
- Reject unsupported sort fields.
- Support the approved direction syntax.
- Use deterministic tie-breaking.
- Avoid mutating the active collection.
- Handle nullable values consistently.
- Avoid locale-dependent behaviour unless explicitly approved.
- Apply sorting after filtering and before pagination.
- Avoid arbitrary nested-property execution.
- Use safe configured accessors.
  Do not allow caller-supplied JavaScript property expressions or functions.

If default sorting or null ordering is unresolved, ask for clarification.

## Canonical and mobile views

Support the centrally defined representations:

Plain Text

```text
canonical
mobile
```

Requirements:

- Default to the representation approved by the API design.
- Reject unsupported representation values.
- Return canonical data without destructive transformation.
- Apply the dataset projector through the Step 03 projector contract for mobile responses.
- Do not persist mobile projections.
- Preserve GUID resource identifiers.
- Do not mutate canonical items.
- Pass only approved projection context.
- Fail deterministically when a mobile view is requested but no projector is available.
  Do not implement dataset-specific projectors in Step 15.

Use a focused test projector to verify the engine integration.

## Query parser

Implement a transport-independent query parser or normaliser for the shared query parameters.

Support approved common values such as:

Plain Text

```text
query
code
ids
codes
offset
limit
sort
includeInactive
view
```

Use the actual parameter names approved by the API design and existing implementation.

Requirements:

- Do not depend on the full Hapi request object.
- Accept a plain query input object or approved internal request contract.
- Parse strict integer and boolean values.
- Distinguish missing values from empty values.
- Reject malformed comma-separated lists or other approved encodings.
- Trim query parameter syntax only where approved.
- Preserve business data values.
- Return the Step 03 internal query-request shape.
- Avoid partial parsing where invalid trailing characters would be ignored.
  Do not use permissive JavaScript conversions such as:

JavaScript

```text
Boolean(value)
parseInt(value)
```

without strict validation of the complete input.

## Query result

Return the Step 03 query-result structure.

The result must be able to represent:

- Dataset
- Collection GUID
- Collection version
- Representation
- Total matching records
- Offset
- Limit
- Returned items
- Optional query context
  Do not expose:

- Mutable internal store references
- Authentication tokens
- Authentication responses
- S3 object keys
- AWS metadata not approved by the API
- Internal stack traces

## Missing and invalid state behaviour

Define deterministic behaviour for:

### Unsupported dataset

Return the existing approved invalid-dataset error.

### Supported but unloaded dataset

Return the existing approved reference-data-unavailable or dataset-unavailable error.

Do not return an empty successful collection for an unloaded dataset.

### Empty loaded collection

Return a successful empty result.

Do not confuse an empty loaded collection with an unloaded collection.

### Invalid GUID

Return the existing approved request-validation error.

### Unknown GUID

Return the existing approved reference-item-not-found error.

### Invalid filter

Return the existing approved invalid-request or invalid-search-parameter error.

### Invalid pagination

Return the existing approved invalid-request error with precise property details.

### Unsupported sort field

Return the existing approved invalid-request error.

### Unsupported representation

Return the existing approved invalid-request error.

Do not implement final HTTP status mapping in the query engine. Step 13 owns HTTP mapping.

## Immutability

Every query operation must preserve active in-memory state.

Add explicit tests proving:

- Free-text search does not mutate source items.
- Filtering does not mutate source items.
- Sorting does not reorder the stored collection.
- Pagination does not mutate the stored collection.
- Mobile projection does not mutate canonical items.
- Query parsing does not mutate raw input.
- Returned results cannot mutate later store reads where the store contract promises defensive access.
  Do not rely solely on shallow equality tests.

Use nested data in immutability tests.

## Performance requirements

The query engine operates on process-local collections.

Implement clear and proportionate algorithms.

Requirements:

- Avoid repeated serialisation of entire records.
- Avoid compiling unsafe regular expressions per item.
- Avoid unnecessary deep clones during every individual pipeline stage.
- Avoid multiple full scans where one composed scan is sufficient and remains readable.
- Apply offset and limit only after determining the correct total and order.
- Keep logic understandable and testable.
- Do not introduce speculative indexing before dataset scale and access patterns require it.
- Do not add a database or external search engine.
  If collection size makes the approved in-memory approach questionable, document the concern and ask for clarification rather than changing the architecture.

## Dataset configuration validation

Validate query configuration when it is created or registered.

Detect:

- Missing dataset
- Unsupported dataset
- Missing item accessor
- Missing GUID accessor
- Duplicate filter names
- Unsupported sort configuration
- Invalid projector
- Invalid active-state resolver
- Conflicting common and dataset-specific parameter names
  Do not repeatedly revalidate immutable configuration on every query if it can be safely validated at construction.

Do not make network calls during configuration registration.

## Error handling

Use the existing Step 03 service-error model and Step 13 error categories.

Do not create another error class.

Errors must:

- Use stable codes.
- Use safe messages.
- Include structured field details where approved.
- Include the dataset where relevant.
- Preserve correlation information where supplied.
- Exclude full collection contents.
- Exclude internal source records.
- Exclude tokens and credentials.
- Exclude S3 and Floci details.
- Exclude stack traces from public-safe serialisation.

## Expected implementation shape

Adapt to the existing repository structure.

A possible organisation is:

Plain Text

```text
src/
  query/
    collection-query-engine.js
    query-parser.js
    query-pipeline.js
    query-configuration.js
    pagination.js
    sorting.js
    field-accessor.js
    collection-query-engine.test.js
```

Do not force this structure if Step 02 or subsequent implementations established a coherent alternative.

Prefer focused modules over one large query-engine file.

Avoid unnecessary abstraction layers.

## Required unit tests

Testing is part of Step 15 and must be completed during this step.

### Query parser tests

Verify:

1. Missing query values produce the approved defaults.
2. Free-text query parses correctly.
3. One business code parses correctly.
4. Multiple GUIDs parse correctly.
5. Invalid GUIDs are rejected.
6. Multiple business codes parse correctly.
7. Offset parses as a non-negative integer.
8. Negative offset is rejected.
9. Partial numeric offset is rejected.
10. Limit parses as a positive integer.
11. Zero limit is rejected.
12. Negative limit is rejected.
13. Limit above the configured maximum is handled as approved.
14. `includeInactive=true` parses to `true` .
15. `includeInactive=false` parses to `false` .
16. Invalid boolean values are rejected.
17. Canonical view parses correctly.
18. Mobile view parses correctly.
19. Unsupported views are rejected.
20. Unsupported common query parameters are handled as approved.
21. Input is not mutated.

### Full collection tests

Verify:

1. A loaded collection can be retrieved.
2. An empty loaded collection returns success.
3. An unloaded collection returns the approved unavailable error.
4. An unsupported dataset is rejected.
5. Full retrieval does not apply an unintended search limit.
6. Canonical data is preserved.
7. Collection metadata is represented correctly.
8. Stored collection order and content are not mutated.

### GUID retrieval tests

Verify:

1. Existing GUID returns one item.
2. Unknown valid GUID returns the approved not-found error.
3. Invalid GUID returns the approved request error.
4. Business code is not accepted as GUID.
5. Canonical view is supported.
6. Mobile view uses the configured projector.
7. Source data is not mutated.

### Multiple GUID tests

Verify:

1. Multiple existing GUIDs return the approved records.
2. Result order is deterministic.
3. Duplicate input GUIDs follow approved behaviour.
4. Invalid GUID in the list is rejected.
5. Unknown GUIDs follow approved partial-result or error behaviour.
6. Empty list follows approved request behaviour.
7. Input arrays are not mutated.

### Business-code tests

Verify:

1. Exact configured code returns matching items.
2. Unmatched code returns an empty search result.
3. Business code is not treated as GUID.
4. Multiple codes return matching items.
5. Duplicate input codes follow approved behaviour.
6. Matching uses approved casing semantics.
7. Unconfigured code filtering is rejected.
8. Source data is not mutated.

### Free-text tests

Verify:

1. Matching configured text field returns a record.
2. Matching a configured nested field works.
3. Unconfigured fields are not searched.
4. Null or missing optional fields are safe.
5. No-match query returns an empty result.
6. Matching obeys approved case semantics.
7. Matching obeys approved partial or exact semantics.
8. Query strings are not converted into executable regular expressions.
9. Result order is deterministic.
10. Input and source data are not mutated.

### Dataset-specific filter extension tests

Verify:

1. A registered custom filter is invoked.
2. Unsupported filters are handled as approved.
3. Filter input is validated.
4. Multiple filters follow approved AND or OR semantics.
5. Custom filter cannot mutate source data.
6. One dataset’s filter is not available to another dataset.
7. Filter execution performs no external calls.

### Active-state tests

Verify:

1. Default active-state behaviour is applied.
2. `includeInactive=false` uses approved filtering.
3. `includeInactive=true` includes approved inactive records.
4. Invalid boolean values are rejected.
5. Dataset-specific active-state accessors are supported.
6. Missing active-state data follows approved behaviour.
7. Source data is not mutated.

### Pagination tests

Verify:

1. Default search limit is applied.
2. Configured limit is applied.
3. Maximum limit is enforced.
4. Offset is applied after filtering and sorting.
5. Total count is calculated before pagination.
6. Returned count is correct.
7. Offset beyond result count returns an empty page.
8. Full collection retrieval is not accidentally truncated.
9. Pagination does not mutate source data.

### Sorting tests

Verify:

1. An approved field sorts ascending.
2. An approved field sorts descending.
3. Unsupported fields are rejected.
4. Default sort is deterministic.
5. Tie-breaking is deterministic.
6. Nullable values follow approved ordering.
7. Nested approved fields can be sorted safely if supported.
8. Sorting occurs before pagination.
9. Sorting does not mutate the active collection.
10. Caller-supplied executable expressions are rejected.

### Representation tests

Verify:

1. Canonical is accepted.
2. Mobile is accepted.
3. Unsupported representation is rejected.
4. Canonical results preserve original approved fields.
5. Mobile results use the registered projector.
6. Mobile projection preserves GUIDs.
7. Missing mobile projector fails deterministically.
8. Projection context is passed correctly.
9. Projector input is not mutated.
10. Projected responses are not persisted.

### Result-contract tests

Verify:

1. Dataset is included.
2. Collection GUID is included.
3. Collection version is included.
4. Representation is included.
5. Total count is included.
6. Offset is included where applicable.
7. Limit is included where applicable.
8. Items contain only the expected query results.
9. Internal store details are not exposed.
10. The result conforms to the Step 03 query contract.

### Error tests

Verify:

1. Unsupported dataset maps to the correct service error.
2. Unloaded dataset maps to the correct service error.
3. Invalid GUID maps to the correct service error.
4. Unknown GUID maps to the correct service error.
5. Invalid query maps to the correct service error.
6. Invalid pagination maps to the correct service error.
7. Unsupported sort maps to the correct service error.
8. Unsupported representation maps to the correct service error.
9. Correlation information is preserved.
10. Errors do not expose source collection data.
11. Errors do not expose stack traces publicly.

### Architecture-boundary tests

Verify:

1. The Query Module does not import the AWS SDK.
2. The Query Module does not import the concrete Persistence Module.
3. The Query Module does not import the concrete Authentication Service client.
4. The query engine depends on the In-Memory Data Store contract.
5. The query engine does not implement Hapi routes.
6. No database or Redis dependency is introduced.
7. Dataset-specific endpoints from Steps 16 through 20 are not added.

## Integration tests

Add focused integration tests between:

- Query Module
- Common query engine
- In-Memory Data Store contract or real in-memory implementation
- Projector test double
- Existing service-error contracts
  Verify:

1. A hydrated in-memory collection can be queried.
2. An unloaded collection fails correctly.
3. Query results reflect the current active collection.
4. Replacing the active collection changes subsequent query results.
5. Querying does not access persistence.
6. Canonical and mobile views use the same canonical source collection.
7. Authentication Service is not called by the Query Module.
8. Query operations remain deterministic.
   Do not add public vessel, gear, port, species, or map routes.

## Regression testing

Run:

- Query parser tests.
- Query engine tests.
- Query configuration tests.
- Pagination tests.
- Sorting tests.
- Representation tests.
- Query Module integration tests.
- In-Memory Data Store tests.
- Step 13 common API tests where relevant.
- Step 14 manifest tests to ensure no regression.
- The complete repository test suite.
- Test coverage.
- Linting.
- Formatting checks.
  Do not defer Step 15 testing to Step 26 or Step 28.

## Defra SonarCloud review

After implementation and tests pass, analyse all source and test code created or modified by Step 15 against the configured Defra SonarCloud rules.

Use the project’s existing SonarCloud configuration and:

Plain Text

```text
https://sonarcloud.io/organizations/defra/rules
```

Review for:

- Magic numbers
- Hardcoded query limits
- Duplicate literals
- Excessive cognitive complexity
- Duplicate filtering logic
- Deeply nested conditionals
- Unsafe dynamic property access
- Unescaped regular expressions
- Input mutation
- Sorting mutation
- Unhandled promises
- Broad catch blocks
- Dead code
- Unused exports
- Weak assertions
- Non-deterministic tests
- Sensitive-data exposure
- Prototype-pollution risks
- Unsafe object-key traversal
- Incorrect null handling
- Partial numeric parsing
- Permissive boolean parsing
- Inefficient repeated serialisation
- Incorrect pagination totals
- Incorrect sort ordering
- Business codes used as GUIDs
- Direct persistence access
  Do not resolve findings by:

- Disabling Sonar rules globally
- Adding broad suppressions
- Excluding query-engine files
- Weakening tests
- Removing assertions
- Changing approved query behaviour silently
  For each finding introduced by Step 15:

1. Record the rule identifier.
2. Identify the file and line.
3. Explain the issue.
4. Apply the smallest scope-safe fix.
5. Rerun focused tests.
6. Rerun linting and formatting.
7. Rerun available Sonar analysis.
   If a finding requires changing an approved contract or behaviour, stop and ask for clarification.

If SonarCloud runs only in CI, state clearly that final verification remains pending CI.

## Documentation requirements

Add or update focused documentation covering:

- Query-engine responsibility
- Full collection retrieval
- Individual GUID retrieval
- Business-code matching
- Multiple GUID and code selection
- Free-text search
- Dataset-specific filter extension
- Active-state handling
- Pagination
- Sorting
- Canonical and mobile views
- Query-result metadata
- Error behaviour
- Immutability guarantees
- Architecture boundaries
- How later dataset steps register configuration and projectors
  Do not duplicate the full API design.

Do not document dataset-specific endpoint parameters before the corresponding steps implement them.

## Security and privacy considerations

- Use bounded query limits.
- Reject malformed pagination values.
- Reject unsupported sort fields.
- Avoid unsafe regular expressions.
- Avoid dynamic code evaluation.
- Avoid unrestricted caller-controlled property paths.
- Do not expose store internals.
- Do not expose S3 metadata.
- Do not log complete collections or query results.
- Do not include bearer tokens in query context.
- Preserve correlation identifiers safely.
- Use synthetic data in tests.
- Prevent source collection mutation.
- Avoid expensive uncontrolled searches.
- Validate identifiers before querying.
- Fail safely when data is unavailable.

## In scope

- Common query-engine implementation
- Query parser
- Full collection retrieval
- GUID retrieval
- Multiple GUID selection
- Exact business-code matching
- Multiple code selection
- Free-text query
- Dataset-filter extension mechanism
- Active-state filtering
- Offset and limit
- Maximum result limits
- Approved sorting
- Canonical and mobile view integration
- Query-result metadata
- Dataset query configuration mechanism
- Query Module integration
- Unit tests
- Focused integration tests
- Architecture-boundary tests
- Defra Sonar review
- Focused documentation

## Out of scope

Do not implement:

- Changes to the approved plan
- New canonical schemas
- Validation redesign
- Normalisation changes
- In-Memory Data Store redesign
- Cache refresh changes
- Persistence changes
- Direct S3 or Floci access
- Authentication Service changes
- Direct token handling
- Vessel endpoints
- Gear endpoints
- Port endpoints
- Species endpoints
- Map endpoints
- Dataset-specific projectors
- Radius search
- Bounding-box search
- Species name resolution
- Gear applicability projection
- Upload endpoints
- Collection replacement
- Seed data
- Database functionality
- Redis
- OpenAPI completion
- Step 25 metrics and audit events
- Deployment infrastructure

## Expected deliverables

The approved Step 15 deliverables are:

1. Reusable query engine.
2. Query parser.
3. Pagination metadata.
4. Dataset query configuration.
5. Query tests.
   Also produce:

6. Approved plan saved as:
   Plain Text

```text
github-prompts/Step 15-implement-common-collection-query-engine-plan.md
```

1. Query Module integration.
2. Architecture-boundary tests.
3. Focused query-engine documentation.
4. Defra SonarCloud review result for Step 15 changes.

## Approved completion criteria

The step must satisfy the approved plan criteria:

- Full collection requests remain distinct from searches.
- Searches return deterministic results.
- GUID lookup does not treat business codes as IDs.
- Maximum limits are enforced.
- Queries read from the In-Memory Data Store.
- The Query Module does not access S3 directly.
  The implementation must also demonstrate:

- Query input is parsed strictly.
- Pagination totals are calculated correctly.
- Sorting does not mutate source data.
- Canonical and mobile views use the same canonical source.
- Dataset-specific filters can be registered without redesigning the engine.
- Unloaded collections return a defined error rather than an empty success.
- Empty loaded collections return a valid empty result.
- Unsupported query behaviour is rejected deterministically.
- No dataset-specific production endpoint is implemented.
- Unit and focused integration tests pass.
- Step 15 code has been reviewed against Defra SonarCloud rules.

## Verification

Inspect `package.json` and use the repository’s actual scripts.

Run the applicable equivalents of:

Shell

```text
npm test -- <query-parser-tests>
npm test -- <query-engine-tests>
npm test -- <query-module-integration-tests>
npm test -- <architecture-boundary-tests>
npm test
npm run test:coverage
npm run lint
npm run format:check
```

Run the repository’s Sonar or static-analysis command if one exists.

Format every source, test, fixture, and documentation file created or modified by Step 15.

If the repository-wide formatting check reports unrelated generated artifacts:

1. Confirm every file changed by Step 15 passes Prettier.
2. Do not reformat unrelated generated conversation or metadata files.
3. Report remaining warnings accurately.
4. Do not claim that the repository-wide command passed if it failed.
   If a pre-existing failure occurs:

5. Record the exact command.
6. Record the relevant output.
7. Determine whether Step 15 caused it.
8. Fix failures introduced by Step 15.
9. Do not broaden scope silently.
10. Ask for clarification if resolution requires unrelated changes.
    No real S3, Floci, Authentication Service, database, or Redis integration is required for Step 15 query-engine tests.

## Final response requirements

After implementation, report:

1. Summary of completed work.
2. Saved Step 15 plan path.
3. Files created.
4. Files modified.
5. Query-engine design.
6. Query parser behaviour.
7. Full collection behaviour.
8. GUID retrieval behaviour.
9. Multiple GUID behaviour.
10. Business-code matching behaviour.
11. Multiple business-code behaviour.
12. Free-text search behaviour.
13. Dataset-specific filter mechanism.
14. Active-state behaviour.
15. Pagination behaviour.
16. Sorting behaviour.
17. Canonical and mobile view behaviour.
18. Query-result metadata.
19. Error behaviour.
20. Immutability approach.
21. Unit tests and results.
22. Integration tests and results.
23. Architecture-boundary results.
24. Complete test-suite result.
25. Coverage result.
26. Lint result.
27. Formatting result.
28. Defra SonarCloud analysis method.
29. Sonar findings introduced by Step 15.
30. Sonar fixes applied.
31. Whether final SonarCloud CI verification is pending.
32. Confirmation that the Query Module does not access S3.
33. Confirmation that GUIDs and business codes remain separate.
34. Confirmation that no database or Redis was introduced.
35. Confirmation that no dataset-specific production endpoints were implemented.
36. Work deferred to Steps 16 through 20.
37. Remaining ambiguities, risks, or owner decisions.
    Do not modify the approved implementation plan.

If you reach any ambiguity, ask me to clarify.
