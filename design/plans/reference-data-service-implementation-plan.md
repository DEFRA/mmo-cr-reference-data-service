# Reference Data Service Step-by-Step Implementation Plan

## 1. Purpose

This plan defines the implementation sequence for the Reference Data Service backend.

The service provides controlled access to and management of Catch Recording reference data, including:

- Vessels
- Gears
- Ports
- Species
- Map-location data
- Statistical-area data
  The plan translates the agreed API and C4 Level 3 designs into discrete implementation steps. Each step is intentionally scoped so that it can be implemented through a single GitHub Copilot prompt.

---

## 2. Architectural principles

The implementation must preserve the following principles throughout all steps.

### 2.1 Canonical data based on legacy schemas

The canonical schemas must remain as close as practical to the existing legacy reference-data schemas.

Existing data structures, identifiers, business codes, relationships, and business meanings must not be removed merely to simplify the mobile API.

### 2.2 GUID identifiers

Every canonical reference-data record must have a stable GUID property named `id` .

Existing business identifiers remain separate, including:

- Vessel CFR
- Vessel registration number
- Vessel external mark
- Gear code
- Port code
- Species FAO code
- Statistical-area code
  Business codes must not replace GUID resource identifiers.

### 2.3 Canonical and mobile representations

The service must support two API representations:

- `canonical` , preserving the complete reference-data model
- `mobile` , returning a simplified projection for the Catch Recording mobile UI
  The mobile representation must be generated from the canonical collection. It must not be maintained as a separate source of truth.

### 2.4 Full collection replacement

Reference-data management is limited to uploading a complete collection.

The service must not provide endpoints for:

- Creating one reference-data item
- Updating one reference-data item
- Deleting one reference-data item
- Partially patching a collection
  A collection upload must be validated and normalised completely before it becomes active.

### 2.5 S3-compatible persistence

JSON reference-data collections must be persisted through an S3-compatible interface.

The repository already provides Floci for local AWS service emulation. Local development must use that existing infrastructure rather than introducing LocalStack, MinIO, or another S3 emulator.

The Persistence Module must be the only application component that communicates directly with S3 or Floci.

### 2.6 In-memory JSON store

Active, normalised collections must be held as JSON objects in application memory.

Redis must not be used for the reference-data cache.

The in-memory data must be treated as a cache. The persisted S3 collection remains the durable source of truth.

### 2.7 Metadata-based cache refresh

The service must determine whether persisted collections have changed by comparing collection or manifest metadata.

The cache must only reload a collection when the associated metadata indicates that the persisted file has changed.

### 2.8 Authentication and authorisation

Protected operations must be validated through the existing Authentication Service.

The Validation Module must be the only Reference Data Service component that communicates directly with the Authentication Service.

### 2.9 External-service ownership

Each external dependency must be accessed through one owning component:

- Authentication Service through the Validation Module
- S3-compatible storage through the Persistence Module
  Other components must depend on internal abstractions rather than external SDKs or endpoints.

---

## 3. Assumptions

1. The existing repository is based on Node.js 24 and Hapi.
2. The service listens on port `3001` during local development.
3. The existing Docker Compose environment includes Floci on port `4566` .
4. Floci provides the local S3-compatible endpoint.
5. AWS development and production environments will provide a real S3 bucket.
6. MongoDB and Redis may be present in the original backend template, but neither is required by the agreed Reference Data Service design.
7. The AWS SDK for JavaScript will be used behind the Persistence Module.
8. Initial data files may require transformation before conforming to canonical schemas.
9. Map-location data is the principal new reference-data domain not represented by the established legacy schemas.
10. Map geometry will use GeoJSON and WGS84 coordinates.
11. Authentication Service details may not initially be available. An internal authorisation adapter must therefore allow controlled test substitution without bypassing production security.
12. The API prefix will be `/api/v1/reference-data` .
13. The exact legacy meaning of some fields, particularly gear `fixed` , may require confirmation. Canonical data must preserve such fields without making destructive assumptions.

---

## 4. Target component responsibilities

### Reference Data Controller

- Defines and registers API routes.
- Validates transport-level request structures.
- Maps HTTP requests to application use cases.
- Maps use-case results and errors to HTTP responses.
- Must not contain persistence or data-normalisation logic.

### Validation Module

- Performs request and collection validation.
- Validates GUIDs, codes, metadata, and collection relationships.
- Calls the Authentication Service.
- Applies authorisation requirements.
- Returns structured validation findings.

### Query Module

- Retrieves complete reference-data collections.
- Retrieves individual resources by GUID.
- Searches and filters collections.
- Selects canonical or mobile projections.
- Reads from the In-Memory Data Store.

### Command Module

- Coordinates complete collection uploads.
- Coordinates validation, normalisation, persistence, activation, and cache refresh.
- Must not access S3 directly.

### Data Normalisation Module

- Converts inbound reference files into canonical collections.
- Trims and standardises supported fields.
- Creates mobile response projections.
- Converts supported map data into canonical GeoJSON.
- Must not perform persistence.

### In-Memory Data Store

- Stores active canonical collections as JSON objects.
- Stores active manifest and collection metadata.
- Provides controlled read and replacement operations.
- Must not independently communicate with S3.

### Cache Refresh Module

- Retrieves persisted metadata through the Persistence Module.
- Compares persisted and in-memory metadata.
- Reloads only changed collections.
- Supports initial application cache hydration.

### Persistence Module

- Owns AWS SDK interaction.
- Reads and writes collection JSON objects.
- Reads and writes the manifest.
- Retrieves object metadata.
- Is the only component allowed to communicate with S3 or Floci.

---

# 5. Implementation steps

## Step 01: Assess and align the existing repository

### Objective

Establish the current repository baseline and identify template features that must be retained, adapted, or removed.

### Scope

- Inspect the current Hapi application structure.
- Review package scripts and dependencies.
- Review existing configuration handling.
- Review current routes, services, plugins, and tests.
- Review the Dockerfile and Docker Compose setup.
- Review Floci initialisation scripts.
- Identify existing MongoDB and Redis dependencies.
- Identify example routes and template code that should be removed.
- Confirm Node.js, npm, Hapi, linting, formatting, testing, and coverage conventions.
- Record any gaps between the repository and the agreed architecture.

### Deliverables

- Repository assessment document.
- List of template code to remove or retain.
- Proposed source-folder layout.
- Confirmed local startup and test commands.
- Confirmed environmental configuration requirements.

### Completion criteria

- The current repository structure is understood.
- No architectural assumptions depend on unexplored template code.
- Floci integration points have been identified.
- MongoDB and Redis have been classified as required or removable.
- The implementation folder structure is agreed.

### Dependencies

None.

---

## Step 02: Establish the service structure and configuration

### Objective

Create the architectural skeleton for the Reference Data Service without implementing business behaviour.

### Scope

Create clear module boundaries for:

- Reference Data Controller
- Validation Module
- Query Module
- Command Module
- Data Normalisation Module
- In-Memory Data Store
- Cache Refresh Module
- Persistence Module
  Add central configuration for:

- Application port
- Runtime environment
- AWS region
- AWS endpoint URL
- Reference-data bucket name
- S3 path-style behaviour
- Cache refresh settings
- Maximum upload size
- Authentication Service URL
- Logging configuration
  Validate required configuration during service startup.

Ensure AWS credentials and endpoints are controlled through environment variables and are not embedded in source code.

### Deliverables

- Agreed directory structure.
- Module entry points.
- Central configuration schema.
- Environment-specific configuration handling.
- Startup failure for missing mandatory configuration.
- Updated example environment documentation.

### Completion criteria

- The application starts with valid local configuration.
- Invalid mandatory configuration prevents startup with a useful error.
- Modules have clear ownership boundaries.
- No business module directly imports an AWS client.
- No secrets are committed to source control.

### Dependencies

Step 01.

---

## Step 03: Define shared domain types and contracts

### Objective

Create the stable internal contracts shared by the service components.

### Scope

Define contracts for:

- Dataset identifiers
- Collection envelope
- Collection metadata
- Manifest
- Manifest dataset entry
- Validation result
- Validation error
- Validation warning
- Query filters
- Query result
- Upload command
- Upload result
- Reference-data repository
- In-memory collection store
- Authentication and authorisation client
- Canonical-to-mobile projector
- Service error
  Define the supported datasets:

- `vessels`
- `gears`
- `ports`
- `species`
- `map-land`
- `map-statistical-areas`
- Derived `map-ports`
  Define the distinction between:

- Uploadable datasets
- Queryable datasets
- Derived datasets

### Deliverables

- Shared constants and domain contracts.
- Repository interface.
- Cache interface.
- Authentication client interface.
- Common error model.
- Dataset capability definitions.

### Completion criteria

- All modules can depend on shared contracts without circular dependencies.
- `map-ports` is marked as derived and cannot be uploaded directly.
- Dataset validation is centralised.
- External implementations can be substituted in tests.

### Dependencies

Step 02.

---

## Step 04: Define canonical collection schemas

### Objective

Formalise machine-validatable schemas for every persisted collection.

### Scope

Define canonical schemas for:

- Vessels
- Gears
- Ports
- Species
- Map land
- Map statistical areas
- Collection envelopes
- Manifest metadata
  The schemas must preserve legacy concepts.

#### Vessels

Include:

- GUID identifier
- Name
- Name and PLN representation
- CFR
- UVI
- MMSI
- IRCS
- External mark
- Registration number
- Vessel type
- Registration country
- Length overall
- Status
- Active dates

#### Gears

Include:

- GUID identifier
- Code
- Name
- Type
- Category
- Pair-fishing capability
- Characteristics
- Characteristic data type
- Unit
- Minimum and maximum values
- Required indicator
- Fixed indicator
- Vessel-length applicability
- Active state

#### Ports

Include:

- GUID identifier
- Port code
- Name
- Country code
- Optional coordinate
- Active state

#### Species

Include:

- GUID identifier
- FAO code
- Scientific name
- Country-scoped common names
- Local names
- Language codes
- Official-name indicator
- Active state

#### Map data

Include:

- GeoJSON feature collections
- GUID feature identifiers
- Area codes
- Area names
- Area type
- Parent-area references
- Centroids
- Geometry
- WGS84 metadata

### Deliverables

- Versioned schema definitions.
- Valid example collection for each dataset.
- Invalid schema fixtures covering common failures.
- Schema-version compatibility rules.

### Completion criteria

- Every uploadable dataset has a versioned schema.
- Every canonical item requires a valid GUID.
- Business codes remain separate from GUIDs.
- Schema validation identifies the exact invalid path.
- Legacy concepts are preserved.
- Map schemas enforce valid GeoJSON structures.

### Dependencies

Step 03.

---

## Step 05: Implement the In-Memory Data Store

### Objective

Provide a controlled in-process store for active JSON collections and metadata.

### Scope

Implement operations to:

- Store a canonical collection.
- Retrieve a complete collection.
- Retrieve collection metadata.
- Determine whether a collection is loaded.
- Replace a collection atomically.
- Remove a collection for test and recovery scenarios.
- Store and retrieve the active manifest.
- List loaded datasets.
- Clear the store during tests.
  Prevent mutable references from unintentionally changing active data.

### Deliverables

- In-memory store implementation.
- Atomic collection replacement.
- Defensive data access.
- Unit tests for all store operations.

### Completion criteria

- Collections are stored as JSON-compatible objects.
- One collection can be replaced without affecting other datasets.
- Failed replacement operations leave the previous collection intact.
- Consumers cannot unintentionally mutate stored collections.
- Redis is not used.

### Dependencies

Steps 03 and 04.

---

## Step 06: Configure Floci S3 resources for local development

### Objective

Use the repository’s existing Floci environment to provide the local S3 bucket and initial object structure.

### Scope

- Inspect existing scripts under `compose/floci/start.d` .
- Add or update a startup script to create the local reference-data bucket.
- Make bucket creation idempotent.
- Optionally enable features required by the agreed persistence approach.
- Define the initial object-key convention.
- Ensure the service container uses the correct Docker-network endpoint.
- Ensure host-run development can use `http://localhost:4566` .
- Document the difference between host and container endpoint configuration.
- Do not add LocalStack or MinIO.

### Proposed object-key convention

- `reference-data/manifest.json`
- `reference-data/vessels/{version}.json`
- `reference-data/gears/{version}.json`
- `reference-data/ports/{version}.json`
- `reference-data/species/{version}.json`
- `reference-data/map-land/{version}.json`
- `reference-data/map-statistical-areas/{version}.json`

### Deliverables

- Idempotent Floci bucket initialisation.
- Local bucket configuration.
- Object-key convention.
- Local verification instructions.
- Compose configuration aligned with the service.

### Completion criteria

- Starting Docker Compose creates the expected bucket automatically.
- Repeated startup does not fail.
- The service container can connect to Floci.
- A host-run service can connect using the host endpoint.
- No separate S3 emulator is introduced.

### Dependencies

Steps 01 and 02.

---

## Step 07: Implement the Persistence Module

### Objective

Implement the only component allowed to communicate with S3-compatible storage.

### Scope

Implement repository operations for:

- Reading a collection object.
- Writing a new versioned collection object.
- Reading the manifest.
- Writing the manifest.
- Retrieving object metadata.
- Checking whether an object exists.
- Calculating or preserving checksums and ETags.
- Mapping AWS SDK errors to service errors.
- Supporting Floci locally and AWS S3 in deployed environments.
  The module must use dependency injection or configurable client construction to remain testable.

### Deliverables

- AWS SDK S3 client configuration.
- S3 repository implementation.
- Object serialisation and deserialisation.
- Error translation.
- Unit tests with mocked SDK responses.
- Integration tests against Floci.

### Completion criteria

- The module reads and writes JSON through the S3 API.
- No other module imports or uses the AWS S3 SDK.
- Local implementation works against Floci.
- Deployed configuration can omit the endpoint and use AWS S3.
- Missing objects, access failures, malformed JSON, and unavailable storage produce predictable errors.

### Dependencies

Steps 02, 03, 04, and 06.

---

## Step 08: Implement common structural and business validation

### Objective

Create reusable validation logic for requests and complete collection uploads.

### Scope

Implement common validation for:

- Supported datasets
- Valid GUIDs
- Unique item GUIDs
- Required collection metadata
- Matching route and payload dataset
- Supported schema versions
- Matching `itemCount`
- Unique collection versions
- Required business codes
- Duplicate business codes
- String limits
- Date ordering
- Relationship references
- Upload size
- Supported content types
  Create structured validation errors containing:

- Error code
- Field path
- Message
- Rejected value where safe
- Dataset
- Correlation identifier
  Validation must collect useful errors rather than stopping at the first invalid item where practical.

### Deliverables

- Common validation engine.
- Structured validation result.
- Error-detail model.
- Reusable validation utilities.
- Unit tests for common rules.

### Completion criteria

- Invalid collections return deterministic findings.
- Validation results identify item indexes and property paths.
- GUID and business-code validation remain distinct.
- Validation does not persist or modify data.
- Rejected values containing sensitive information are not logged indiscriminately.

### Dependencies

Steps 03 and 04.

---

## Step 09: Implement dataset-specific validation

### Objective

Apply the business rules unique to each reference-data collection.

### Scope

#### Vessel validation

Validate:

- At least one supported natural identifier.
- Uniqueness of CFR, UVI, MMSI, IRCS, external mark, and registration number when present.
- Non-negative vessel length.
- Valid active-date ranges.

#### Gear validation

Validate:

- Unique gear, category, and characteristic codes.
- Valid category references.
- Valid characteristic references.
- Supported characteristic data types.
- Valid numeric ranges.
- At least one applicable vessel-length band.
- Preservation of `fixed` and `required` as separate concepts.

#### Port validation

Validate:

- Unique port codes.
- Valid country codes.
- Latitude range.
- Longitude range.
- Paired latitude and longitude values.

#### Species validation

Validate:

- Unique FAO codes.
- Valid country-code formats.
- Valid language-code formats.
- Unique nested-name GUIDs.
- Official local-name constraints.

#### Map validation

Validate:

- GeoJSON `FeatureCollection` root.
- GUID feature identifiers.
- Unique statistical-area codes.
- Numeric coordinates.
- WGS84 coordinate ranges.
- Closed polygon rings.
- Non-empty geometries.
- Valid parent-area references.

### Deliverables

- Validator for each uploadable dataset.
- Valid and invalid fixtures.
- Unit tests for every rule.
- Consistent validation-error output.

### Completion criteria

- Every dataset-specific rule has a passing and failing test.
- Validation does not destructively reinterpret legacy fields.
- Invalid map geometry cannot become active.
- Errors clearly identify the affected dataset and item.

### Dependencies

Step 08.

---

## Step 10: Implement canonical data normalisation

### Objective

Transform valid inbound collections into deterministic canonical representations.

### Scope

Implement normalisation for:

- Trimming supported text fields.
- Standardising empty optional values.
- Preserving GUIDs and business identifiers.
- Standardising dates.
- Standardising country and language codes where safe.
- Sorting deterministically where order has no business meaning.
- Ensuring numeric coordinate values.
- Converting supported map inputs to WGS84 GeoJSON.
- Calculating `itemCount` .
- Generating or preserving collection metadata according to agreed rules.
- Producing normalisation warnings.
  Normalisation must not silently discard unknown legacy data without an explicit decision.

### Deliverables

- Dataset-specific normalisers.
- Normalisation pipeline.
- Warning model.
- Deterministic-output tests.
- Before-and-after fixtures.

### Completion criteria

- Identical logical inputs produce identical canonical output.
- Existing GUIDs remain unchanged.
- Business codes remain unchanged except for explicitly approved formatting.
- Data loss does not occur silently.
- Map coordinates are emitted as numeric longitude and latitude in WGS84.

### Dependencies

Steps 04, 08, and 09.

---

## Step 11: Implement the Cache Refresh Module and startup hydration

### Objective

Load persisted collections into memory and refresh only those that have changed.

### Scope

Implement:

- Application-startup cache hydration.
- Manifest retrieval through the Persistence Module.
- Comparison of collection IDs, versions, ETags, checksums, or last-modified metadata.
- Loading of missing collections.
- Refreshing changed collections.
- Retaining unchanged collections.
- Atomic in-memory replacement.
- Handling partially unavailable datasets.
- Manual refresh capability for internal use.
- Configurable periodic refresh only if required by the deployment model.
  Define startup behaviour for:

- Missing manifest.
- Empty bucket.
- Invalid persisted collection.
- S3 temporarily unavailable.
- One invalid collection while others are valid.

### Deliverables

- Cache refresh service.
- Initial hydration process.
- Metadata comparison logic.
- Refresh result model.
- Unit tests.
- Floci integration tests.

### Completion criteria

- Startup loads valid active collections into memory.
- Unchanged collections are not downloaded unnecessarily.
- A failed refresh leaves the previous valid collection active.
- One failed dataset does not corrupt other loaded datasets.
- Refresh operations use the Persistence Module rather than the S3 SDK directly.

### Dependencies

Steps 05, 07, 08, 09, and 10.

---

## Step 12: Implement Authentication Service integration

### Objective

Integrate token validation and permission checks through the Validation Module.

### Scope

Implement:

- Authentication Service client abstraction.
- Token forwarding.
- Token-validation response mapping.
- Role or permission mapping.
- Read permission enforcement.
- Write permission enforcement.
- Timeouts and controlled retries.
- Authentication Service unavailable errors.
- Test implementation for unit and local integration scenarios.
  Proposed permissions:

- `reference-data.read`
- `reference-data.write`
  Do not log raw access tokens.

### Deliverables

- Authentication client interface and implementation.
- Authorisation checks in the Validation Module.
- Authentication error mapping.
- Unit tests for authorised and unauthorised scenarios.
- Local test strategy.

### Completion criteria

- Missing or invalid credentials return `401` .
- Insufficient permissions return `403` .
- Authentication Service failure returns an appropriate `503` .
- Read and upload operations use distinct permissions.
- No component other than the Validation Module directly calls the Authentication Service.
- Tokens and security-sensitive headers are redacted from logs.

### Dependencies

Steps 02, 03, and 08.

---

## Step 13: Implement common API behaviour and error handling

### Objective

Establish consistent transport behaviour before adding dataset endpoints.

### Scope

Implement:

- `/api/v1/reference-data` route prefix.
- Request correlation identifiers.
- Standard success envelopes.
- Standard error envelopes.
- Error-to-HTTP-status mapping.
- ETag response handling.
- `If-None-Match` support.
- `If-Match` parsing.
- Cache headers.
- JSON and GeoJSON content types.
- Request-size limits.
- Unsupported media-type handling.
- Safe error logging.
- Hapi validation-failure handling.

### Deliverables

- Common controller utilities.
- Error mapper.
- Correlation-ID support.
- HTTP caching utilities.
- Route-level integration tests.

### Completion criteria

- Errors follow the agreed error contract.
- Internal stack traces are not exposed.
- Responses contain a trace or correlation identifier.
- Conditional GET can return `304` .
- Invalid media types return `415` .
- Oversized uploads return `413` .

### Dependencies

Steps 02, 03, 08, and 12.

---

## Step 14: Implement the manifest API

### Objective

Allow clients to determine which reference-data collections are available and which have changed.

### Scope

Implement:

- `GET /api/v1/reference-data/manifest`
- Optional `include` filtering.
- Manifest retrieval from memory.
- Manifest ETag.
- `If-None-Match` .
- Dataset URLs.
- Dataset versions.
- Collection IDs.
- Item or feature counts.
- Format metadata.
- Last-modified metadata.
- GeoJSON metadata where relevant.

### Deliverables

- Manifest route.
- Query Module manifest use case.
- Manifest response projection.
- Unit and integration tests.

### Completion criteria

- The endpoint returns metadata for active datasets.
- The response does not contain inactive or incomplete uploads.
- `include` returns only supported requested datasets.
- Matching ETags return `304` .
- The endpoint requires read authorisation.

### Dependencies

Steps 11, 12, and 13.

---

## Step 15: Implement the common collection query engine

### Objective

Provide reusable logic for full collection retrieval, item retrieval, filtering, searching, sorting, and pagination.

### Scope

Implement support for:

- Full collection retrieval.
- Retrieval by GUID.
- Exact business-code matching.
- Multiple GUID selection.
- Multiple business-code selection.
- Free-text query.
- Dataset-specific filters.
- Offset and limit.
- Maximum result limits.
- Dataset-supported sorting.
- Active-state filtering.
- Canonical and mobile views.
  Define deterministic behaviour for:

- Missing query parameters.
- Unsupported filters.
- Invalid GUIDs.
- Invalid limits.
- Empty results.
- Unknown resource IDs.
- Querying a collection that is not loaded.

### Deliverables

- Reusable query engine.
- Query parser.
- Pagination metadata.
- Dataset query configuration.
- Query tests.

### Completion criteria

- Full collection requests remain distinct from searches.
- Searches return deterministic results.
- GUID lookup does not treat business codes as IDs.
- Maximum limits are enforced.
- Queries read from the In-Memory Data Store.
- The Query Module does not access S3 directly.

### Dependencies

Steps 05, 11, 12, and 13.

---

## Step 16: Implement vessel query endpoints and mobile projection

### Objective

Expose canonical and mobile vessel reference data.

### Scope

Implement:

- `GET /api/v1/reference-data/vessels`
- `GET /api/v1/reference-data/vessels/{id}`
  Support searches by:

- General text
- CFR
- Registration number
- External mark
- MMSI
- IRCS
- UVI
  Create the mobile projection containing:

- GUID
- Vessel name
- PLN or external mark
- CFR
- Display name
- Length overall
  Do not add an unsupported singular `homePort` field.

### Deliverables

- Vessel routes.
- Vessel query configuration.
- Canonical response.
- Mobile response projector.
- Unit and integration tests.

### Completion criteria

- Vessel GUID is the resource ID.
- Natural vessel identifiers remain searchable fields.
- Canonical responses preserve the vessel schema.
- Mobile responses contain only approved fields.
- Unknown GUIDs return `404` .

### Dependencies

Step 15.

---

## Step 17: Implement gear query endpoints and mobile projection

### Objective

Expose legacy-compatible gear structures and mobile-ready gear choices.

### Scope

Implement:

- `GET /api/v1/reference-data/gears`
- `GET /api/v1/reference-data/gears/{id}`
  Support filtering by:

- Text
- Gear code
- Category code
- Pair-fishing capability
- Vessel length
  Implement vessel-length band selection:

- Under 10 metres
- 10 to 12 metres
- Over 12 metres
  Create the mobile projection containing:

- Gear GUID
- Code
- Name
- Category
- Pair-fishing capability
- Applicable measurements
- Required measurement identifiers
- Variable measurement identifiers
  Preserve the canonical `fixed` field and make the mobile mapping configurable until its legacy meaning is confirmed.

### Deliverables

- Gear routes.
- Applicability resolver.
- Gear mobile projector.
- Tests for all vessel-length bands.
- Tests for fixed and variable measurement mapping.

### Completion criteria

- Non-applicable characteristics are excluded when vessel length is supplied.
- Canonical responses preserve categories and characteristics.
- Mobile responses provide sufficient information for the Catch Recording UI.
- Mapping ambiguity does not cause canonical data loss.

### Dependencies

Step 15.

---

## Step 18: Implement port query endpoints, location search, and map projection

### Objective

Expose ports as canonical/mobile JSON and as a derived GeoJSON map layer.

### Scope

Implement:

- `GET /api/v1/reference-data/ports`
- `GET /api/v1/reference-data/ports/{id}`
- `GET /api/v1/reference-data/map/ports`
  Support filtering by:

- Text
- Port code
- Country code
- Latitude, longitude, and radius
- Bounding box for the map layer
  Implement distance calculation for radius searches.

Generate the map-port GeoJSON layer from the active canonical ports collection.

Exclude ports without valid coordinates from the map projection while retaining them in the JSON collection.

### Deliverables

- Port routes.
- Port mobile projector.
- Location-search implementation.
- Derived map-port projector.
- GeoJSON response.
- Unit and integration tests.

### Completion criteria

- Port GUID remains the resource ID.
- Port code remains separately searchable.
- Radius search validates all required parameters.
- Map ports are not independently persisted or uploaded.
- Port JSON and map projections cannot drift.

### Dependencies

Step 15.

---

## Step 19: Implement species query endpoints and name resolution

### Objective

Expose complete species naming structures and resolve the correct mobile display name.

### Scope

Implement:

- `GET /api/v1/reference-data/species`
- `GET /api/v1/reference-data/species/{id}`
  Support filtering by:

- General text
- FAO code
- Scientific name
- Country code
- Language code
  Support `Accept-Language` .

Implement this mobile common-name resolution order:

1. Official local name matching requested language.
2. Common name matching requested country.
3. Official `en-GB` local name.
4. First available country common name.
5. Scientific name.
6. FAO code.

### Deliverables

- Species routes.
- Species query configuration.
- Name resolver.
- Mobile species projector.
- Tests for each fallback rule.

### Completion criteria

- Canonical responses retain all common and local names.
- Mobile responses return one deterministic display name.
- FAO code remains a business code rather than the resource ID.
- Country and language context is represented correctly.

### Dependencies

Step 15.

---

## Step 20: Implement map-location query endpoints

### Objective

Expose land and statistical-area reference data using GeoJSON.

### Scope

Implement:

- `GET /api/v1/reference-data/map/land`
- `GET /api/v1/reference-data/map/statistical-areas`
- `GET /api/v1/reference-data/map/statistical-areas/{id}`
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

### Deliverables

- Map routes.
- Bounding-box filter.
- Statistical-area search.
- GeoJSON response handling.
- Unit and integration tests.

### Completion criteria

- Returned map data is valid GeoJSON.
- Features remain identifiable by GUID and area code.
- Bounding-box requests return only intersecting or defined matching features.
- Malformed bounding boxes return `400` .
- Large map responses use appropriate cache headers.

### Dependencies

Steps 13 and 15.

---

## Step 21: Implement full collection upload validation mode

### Objective

Allow authorised users to validate a complete reference-data file without activating it.

### Scope

Implement:

- `PUT /api/v1/reference-data/{dataset}?validateOnly=true`
- Multipart upload handling.
- Upload dataset verification.
- File-size limits.
- JSON parsing.
- Schema validation.
- Business validation.
- Normalisation preview.
- Validation warnings.
- Received and normalised item counts.
  Reject direct upload of `map-ports` .

The validation-only process must not:

- Write to S3.
- Modify the active manifest.
- Replace an in-memory collection.
- Alter the active collection version.

### Deliverables

- Validation-only route.
- Multipart request parser.
- Command Module validation workflow.
- Validation response.
- Tests proving no state is modified.

### Completion criteria

- Valid files receive a successful validation report.
- Invalid files receive structured `422` errors.
- Unsupported datasets return a deterministic error.
- `map-ports` upload is rejected.
- The operation requires write permission.
- Active data remains unchanged.

### Dependencies

Steps 09, 10, 12, and 13.

---

## Step 22: Implement atomic full collection replacement

### Objective

Implement the production upload and activation workflow.

### Scope

Implement complete replacement for:

- Vessels
- Gears
- Ports
- Species
- Map land
- Map statistical areas
  Implement this sequence:

1. Authenticate and authorise.
2. Parse the request.
3. Validate the requested dataset.
4. Check `If-Match` when supplied.
5. Parse the complete JSON file.
6. Validate schema.
7. Validate business rules.
8. Normalise the collection.
9. Calculate checksum and ETag.
10. Write a new versioned object through the Persistence Module.
11. Update the active manifest.
12. Replace the in-memory collection atomically.
13. Return new and previous collection metadata.
    Define recovery behaviour if:

- Collection write fails.
- Manifest update fails.
- Cache replacement fails.
- The supplied ETag is stale.
- The collection version already exists.

### Deliverables

- Upload routes.
- Command Module replacement workflow.
- Concurrency protection.
- Manifest activation logic.
- Rollback or safe-failure behaviour.
- Unit and Floci integration tests.

### Completion criteria

- A collection becomes active only after complete validation and persistence.
- A failed upload never replaces the active collection.
- Duplicate versions return `409` .
- Stale `If-Match` values return `409` .
- Only the Persistence Module communicates with S3.
- Successful uploads refresh the corresponding in-memory collection.
- Successful port uploads also update the derived map-port response.

### Dependencies

Steps 07, 10, 11, 13, and 21.

---

## Step 23: Add seed reference data and deterministic local bootstrap

### Objective

Provide a repeatable local development dataset.

### Scope

Create small, valid example collections for:

- Vessels
- Gears
- Ports
- Species
- Map land
- Map statistical areas
  Provide an idempotent bootstrap process that:

- Creates the local bucket.
- Uploads seed collection files.
- Creates the initial manifest.
- Uses stable GUIDs.
- Can be run repeatedly.
- Does not overwrite deliberately modified local data unless explicitly requested.

### Deliverables

- Local seed JSON files.
- Initial manifest.
- Floci bootstrap script.
- Reset instructions.
- Tests or verification commands.

### Completion criteria

- A new developer can start Docker Compose and access usable reference data.
- Seed data conforms to canonical schemas.
- Seed GUIDs remain stable across runs.
- Local bootstrap is deterministic.
- Seed data contains no real personal or security-sensitive information.

### Dependencies

Steps 06, 07, and 22.

---

## Step 24: Implement health, readiness, and dependency status

### Objective

Expose operational status suitable for local development and deployment.

### Scope

Implement or refine:

- Liveness endpoint.
- Readiness endpoint.
- Cache-hydration state.
- S3 dependency status.
- Authentication Service dependency status where appropriate.
- Loaded dataset summary without exposing data contents.
- Degraded-state behaviour.
  Avoid making liveness dependent on transient external failures.

### Deliverables

- Health and readiness routes.
- Dependency-status model.
- Tests for healthy, degraded, and unavailable states.
- Deployment documentation.

### Completion criteria

- Liveness indicates whether the process is functioning.
- Readiness indicates whether required reference data is available.
- Sensitive configuration and collection content are not exposed.
- Transient S3 failure does not unnecessarily terminate a healthy process.
- Startup hydration status is represented accurately.

### Dependencies

Steps 11, 12, and 13.

---

## Step 25: Add structured logging, metrics, and audit events

### Objective

Make service operation and data-management actions observable.

### Scope

Add structured logging for:

- Incoming requests.
- Correlation identifiers.
- Query completion.
- Cache hydration.
- Cache refresh.
- Collection validation.
- Collection upload.
- Manifest activation.
- Persistence failures.
- Authentication failures.
  Define metrics for:

- Request count and latency.
- Query count by dataset.
- Cache hits and misses.
- Cache refresh count.
- Cache refresh failures.
- Upload count.
- Upload validation failures.
- S3 operation latency.
- Authentication dependency failures.
  Define audit events for successful and failed collection-management actions.

Audit data should include:

- Dataset
- Collection ID
- Version
- Timestamp
- Authorised actor identifier where available
- Outcome
- Correlation identifier
  Do not log:

- Access tokens
- Raw uploaded files
- Full reference collections
- AWS credentials

### Deliverables

- Structured logging conventions.
- Redaction rules.
- Metrics instrumentation.
- Upload audit events.
- Observability tests where practical.

### Completion criteria

- Every request can be followed using a correlation identifier.
- Upload activation is auditable.
- Secrets and tokens are redacted.
- Failures include useful operational context without exposing sensitive payloads.

### Dependencies

Steps 13, 14, 16 through 22.

---

## Step 26: Complete automated unit testing

### Objective

Achieve comprehensive isolated coverage of domain and component behaviour.

### Scope

Add unit tests for:

- Configuration
- Canonical schemas
- Common validation
- Dataset validation
- Normalisation
- In-memory storage
- Metadata comparison
- Cache refresh
- Authentication mapping
- Query filtering
- Pagination
- Mobile projections
- Error mapping
- Upload orchestration
- Concurrency checks
  Use mocks at external boundaries:

- Persistence repository
- Authentication client
- Clock where required
- GUID or hash generators where determinism is required

### Deliverables

- Comprehensive unit-test suite.
- Reusable fixtures.
- Coverage report.
- Documented test conventions.

### Completion criteria

- Important success, invalid-input, unavailable-dependency, and concurrency paths are covered.
- Unit tests do not require Docker.
- Tests are deterministic.
- External SDK behaviour is isolated behind interfaces.

### Dependencies

Steps 03 through 25.

---

## Step 27: Complete Floci integration testing

### Objective

Verify the real service integration with the local S3-compatible environment.

### Scope

Test:

- Bucket availability.
- Collection object writes.
- Collection object reads.
- Manifest writes and reads.
- Metadata retrieval.
- Startup hydration.
- Metadata-based refresh.
- Validation-only upload.
- Successful full replacement.
- Failed replacement.
- Stale ETag handling.
- Missing object handling.
- Invalid persisted JSON.
- S3 unavailability.
- Restart and rehydration.

### Deliverables

- Floci-backed integration-test suite.
- Test bootstrap and cleanup.
- Local execution command.
- CI execution guidance.

### Completion criteria

- Integration tests run against the repository’s existing Floci service.
- Tests clean up or isolate their data.
- The implementation proves that the Persistence Module is compatible with S3 semantics used by the service.
- No LocalStack or MinIO dependency is added.

### Dependencies

Steps 07, 11, 22, 23, and 26.

---

## Step 28: Complete API acceptance and contract testing

### Objective

Verify the public API against the agreed Reference Data Service API design.

### Scope

Create acceptance tests for:

- Manifest retrieval.
- Conditional manifest request.
- Full canonical collection retrieval.
- Full mobile collection retrieval.
- Search.
- Pagination.
- GUID lookup.
- Business-code lookup.
- Vessel search.
- Gear applicability.
- Port location search.
- Species-name resolution.
- GeoJSON responses.
- Validation-only upload.
- Successful upload.
- Upload validation failure.
- Duplicate version.
- Stale collection update.
- Authentication failure.
- Authorisation failure.
- S3 failure.

### Deliverables

- API acceptance-test suite.
- Expected payload fixtures.
- Expected error fixtures.
- Contract-test execution instructions.

### Completion criteria

- API responses match the approved endpoint and payload design.
- Error responses use the standard contract.
- Canonical and mobile schemas are tested independently.
- GeoJSON content type and structures are verified.
- Protected operations enforce the appropriate permissions.

### Dependencies

Steps 14 through 27.

---

## Step 29: Remove unused template infrastructure and examples

> **Deviation note:** Mongo/Redis application code, config, dependencies, Compose services, and the example route/service were already removed in Step 01 (approved deviation from this plan's original sequencing). This step's remaining scope is limited to any further unused template artefacts identified after Steps 02-28.

### Objective

Ensure the repository accurately represents the implemented architecture.

### Scope

Subject to the Step 01 assessment:

- Remove example routes.
- Remove example services.
- Remove unused MongoDB code.
- Remove unused MongoDB Compose configuration.
- Remove Redis application dependencies.
- Remove Redis Compose configuration if not required by shared platform tooling.
- Remove unused packages.
- Remove obsolete configuration.
- Update source and test paths.
- Confirm no runtime code expects MongoDB or Redis.
  Do not remove platform-required code without confirming its purpose.

### Deliverables

- Cleaned repository.
- Updated dependency list.
- Updated Compose configuration.
- Passing lint and test suites.
- Record of retained template components and rationale.

### Completion criteria

- No unused example API remains.
- No implementation contradicts the in-memory and S3 design.
- The application starts without MongoDB or Redis unless retained for a documented external reason.
- Dependency and security scans do not contain avoidable unused packages.

### Dependencies

Steps 01 and 28.

---

## Step 30: Complete security and privacy hardening

### Objective

Review and harden the implementation before deployment.

### Scope

Review:

- Authentication enforcement.
- Permission mapping.
- Upload size controls.
- JSON parser limits.
- Malformed and compressed payload handling.
- File-name handling.
- Content-type restrictions.
- Schema denial-of-service risks.
- GeoJSON complexity limits.
- Logging redaction.
- AWS credential handling.
- S3 bucket permissions.
- S3 encryption.
- TLS requirements.
- Dependency vulnerabilities.
- Error information disclosure.
- Correlation-ID validation.
- Rate-limit expectations.
- Audit-event integrity.
  Reference data is not expected to contain personal catch records, but vessel datasets and upload audit records must still receive a privacy classification review.

### Deliverables

- Security review checklist.
- Privacy review notes.
- Resolved findings.
- Recorded accepted risks.
- Operational security recommendations.

### Completion criteria

- Tokens and credentials are never logged.
- Upload limits are enforced.
- Only authorised users can replace collections.
- Bucket access follows least privilege.
- Public access is blocked unless an explicit approved requirement states otherwise.
- Security and privacy assumptions are documented.

### Dependencies

Steps 22 through 29.

---

## Step 31: Update developer and API documentation

### Objective

Provide complete documentation for development, integration, and operation.

### Scope

Update the README with:

- Service purpose.
- Supported datasets.
- Architectural overview.
- Local prerequisites.
- Environment variables.
- Docker Compose startup.
- Floci S3 behaviour.
- Bucket initialisation.
- Seed-data bootstrap.
- Host-run versus container-run endpoints.
- Test commands.
- Lint and formatting commands.
- API overview.
- Upload examples.
- Cache-refresh behaviour.
- Troubleshooting.
  Add or update:

- OpenAPI specification.
- Canonical schema documentation.
- Mobile projection documentation.
- Error catalogue.
- Operational runbook.
- Collection-upload guidance.

### Deliverables

- Updated README.
- OpenAPI contract.
- Data-schema documentation.
- Upload guide.
- Operations and troubleshooting guide.

### Completion criteria

- A new developer can run the service without undocumented steps.
- API consumers can understand canonical and mobile responses.
- An authorised operator can validate and replace a collection.
- Local Floci usage is clearly distinguished from deployed AWS S3 usage.

### Dependencies

Steps 28 through 30.

---

## Step 32: Final architecture and implementation review

### Objective

Confirm that the implementation conforms to the approved design before release.

### Scope

Review the final implementation against:

- C4 Level 3 component boundaries.
- API design.
- Canonical data schemas.
- Mobile projections.
- GUID strategy.
- Full collection replacement rule.
- S3 ownership rule.
- Authentication ownership rule.
- In-memory cache rule.
- Cache-refresh design.
- Error contract.
- Security requirements.
- Test coverage.
- Documentation.
  Identify:

- Design deviations.
- Technical debt.
- Deferred decisions.
- Operational risks.
- Follow-up changes.

### Deliverables

- Final architecture conformance review.
- Deviation register.
- Technical-debt register.
- Release-readiness checklist.
- Recommended follow-up work.

### Completion criteria

- Each design principle has implementation evidence.
- Deviations are corrected or formally accepted.
- All required test suites pass.
- Security-critical findings are resolved.
- The service is ready for deployment to the first AWS environment.

### Dependencies

All previous steps.

---

# 6. Recommended implementation sequence

The steps should be implemented in this order:

1. Assess and align the existing repository.
2. Establish service structure and configuration.
3. Define shared domain types and contracts.
4. Define canonical collection schemas.
5. Implement the In-Memory Data Store.
6. Configure Floci S3 resources.
7. Implement the Persistence Module.
8. Implement common validation.
9. Implement dataset-specific validation.
10. Implement canonical normalisation.
11. Implement cache refresh and startup hydration.
12. Implement Authentication Service integration.
13. Implement common API behaviour and error handling.
14. Implement the manifest API.
15. Implement the collection query engine.
16. Implement vessel endpoints.
17. Implement gear endpoints.
18. Implement port and map-port endpoints.
19. Implement species endpoints.
20. Implement map-location endpoints.
21. Implement validation-only uploads.
22. Implement atomic full collection replacement.
23. Add seed data and local bootstrap.
24. Implement health and readiness.
25. Add logging, metrics, and audit events.
26. Complete unit testing.
27. Complete Floci integration testing.
28. Complete API acceptance testing.
29. Remove unused template infrastructure.
30. Complete security and privacy hardening.
31. Update documentation.
32. Complete the final architecture review.

---

# 7. GitHub Copilot prompt boundaries

Each implementation step must later have one dedicated GitHub Copilot prompt.

Each prompt should:

1. State the step number and title.
2. Instruct GitHub Copilot to begin in plan mode.
3. Provide the approved architecture constraints.
4. Identify files and modules that may be affected.
5. Instruct GitHub Copilot to inspect the repository before proposing changes.
6. Define explicitly what is in scope.
7. Define explicitly what is out of scope.
8. State the required tests.
9. State the completion criteria.
10. Require linting, formatting, and relevant tests to pass.
11. Prevent unrelated refactoring.
12. Require ambiguity to be raised before implementation.
13. Keep S3 SDK usage inside the Persistence Module.
14. Keep Authentication Service calls inside the Validation Module.
15. Preserve canonical GUIDs and business codes.
16. Avoid introducing Redis, LocalStack, or MinIO.
17. Use the existing Floci environment for S3 integration.
18. Avoid implementation work belonging to later steps.

---

# 8. Decisions requiring confirmation during implementation

The following decisions may require confirmation when the relevant step is reached:

1. The exact Authentication Service endpoint and response contract.
2. The exact permission or role names used by the Authentication Service.
3. The production S3 bucket naming convention.
4. Whether S3 object versioning is enabled in deployed environments.
5. Whether cache refresh is periodic, request-triggered, event-triggered, or a combination.
6. The exact legacy meaning of the gear `fixed` property.
7. The complete list of accepted gear characteristic data types.
8. Whether collection GUIDs are supplied by the source or generated by the service.
9. Whether item GUIDs may ever be generated for legacy records without UUIDs.
10. The authoritative source and update frequency for map-location data.
11. Maximum accepted collection and geometry sizes.
12. Whether uploads must support JSON only or also YAML.
13. Whether the initial API requires every documented search filter or a smaller minimum viable subset.
14. The required CDP observability and audit-event integration.
15. Whether MongoDB and Redis may be fully removed from the generated service template.
    These decisions must not block unrelated foundational implementation steps. Each must be resolved before the step whose behaviour depends on it is completed.

---

# 9. Definition of done for the service

The Reference Data Service is implementation-complete when:

- All supported collections have canonical schemas.
- Existing UUIDs are preserved and all API resources use GUID identifiers.
- Legacy business identifiers remain available and searchable.
- Canonical and mobile API projections are available.
- Full collections and filtered results can be retrieved.
- Map-location and statistical-area data are available as GeoJSON.
- Full replacement uploads can be validated without activation.
- Valid full replacement uploads are activated atomically.
- Invalid uploads leave the current collection unchanged.
- Active collections are persisted in S3-compatible storage.
- Active collections are cached as JSON objects in application memory.
- Changed collections can be detected and refreshed using metadata.
- Only the Persistence Module accesses S3.
- Only the Validation Module accesses the Authentication Service.
- Local development uses the repository’s existing Floci service.
- No Redis-backed reference-data cache is introduced.
- Authentication and authorisation are enforced.
- Standard error responses are implemented.
- Unit, integration, and API acceptance tests pass.
- Security and privacy reviews are complete.
- Developer, API, upload, and operational documentation are complete.
- The implementation conforms to the approved C4 Level 3 design.
