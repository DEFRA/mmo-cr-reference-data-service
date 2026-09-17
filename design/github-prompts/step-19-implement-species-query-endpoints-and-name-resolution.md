# Step 19: Implement Species Query Endpoints and Name Resolution

## Recommended reasoning effort

- Planning phase: High
- Implementation phase: High
- Defra Sonar review: Medium

## Role

Act as a senior Node.js backend engineer implementing the Reference Data Service for the Catch Recording application.

Implement species query endpoints and name resolution exactly as defined by Step 19 of the approved Reference Data Service implementation plan.

Do not change, reorder, expand, reduce, or reinterpret the approved plan.

## Approved objective

Expose complete species naming structures and resolve the correct mobile display name.

## Approved dependency

This step depends on:

- Step 15: Implement the common collection query engine
  Before implementation, verify that Step 15 and all dependencies required by Step 15 are complete.

Inspect the existing implementations from Steps 16, 17, and 18 for reusable endpoint, query-configuration, projection, route-registration, testing, error-handling, authentication, and ETag conventions.

Do not modify those completed implementations unless Step 19 introduces a regression that requires a narrowly scoped correction.

Do not silently implement missing work belonging to another step.

## Mandatory ambiguity rule

If any ambiguity, conflict, missing contract, missing field definition, or inconsistency is discovered:

1. Stop the current planning or implementation activity.
2. Describe the exact ambiguity.
3. Identify the affected file, schema, contract, API requirement, or earlier implementation step.
4. Show the relevant existing implementation.
5. Present the smallest set of viable options.
6. Recommend one option with technical rationale.
7. Explain the impact of each option.
8. Ask me to clarify or approve the decision.
9. Wait for my response before proceeding.
   Do not resolve ambiguity by making an assumption.

In particular, stop and ask for clarification if the approved design or current implementation does not define:

- Exact species query parameter names.
- Exact versus partial FAO-code matching.
- Case-sensitive versus case-insensitive matching.
- Whether scientific-name matching is exact or partial.
- Whether general text search includes all common and local names.
- Whether general text search includes scientific names and FAO codes.
- How country code is supplied for mobile name resolution.
- Whether country code comes from a query parameter, request context, or another source.
- Whether `Accept-Language` may contain multiple language ranges.
- Whether `Accept-Language` quality weights must be honoured.
- Whether regional language fallback is supported, such as `en-GB` to `en` .
- Whether language matching is case-sensitive.
- Whether country matching is case-sensitive.
- What happens when more than one name satisfies the same precedence level.
- Whether inactive nested names are possible.
- Whether common names or local names contain status fields.
- Whether an empty or malformed `Accept-Language` header is ignored or rejected.
- Whether the default language is `en-GB` .
- Whether mobile output includes both `displayName` and scientific name.
- Whether missing optional mobile fields are omitted or returned as `null` .
- Whether canonical and mobile representations use different ETags.
- Whether a search result uses the requested language for every projected item.
- Whether explicit language query parameters override `Accept-Language` .
- Whether country-specific common names require an exact country match only.
- Whether FAO code is returned when scientific name and all names are absent.
- Whether nested-name ordering is authoritative or merely source order.
  Do not invent these behaviours.

## Required working mode

Start in Plan mode.

Before proposing changes:

1. Inspect the complete repository.
2. Read the approved Reference Data Service implementation plan.
3. Read the approved prompts and saved implementation plans for Steps 01 through 18.
4. Inspect the implementation completed through Step 18.
5. Inspect the species canonical schema and valid fixtures created in Step 04.
6. Inspect species validation implemented in Step 09.
7. Inspect canonical species normalisation implemented in Step 10.
8. Inspect the In-Memory Data Store implementation.
9. Inspect Authentication Service integration from Step 12.
10. Inspect common API behaviour and error handling from Step 13.
11. Inspect the manifest API from Step 14.
12. Inspect the common collection query engine from Step 15.
13. Inspect endpoint, controller, projection, query-configuration, response, testing, and route-registration conventions established in Steps 16 through 18.
14. Inspect the canonical-to-mobile projector contract created in Step 03.
15. Inspect dataset capabilities and confirm that `species` is:

- Queryable
- Uploadable
- Persisted
- Canonical JSON rather than GeoJSON

16. Inspect existing language, country-code, BCP 47, and `Accept-Language` utilities.
17. Inspect existing request-validation, response-validation, correlation, ETag, cache-header, and error-mapping utilities.
18. Inspect current species fixtures, including common names and local names.
19. Inspect current testing and SonarCloud conventions.
20. Review the current Git working tree:
    Shell

```text
git status --short
git diff --stat
```

1. Determine whether species routes, query configuration, mobile projection, or name resolution have already been partially implemented.
2. Verify partial implementation against the approved Step 19 scope.
3. Identify all ambiguities before completing the implementation plan.
   Do not modify source files during planning.

Produce a concise, file-by-file implementation plan and wait for approval.

After the plan is approved, the first implementation action must be to save the approved plan as:

Plain Text

```text
github-prompts/Step 19-implement-species-query-endpoints-and-name-resolution-plan.md
```

Only after saving the approved plan may source-code implementation begin.

## Approved scope

Implement:

HTTP

```text
GET /api/v1/reference-data/species
GET /api/v1/reference-data/species/{id}
```

Support filtering by:

- General text
- FAO code
- Scientific name
- Country code
- Language code
  Support:

HTTP

```text
Accept-Language
```

Implement this exact mobile common-name resolution order:

1. Official local name matching the requested language.
2. Common name matching the requested country.
3. Official `en-GB` local name.
4. First available country common name.
5. Scientific name.
6. FAO code.
   Do not alter this precedence without explicit approval.

## Approved deliverables

- Species routes
- Species query configuration
- Name resolver
- Mobile species projector
- Tests for every fallback rule
- Route-level integration tests

## Architecture context

The standard species query flow must preserve these boundaries:

Plain Text

```text
Species route
  -> Reference Data Controller
  -> Validation Module
  -> Query Module
  -> Common Collection Query Engine
  -> In-Memory Data Store
`
```

The mobile species flow adds:

Plain Text

```text
Canonical species
  -> Name-resolution context
  -> Species name resolver
  -> Mobile species projector
```

The canonical species collection remains the only source of truth.

The mobile representation must be generated from canonical data and must not be independently persisted.

## Mandatory architecture constraints

### No direct persistence access

The species controller, query configuration, name resolver, and mobile projector must not:

- Import the AWS SDK.
- Access S3.
- Access Floci.
- Call the Persistence Module directly.
- Read species fixture files at runtime.
- Read species JSON files from the file system.
  All active species data must be obtained through the Query Module and In-Memory Data Store contracts.

### No database

Do not introduce:

- MongoDB
- Redis
- DynamoDB
- SQL persistence
- An external species database
- An ORM or ODM
- Database models
- Database indexes
- Database queries
- Database connections
  All species querying and name resolution operate on the process-local canonical species collection.

### No direct Authentication Service access

The species controller must use the Validation Module for authentication and read authorisation.

Do not:

- Call the Authentication Service directly.
- Decode bearer tokens in the route.
- Trust token claims outside the Validation Module.
- Bypass read authorisation.

### No source-data mutation

Species queries and projections must not mutate:

- The active species collection.
- Species records.
- Common-name arrays.
- Local-name arrays.
- Nested name records.
- Query input.
- Language context.
- Country context.
- Collection metadata.
- Stored collection ordering.

### No independently maintained mobile species data

Do not create:

- A mobile species S3 object.
- A mobile species manifest entry.
- A separate authoritative mobile species collection.
- A mobile species upload path.
- A mobile species cache independent from the canonical species collection.
  The mobile projection must always originate from the active canonical species data.

### No external name lookup

Do not:

- Call an external taxonomy service.
- Call a translation service.
- Query a country service.
- Query a language service.
- Translate names dynamically.
- Generate missing common names.
- Infer names through artificial intelligence.
  Name resolution must use only approved canonical species fields.

### No unrelated endpoint work

Do not implement:

- Map-land endpoints
- Statistical-area endpoints
- Upload endpoints
- Species item mutations
- Catch-record functionality
- Seed-data bootstrap
- New authentication behaviour
- New persistence behaviour
- New cache-refresh behaviour

## Canonical species model

Use the canonical species schema implemented in Step 04.

The expected conceptual shape is:

JSON

```text
{
  "id": "da465aa5-abcf-443a-bc7e-62e78978bca7",
  "faoCode": "COD",
  "scientificName": "Gadus morhua",
  "commonNames": [
    {
      "id": "d1408068-472b-4a11-9ee8-f502e1529eb1",
      "countryCode": "GBR",
      "name": "Atlantic cod"
    }
  ],
  "localNames": [
    {
      "id": "83089f86-9399-47a6-a075-ca08bc5f17e2",
      "languageCode": "en-GB",
      "name": "Cod",
      "official": true
    }
  ],
  "active": true
}
```

This example is illustrative.

Use the actual Step 04 canonical schema and current repository implementation as authoritative.

Do not rename or flatten canonical species properties merely to simplify the mobile representation.

The species GUID is the resource identifier.

The FAO code remains a business identifier.

## Endpoint 1: Retrieve or search species

Implement:

HTTP

```text
GET /api/v1/reference-data/species
```

The endpoint must support:

- Complete collection retrieval according to Step 15.
- Canonical representation.
- Mobile representation.
- General text search.
- Exact FAO-code filter.
- Scientific-name filter.
- Country-code filter.
- Language-code filter.
- Approved pagination.
- Approved sorting.
- Approved active-state filtering.
- `Accept-Language` context.
- Read authentication and authorisation.
- Correlation handling.
- ETag and conditional requests.
- Standard API errors.
  Do not implement a second generic query engine.

Use the Step 15 query-configuration and custom-filter extension mechanisms.

## Endpoint 2: Retrieve one species by GUID

Implement:

HTTP

```text
GET /api/v1/reference-data/species/{id}
```

Requirements:

- Resolve the species by GUID.
- Validate the route parameter using existing request-validation conventions.
- Support canonical and mobile representations.
- Use country and language context for mobile projection.
- Return the approved not-found error when the GUID does not exist.
- Require read permission.
- Preserve correlation and cache behaviour.
- Avoid mutating the canonical species item.
  Do not accept an FAO code as the `{id}` value.

For example, `COD` is not a substitute for a species GUID.

## Representation selection

Use the representation contract and common query behaviour from Step 15.

Supported representations are:

Plain Text

```text
canonical
mobile
```

Use the approved query parameter already established by the API design and Step 15, expected to be:

HTTP

```text
?view=canonical
?view=mobile
```

Do not invent another representation parameter.

Invalid representations must produce the existing approved request error.

## Canonical response

For `view=canonical` , return the complete canonical species data.

Preserve approved values including:

- Species GUID
- FAO code
- Scientific name
- Country-scoped common names
- Local names
- Language codes
- Official-name indicator
- Active state
  Requirements:

- Do not mutate the canonical species item.
- Do not remove common or local names based on request language.
- Do not replace nested names with a single display name.
- Do not flatten nested names.
- Do not add mobile-only fields to the canonical item.
- Do not expose persistence metadata or internal object keys.
- Use the response envelope established by Step 15 and the approved API design.

## Mobile species projection

Implement a species-specific canonical-to-mobile projector through the Step 03 projector contract.

The expected conceptual mobile shape is:

JSON

```text
{
  "id": "da465aa5-abcf-443a-bc7e-62e78978bca7",
  "faoCode": "COD",
  "scientificName": "Gadus morhua",
  "displayName": "Cod"
}
```

Use the actual approved API design and current projector conventions as authoritative.

The mobile projector must:

- Preserve the species GUID.
- Preserve the FAO code.
- Preserve the scientific name if approved.
- Resolve one deterministic display name.
- Use the approved language and country context.
- Apply the exact approved fallback order.
- Return a new JSON-compatible object.
- Avoid mutating canonical data.
- Exclude internal metadata.
- Exclude unapproved canonical fields.
- Avoid returning complete name arrays unless explicitly approved.
  If the final mobile field names are not established, stop and ask for clarification.

## Species name-resolution context

The name resolver must receive an explicit context.

The context should support the approved values for:

- Requested language
- Requested country
  Use the existing projection-context contract from Step 03.

Do not read full Hapi request objects inside the resolver.

The controller or approved adapter must translate HTTP inputs into the internal projection context.

Do not add transport concerns to the name resolver.

## Accept-Language handling

Support `Accept-Language` through the existing request-processing conventions.

Requirements:

- Parse the header according to the approved level of support.
- Preserve valid BCP 47 language tags.
- Avoid permissive substring matching.
- Avoid unsafe regular expressions.
- Avoid external language lookups.
- Pass the selected requested language to the name resolver.
- Do not mutate request headers.
- Do not include the complete header in errors or logs unnecessarily.
  If quality weights are supported, process them deterministically.

Example:

HTTP

```text
Accept-Language: cy-GB, en-GB;q=0.8, en;q=0.6
```

If the repository does not already define quality-weight support, stop and ask whether to:

1. Support only the first valid language tag, or
2. Fully honour ordered weighted language preferences.
   Do not silently implement incomplete RFC behaviour and describe it as full `Accept-Language` support.

## Country context

Support country-specific common-name resolution using the approved source of country context.

Possible sources may include:

- An approved query parameter.
- An approved header.
- An established request or actor context.
  Use only the source defined by the API design or existing implementation.

Do not infer country from:

- Authentication identity
- IP address
- AWS region
- Language code
- Vessel registration
- Service deployment environment
  If no approved country-context source exists, stop and ask for clarification.

## Exact name-resolution precedence

Implement the following order exactly.

### Rule 1: Official local name matching requested language

Select an entry from `localNames` where:

- `official` is `true` .
- `languageCode` matches the requested language according to the approved language-matching rule.
  If more than one entry matches and earlier validation does not prevent this:

- Do not choose nondeterministically.
- Apply an approved deterministic tie-breaker.
- If no tie-breaker is approved, ask for clarification.

### Rule 2: Common name matching requested country

If Rule 1 returns no name, select an entry from `commonNames` whose `countryCode` matches the requested country according to the approved country-matching rule.

If more than one entry matches:

- Use the approved deterministic rule.
- Do not depend accidentally on object enumeration.
- Do not sort or mutate the canonical array in place.

### Rule 3: Official `en-GB` local name

If Rules 1 and 2 return no name, select an entry from `localNames` where:

- `official` is `true` .
- `languageCode` matches `en-GB` according to the approved exact matching rule.
  Use a named constant for the fallback language.

Do not scatter the string `en-GB` through the implementation and tests unnecessarily.

### Rule 4: First available country common name

If Rules 1 through 3 return no name, select the first available valid entry from `commonNames` .

Preserve the approved canonical ordering.

Do not sort or rewrite the source array unless an approved deterministic ordering rule supersedes source order.

### Rule 5: Scientific name

If no local or common name is available, use `scientificName` .

Do not translate or alter the scientific name.

### Rule 6: FAO code

If no previous value is available, use `faoCode` .

Do not convert the FAO code to lowercase or use it as the resource ID.

## Name validity

A selected display name must be a valid non-empty canonical string.

Do not:

- Select `null` .
- Select an empty string.
- Select whitespace-only content.
- Trim or normalise source content unless Step 10 already guarantees canonical trimming.
- Repair malformed canonical data silently.
  If malformed canonical data reaches the resolver despite previous validation and normalisation:

- Skip unusable optional candidates where safe.
- Fail deterministically if no approved fallback remains.
- Use the established service-error model.
- Do not mutate or repair the canonical data.

## Deterministic tie-breaking

Use approved canonical ordering where the data model permits multiple valid candidates at the same precedence level.

Do not apply arbitrary alphabetical sorting unless explicitly approved.

The resolver must return the same result for the same canonical item and context.

If earlier dataset validation guarantees uniqueness at a precedence level, document and reuse that guarantee instead of adding conflicting resolver rules.

## General text search

Configure species general text search through the Step 15 engine.

Potential approved fields include:

- FAO code
- Scientific name
- Common-name values
- Local-name values
  Use only fields approved by the API design and canonical schema.

Nested arrays must be searched through a safe configured accessor or approved custom search mechanism.

Do not:

- Serialise the entire species object for search.
- Search GUIDs as general text unless explicitly approved.
- Search internal metadata.
- Use caller-provided regular expressions.
- Implement fuzzy search.
- Implement phonetic search.
- Introduce an external search service.
  Use the matching semantics established in Step 15.

## FAO-code filter

Support the exact approved FAO-code filter.

Expected conceptual request:

HTTP

```text
GET /api/v1/reference-data/species?faoCode=COD
```

Use the exact parameter name from the approved API design.

Requirements:

- Map the filter to `faoCode` .
- Preserve the FAO code as a string.
- Keep the FAO code separate from the GUID.
- Use exact matching according to approved casing semantics.
- Return an empty search result when no code matches, unless the approved API specifies another behaviour.
- Do not accept FAO code through the GUID route.

## Scientific-name filter

Support filtering by scientific name.

Expected conceptual request:

HTTP

```text
GET /api/v1/reference-data/species?scientificName=Gadus%20morhua
```

Use the exact approved matching semantics.

Do not assume exact or partial matching without checking Step 15 and the API design.

Do not apply biological taxonomy inference.

Do not normalise or rewrite scientific names.

## Country-code filter

Support filtering species by country-scoped common-name entries.

Expected conceptual request:

HTTP

```text
GET /api/v1/reference-data/species?countryCode=GBR
```

A species matches when the approved country-code condition is satisfied by its canonical `commonNames` .

Requirements:

- Use a pure predicate or Step 15 approved custom-filter mechanism.
- Do not mutate `commonNames` .
- Do not make external country lookups.
- Use approved country-code matching semantics.
- Combine with other filters using Step 15 semantics.
  The country-code filter and mobile requested country may share the same query value only if the API design explicitly establishes this behaviour.

If unclear, ask for clarification.

## Language-code filter

Support filtering species by local-name language entries.

Expected conceptual request:

HTTP

```text
GET /api/v1/reference-data/species?languageCode=cy-GB
```

A species matches when an approved `localNames` entry uses the requested language code.

Requirements:

- Use the exact approved BCP 47 matching semantics.
- Do not mutate local names.
- Do not translate names.
- Do not infer language from country.
- Combine with other filters using Step 15 semantics.
  The language-code filter and `Accept-Language` projection context must remain distinct unless the API design explicitly states otherwise.

## Filter combination

Use the Step 15 approved semantics when multiple filters are supplied.

Do not independently choose AND or OR behaviour.

Examples requiring deterministic behaviour include:

HTTP

```text
?faoCode=COD&countryCode=GBR
```

HTTP

```text
?query=cod&languageCode=en-GB
```

HTTP

```text
?scientificName=Gadus&countryCode=GBR&view=mobile
```

If Step 15 does not define filter combination semantics, stop and ask for clarification.

## Active-state behaviour

Use the common `includeInactive` behaviour from Step 15.

Requirements:

- Reuse strict boolean parsing.
- Reuse approved defaults.
- Do not mutate species active state.
- Do not infer activity from nested names.
- Do not independently filter common or local names unless the canonical model contains approved nested status properties.

## Pagination and sorting

Use the common Step 15 implementation.

Do not duplicate:

- Offset parsing
- Limit parsing
- Maximum limit enforcement
- Sort syntax
- Sort direction
- Total-count calculation
- Active-state parsing
  Configure only approved species sort fields.

Potential sort fields may include:

- FAO code
- Scientific name
- Resolved mobile display name
  Do not assume display-name sorting is approved because it can vary by language and country context.

If no approved sort fields exist, use the Step 15 default rather than inventing them.

Sorting must not mutate the canonical collection.

## Authentication and authorisation

Require the approved read permission through the Validation Module.

Expected permission:

Plain Text

```text
reference-data.read
```

Use the final permission value implemented in Step 12 if different.

Requirements:

- Missing or invalid credentials map to the approved unauthorised response.
- Missing read permission maps to the approved forbidden response.
- Authentication Service unavailability maps to the approved dependency error.
- No route calls the Authentication Service directly.
- No token appears in logs, errors, or responses.
- Both species routes apply the same approved read-authorisation policy.

## Error behaviour

Reuse the Step 03 service-error model and Step 13 HTTP error mapping.

Expected cases include:

- Invalid GUID
- Species not found
- Invalid FAO-code filter
- Invalid scientific-name filter
- Invalid country code
- Invalid language code
- Invalid `Accept-Language`
- Unsupported representation
- Invalid pagination
- Invalid sorting
- Species collection not loaded
- Unable to resolve an approved display name
- Unauthorised
- Forbidden
- Authentication Service unavailable
- Unexpected internal failure
  Do not create a second species-specific error envelope.

Errors must:

- Include the approved correlation identifier.
- Use stable codes.
- Use safe messages.
- Identify invalid query fields where appropriate.
- Avoid returning complete species records or name arrays.
- Avoid exposing cache or S3 internals.
- Avoid stack traces.
- Avoid bearer tokens.
- Avoid complete request headers.

## ETag and caching

Use the common ETag and cache utilities from Steps 13 through 15.

Requirements:

- Canonical species responses use the approved active collection ETag strategy.
- Mobile responses follow the approved projection ETag strategy.
- The mobile response ETag must account for language or country context where required by the approved design.
- `If-None-Match` can produce `304` where approved.
- A `304` response must not have a body.
- Cache headers must reflect any representation context that changes output.
- Use the existing approved `Vary` header behaviour when output depends on `Accept-Language` .
- Do not calculate incompatible ETags independently in the species controller.
  If `Accept-Language` changes output and the existing cache design does not account for this, stop and ask for clarification.

Do not introduce unsafe shared caching across different language responses.

## Controller requirements

The Reference Data Controller must:

- Register the two approved species routes.
- Parse approved route and query parameters.
- Parse or delegate parsing of approved language context.
- Invoke authentication and authorisation through the Validation Module.
- Invoke the Query Module.
- Pass projection context through approved internal contracts.
- Apply response content type, headers, and status.
- Map service errors through the common error mapper.
  The controller must not:

- Search arrays directly.
- Resolve species names directly.
- Access the In-Memory Data Store directly if the Query Module owns that boundary.
- Access persistence.
- Access S3 or Floci.
- Call the Authentication Service directly.
- Mutate canonical data.

## Query Module requirements

The Query Module must:

- Use the Step 15 common query engine.
- Use species-specific query configuration.
- Read through the In-Memory Data Store contract.
- Retrieve the active canonical `species` collection.
- Apply the species mobile projector when requested.
- Pass approved language and country context.
- Preserve query-result and collection metadata.
- Avoid direct infrastructure access.
  Do not create a second species query engine.

## Species query configuration

Define a focused species query configuration through the Step 15 extension mechanism.

It should identify:

- Dataset: `species`
- GUID field: `id`
- Business-code field: `faoCode`
- General text fields or safe accessors
- Scientific-name filter
- Country-code nested-name filter
- Language-code nested-name filter
- Approved sortable fields
- Active-state field
- Mobile projector
- Projection-context behaviour
- Any approved parameter aliases
  The configuration must not contain:

- Fixture-specific values
- Hapi response objects
- S3 object keys
- Authentication tokens
- Database query syntax

## Test fixtures

Reuse canonical species JSON fixtures where practical.

Add focused synthetic fixtures covering:

- Official local name matching requested language
- Common name matching requested country
- Official `en-GB` fallback
- First available country common-name fallback
- Scientific-name fallback
- FAO-code fallback
- Multiple languages
- Multiple countries
- Missing common names
- Missing local names
- Missing scientific name where structurally allowed
- Active and inactive species
- General search
- Nested-name filters
- Multiple species with deterministic ordering
  Use stable synthetic GUIDs.

Use JSON files for substantial declarative fixtures where consistent with repository and SonarCloud conventions.

Do not include real personal or sensitive information.

## Required unit tests

Testing is part of Step 19 and must be completed in this step.

### Species query-configuration tests

Verify:

1. Dataset is `species` .
2. GUID field is `id` .
3. FAO-code field maps correctly.
4. Scientific-name filter maps correctly.
5. Country-code nested-name filter is registered.
6. Language-code nested-name filter is registered.
7. Approved general search fields are configured.
8. Approved sort fields are configured.
9. Active-state behaviour is configured.
10. Mobile projector is configured.
11. Common Step 15 logic is not duplicated.

### Canonical response tests

Verify:

1. Species GUID is preserved.
2. FAO code is preserved.
3. Scientific name is preserved.
4. Common-name arrays are preserved.
5. Country codes are preserved.
6. Local-name arrays are preserved.
7. Language codes are preserved.
8. Official indicators are preserved.
9. Active state is preserved.
10. Mobile-only display fields are not added.
11. Canonical data is not mutated.

### Name-resolution precedence tests

Add explicit tests for every approved fallback rule.

#### Rule 1 tests

Verify:

1. An official local name matching the requested language is selected.
2. A non-official local name in the requested language is not selected ahead of an official match.
3. A local name in another language is not selected at Rule 1.
4. Language matching follows approved casing and regional semantics.

#### Rule 2 tests

Verify:

1. A country common name is selected when Rule 1 has no match.
2. A common name from another country is not selected at Rule 2.
3. Rule 1 takes precedence over the requested-country common name.

#### Rule 3 tests

Verify:

1. Official `en-GB` local name is selected when Rules 1 and 2 fail.
2. Non-official `en-GB` does not satisfy the official fallback.
3. Requested-country common name takes precedence over `en-GB` .

#### Rule 4 tests

Verify:

1. The first available country common name is selected when Rules 1 through 3 fail.
2. Source order or the approved deterministic order is preserved.
3. Scientific name is not selected while an available country common name exists.

#### Rule 5 tests

Verify:

1. Scientific name is selected when no usable common or local name exists.
2. FAO code is not selected while a scientific name exists.

#### Rule 6 tests

Verify:

1. FAO code is selected when no usable name or scientific name exists.
2. FAO code remains a business code and not the returned resource ID.

### Name-resolver quality tests

Verify:

1. Resolution is deterministic.
2. Resolver input is not mutated.
3. Nested arrays are not sorted in place.
4. Whitespace-only candidates are not selected if canonical data can contain them.
5. Missing optional arrays are handled according to the canonical schema.
6. Multiple same-level candidates follow the approved tie-breaker.
7. Language and country contexts are not mutated.
8. Result is a plain JSON-compatible value or approved resolver result.
9. Resolver has no transport or infrastructure dependency.

### Mobile projection tests

Verify:

1. Mobile output preserves the GUID.
2. Mobile output preserves FAO code.
3. Mobile output preserves scientific name where approved.
4. Mobile output contains one resolved display name.
5. Rule 1 result is projected correctly.
6. Rule 2 result is projected correctly.
7. Rule 3 result is projected correctly.
8. Rule 4 result is projected correctly.
9. Rule 5 result is projected correctly.
10. Rule 6 result is projected correctly.
11. Complete common-name arrays are excluded unless approved.
12. Complete local-name arrays are excluded unless approved.
13. Internal metadata is excluded.
14. Canonical input is not mutated.
15. Projection is deterministic.

### General search tests

Verify approved general searches against:

- FAO code
- Scientific name
- Common names
- Local names
  Also verify:

1. Nested names are searchable safely.
2. Unapproved fields are not searched.
3. No match returns an empty result.
4. Matching follows Step 15 semantics.
5. Search does not mutate nested arrays.
6. Search is deterministic.
7. Caller input is not interpreted as an executable regular expression.

### FAO-code filter tests

Verify:

1. Matching FAO code returns the species.
2. Unmatched FAO code returns an empty search result.
3. Matching follows approved case semantics.
4. FAO code is not accepted as GUID.
5. Empty and malformed values follow approved behaviour.
6. Source data is not mutated.

### Scientific-name filter tests

Verify:

1. Matching scientific name returns the species.
2. Unmatched value returns an empty result.
3. Matching follows approved exact or partial semantics.
4. Casing follows approved behaviour.
5. Source scientific name is not modified.

### Country-code filter tests

Verify:

1. Species with a matching common-name country is returned.
2. Species without a matching country is excluded.
3. Multiple common names are handled safely.
4. Matching follows approved casing semantics.
5. The filter combines with other filters according to Step 15.
6. Canonical common-name arrays are not mutated.

### Language-code filter tests

Verify:

1. Species with a matching local-name language is returned.
2. Species without a matching language is excluded.
3. Multiple local names are handled safely.
4. Matching follows approved BCP 47 semantics.
5. Filtering remains separate from mobile resolution context unless explicitly approved.
6. Canonical local-name arrays are not mutated.

### Accept-Language tests

Verify:

1. A valid single language is accepted.
2. Selected language reaches the resolver.
3. Header casing is handled according to Hapi conventions.
4. Multiple languages follow the approved behaviour.
5. Quality weights follow the approved behaviour.
6. Malformed values follow approved validation behaviour.
7. Missing header follows approved default behaviour.
8. Raw complete headers are not exposed in errors.
9. Header parsing does not mutate request context.

### Individual species retrieval tests

Verify:

1. Existing GUID returns the species.
2. Unknown valid GUID returns the approved not-found error.
3. Invalid GUID returns the approved request error.
4. FAO code in the path is not treated as a GUID.
5. Canonical representation is supported.
6. Mobile representation is supported.
7. Language context affects mobile display name correctly.
8. Country context affects mobile display name correctly.
9. Source data is not mutated.

### Active-state tests

Verify:

1. Default active-state behaviour follows Step 15.
2. `includeInactive=false` follows approved behaviour.
3. `includeInactive=true` includes inactive species where approved.
4. Invalid boolean input is rejected.
5. Nested names are not independently filtered without an approved nested active property.
6. Source data is not mutated.

### Pagination and sorting tests

Verify:

1. Search pagination reuses Step 15.
2. Total count is calculated before pagination.
3. Maximum limit is enforced.
4. Approved sorting works.
5. Sorting does not mutate canonical data.
6. Full collection retrieval is not accidentally truncated.
7. Context-sensitive display-name sorting is not introduced unless approved.

### Authentication tests

Verify:

1. Missing credentials return unauthorised.
2. Invalid credentials return unauthorised.
3. Missing read permission returns forbidden.
4. Read permission allows access.
5. Authentication Service unavailability maps correctly.
6. No token is exposed.
7. Controllers do not call the Authentication Service directly.

### ETag and cache tests

Verify:

1. Canonical species responses include the approved ETag.
2. Mobile species responses follow approved ETag behaviour.
3. Matching `If-None-Match` can return `304` .
4. A `304` response has no body.
5. Approved cache headers are present.
6. `Vary` or equivalent behaviour protects language-dependent output where approved.
7. Different language contexts do not incorrectly share incompatible projected responses.
8. The species controller does not calculate incompatible ETags independently.

### Error tests

Verify:

1. Invalid GUID uses the standard error.
2. Unknown GUID uses the standard not-found error.
3. Invalid country code uses the standard validation error.
4. Invalid language code uses the standard validation error.
5. Unsupported representation uses the standard error.
6. Unloaded species collection maps correctly.
7. Unresolvable malformed canonical data fails safely.
8. Correlation ID is included.
9. Stack traces are not exposed.
10. S3 and store internals are not exposed.
11. Complete name arrays are not included in errors.

## Route-level integration tests

Use Hapi injection and existing dependency-injection conventions.

Test:

HTTP

```text
GET /api/v1/reference-data/species
GET /api/v1/reference-data/species/{id}
```

Cover:

1. Full canonical collection.
2. Full mobile collection.
3. General text search.
4. FAO-code filter.
5. Scientific-name filter.
6. Country-code filter.
7. Language-code filter.
8. Combined filters.
9. `Accept-Language` .
10. Requested country context.
11. Rule 1 mobile name resolution.
12. Rule 2 mobile name resolution.
13. Rule 3 mobile name resolution.
14. Rule 4 mobile name resolution.
15. Rule 5 mobile name resolution.
16. Rule 6 mobile name resolution.
17. Pagination.
18. Sorting.
19. Include-inactive behaviour.
20. Existing species by GUID.
21. Unknown species GUID.
22. Invalid GUID.
23. FAO code rejected as path ID.
24. Canonical single-species response.
25. Mobile single-species response.
26. Invalid representation.
27. Conditional request returning `304` .
28. Language-sensitive cache behaviour.
29. Unauthorised request.
30. Forbidden request.
31. Authentication Service unavailable.
32. Species collection unavailable.
33. Correlation-header propagation.
34. Standard error envelope.
35. Canonical source immutability.
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

1. Species routes do not import the AWS SDK.
2. Species query code does not import the Persistence Module.
3. Species routes do not import the Authentication Service client.
4. Only the Query Module accesses the In-Memory Data Store according to the approved boundary.
5. Mobile species projections are not independently persisted.
6. The name resolver has no Hapi dependency.
7. The name resolver has no external HTTP dependency.
8. No database or Redis dependency is introduced.
9. No Step 20 map-location endpoints are added.

## Regression testing

Run:

- Species query-configuration tests.
- Species name-resolver tests.
- Species mobile-projector tests.
- Species filter tests.
- `Accept-Language` tests.
- Species route integration tests.
- Step 15 common query-engine tests.
- Step 13 common API tests.
- Step 12 authentication tests.
- Existing Steps 16 through 18 tests.
- The complete repository test suite.
- Test coverage.
- Linting.
- Formatting checks.
  Do not defer Step 19 tests to Steps 26 through 28.

## Defra SonarCloud review

After implementation and tests pass, analyse all code created or modified by Step 19 against the configured Defra SonarCloud rules.

Use the repository’s configured SonarCloud project and:

Plain Text

```text
https://sonarcloud.io/organizations/defra/rules
```

Review for:

- Magic numbers
- Hardcoded language values scattered across files
- Duplicate fallback logic
- Duplicate query parameter strings
- Excessive cognitive complexity
- Deep conditional chains
- Unsafe optional-property access
- Input mutation
- In-place sorting
- Unsafe regular expressions
- Unhandled promise rejections
- Broad catch blocks
- Dead code
- Unused exports
- Weak assertions
- Sensitive-header logging
- Incorrect language matching
- Incorrect country matching
- Non-deterministic fallback selection
- Incorrect `Vary` behaviour
- Incorrect ETag handling
- Missing authentication checks
- FAO codes used as GUIDs
- Direct S3 access
- Persisted mobile projections
  Prefer named constants for:

- `en-GB` fallback language
- Query parameter names
- Header names
- Representation names
  Use JSON files for substantial declarative fixtures where consistent with repository conventions.

Do not resolve findings by:

- Disabling Sonar rules globally
- Adding broad suppressions
- Excluding species files
- Weakening tests
- Removing fallback assertions
- Changing approved name-resolution precedence
- Changing approved API behaviour silently
  For every finding introduced by Step 19:

1. Record the rule identifier.
2. Identify the file and line.
3. Explain the risk.
4. Apply the smallest scope-safe correction.
5. Rerun focused tests.
6. Rerun linting and formatting.
7. Rerun available Sonar analysis.
   If a finding requires changing the approved contract or resolution precedence, stop and ask for clarification.

If SonarCloud runs only in CI, clearly state that final verification remains pending CI.

## Security and privacy considerations

- Require read authentication for both routes.
- Never log bearer tokens.
- Never expose S3 information.
- Never expose stack traces.
- Do not expose complete stored collections in errors.
- Do not expose complete request headers.
- Parse language headers safely.
- Avoid unsafe regular expressions.
- Use bounded query limits.
- Prevent canonical data mutation.
- Use synthetic species data in tests.
- Do not add user-specific data.
- Do not perform external translation or taxonomy calls.
- Return only approved mobile fields.
- Preserve correlation identifiers safely.
- Ensure context-dependent responses use safe cache variation.
- Treat actor and language contexts separately.
- Do not infer country or language from sensitive personal information.

## Documentation requirements

Add or update focused documentation covering:

- Species collection endpoint.
- Species-by-GUID endpoint.
- Supported species query parameters.
- General text search.
- FAO-code filter.
- Scientific-name filter.
- Country-code filter.
- Language-code filter.
- `Accept-Language` behaviour.
- Country-context source.
- Canonical species representation.
- Mobile species representation.
- Exact mobile name-resolution precedence.
- Behaviour when no preferred name exists.
- GUID versus FAO code.
- Active-state behaviour.
- Pagination and sorting.
- Authentication requirements.
- ETag, `Vary` , and conditional requests.
- Standard errors.
  Do not duplicate the complete implementation plan or API design.

## In scope

- Species collection GET route
- Species-by-GUID GET route
- Species query configuration
- General species search
- FAO-code filter
- Scientific-name filter
- Country-code filter
- Language-code filter
- `Accept-Language` handling
- Country and language projection context
- Species name resolver
- Mobile species projector
- Read-authorisation integration
- ETag and conditional-request integration
- Context-sensitive cache behaviour
- Standard error integration
- Unit tests
- Route-level integration tests
- Architecture-boundary tests
- Defra Sonar review
- Focused documentation

## Out of scope

Do not implement:

- Changes to the approved plan
- Species schema redesign
- Species validation redesign
- Canonical normalisation changes
- New persistence behaviour
- Direct S3 or Floci access
- Persisted mobile species data
- Cache-refresh redesign
- Authentication Service contract changes
- Login or token issuance
- External translation
- External taxonomy lookup
- Map-land endpoints
- Statistical-area endpoints
- Species item mutation
- Upload validation
- Full collection replacement
- Seed-data bootstrap
- New database functionality
- Redis
- Final OpenAPI work assigned to Step 31
- Metrics or audit work assigned to Step 25
- Deployment infrastructure

## Expected deliverables

The approved Step 19 deliverables are:

1. Species routes.
2. Species query configuration.
3. Name resolver.
4. Mobile species projector.
5. Tests for every fallback rule.
6. Route-level integration tests.
   Also produce:

7. Approved implementation plan saved as:
   Plain Text

```text
github-prompts/Step 19-implement-species-query-endpoints-and-name-resolution-plan.md
```

1. Architecture-boundary verification.
2. Focused species endpoint documentation.
3. Defra SonarCloud review result for Step 19 changes.

## Approved completion criteria

The step must satisfy the approved plan criteria:

- Canonical responses retain all common and local names.
- Mobile responses return one deterministic display name.
- FAO code remains a business code rather than the resource ID.
- Country and language context is represented correctly.
  The implementation must also demonstrate:

- Both approved routes are registered.
- Species GUID remains the resource identifier.
- Read permission is enforced.
- General search and filters reuse Step 15.
- All six name-resolution levels follow the approved order.
- Name resolution is deterministic.
- Canonical, search, and mobile responses originate from the same active species collection.
- Mobile projection does not mutate canonical data.
- Language-sensitive caching is handled safely.
- Standard errors and ETags reuse common utilities.
- Required unit and integration tests pass.
- No later-step functionality is implemented.
- Step 19 code has been reviewed against Defra SonarCloud rules.

## Verification

Inspect `package.json` and use the repository’s actual scripts.

Run the applicable equivalents of:

Shell

```text
npm test -- <species-query-configuration-tests>
npm test -- <species-name-resolver-tests>
npm test -- <species-mobile-projector-tests>
npm test -- <species-filter-tests>
npm test -- <species-route-tests>
npm test -- <architecture-boundary-tests>
npm test
npm run test:coverage
npm run lint
npm run format:check
```

Run the repository’s Sonar or static-analysis command if one exists.

Format every file created or modified by Step 19.

If the repository-wide formatting check reports unrelated generated artifacts:

1. Confirm every file changed by Step 19 passes Prettier.
2. Do not reformat unrelated generated conversation or metadata files.
3. Report remaining warnings accurately.
4. Do not claim that the repository-wide command passed if it failed.
   If a pre-existing failure occurs:

5. Record the exact command.
6. Record the relevant output.
7. Determine whether Step 19 caused it.
8. Fix failures introduced by Step 19.
9. Do not broaden the scope silently.
10. Ask for clarification if resolution requires unrelated work.
    No real S3, Floci, Authentication Service, database, Redis, translation-service, or taxonomy-service integration is required for Step 19 route tests.

## Final response requirements

After implementation, report:

1. Summary of completed work.
2. Saved Step 19 plan path.
3. Files created.
4. Files modified.
5. Species routes implemented.
6. Supported query parameters.
7. General search fields.
8. FAO-code matching behaviour.
9. Scientific-name matching behaviour.
10. Country-code filter behaviour.
11. Language-code filter behaviour.
12. `Accept-Language` parsing behaviour.
13. Country-context source.
14. Language-matching rules.
15. Rule 1 name-resolution behaviour.
16. Rule 2 name-resolution behaviour.
17. Rule 3 name-resolution behaviour.
18. Rule 4 name-resolution behaviour.
19. Rule 5 name-resolution behaviour.
20. Rule 6 name-resolution behaviour.
21. Same-level tie-breaking behaviour.
22. Mobile field mapping.
23. Missing-name behaviour.
24. Active-state behaviour.
25. Pagination and sorting behaviour.
26. Authentication and authorisation behaviour.
27. ETag, cache, and `Vary` behaviour.
28. Standard error behaviour.
29. Unit tests and results.
30. Route integration tests and results.
31. Complete test-suite result.
32. Coverage result.
33. Lint result.
34. Formatting result.
35. Architecture-boundary result.
36. Defra SonarCloud analysis method.
37. Sonar findings introduced by Step 19.
38. Sonar fixes applied.
39. Whether final SonarCloud CI verification remains pending.
40. Confirmation that species GUID remains the resource ID.
41. Confirmation that FAO code remains a separate business identifier.
42. Confirmation that mobile data was not independently persisted.
43. Confirmation that no database or Redis functionality was introduced.
44. Confirmation that no direct S3, Floci, or Authentication Service access was added.
45. Confirmation that no external translation or taxonomy lookup was added.
46. Confirmation that no later-step functionality was implemented.
47. Work deferred to subsequent approved steps.
48. Remaining ambiguities, risks, or owner decisions.
    Do not modify the approved implementation plan.

If you reach any ambiguity, ask me to clarify.
