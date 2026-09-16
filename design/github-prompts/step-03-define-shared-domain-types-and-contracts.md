# Step 03: Define Shared Domain Types and Contracts

## Recommended reasoning effort

- Planning phase: High
- Implementation phase: High
## Objective

Define the stable shared domain types, constants, and component contracts required by the Reference Data Service.

This step must establish the internal language and boundaries that later components will implement. It must not implement infrastructure integrations, dataset schemas, API routes, storage behaviour, validation logic, or business workflows.

## Required working mode

Start in Plan mode.

Before proposing any changes:

1. Inspect the complete repository.
2. Read the current Reference Data Service implementation plan.
3. Read the approved Step 01 and Step 02 plans.
4. Inspect all changes completed during Steps 01 and 02.
5. Inspect the source structure established for:
  - Reference Data Controller
  - Validation Module
  - Query Module
  - Command Module
  - Data Normalisation Module
  - In-Memory Data Store
  - Cache Refresh Module
  - Persistence Module
6. Inspect `package.json` , the application configuration, test structure, lint rules, formatting rules, and module conventions.
7. Determine whether the repository uses:
  - JavaScript with JSDoc
  - TypeScript
  - Runtime validation schemas
  - Immutable constants
  - Factory functions
  - Classes
  - Plain object contracts
8. Search for existing constants, contracts, errors, and shared types that should be reused.
9. Confirm that the service has no database connection or database abstraction.
10. Identify any conflict between this prompt and the current repository.
Do not modify files during the planning phase.

Produce a file-by-file implementation plan and wait for approval.

After the plan is approved, the first implementation action must be to save the approved plan as:

Plain Text

```text
github-prompts/Step 03-define-shared-domain-types-and-contracts-plan.md
```
Only after saving the approved plan may implementation begin.

## Project context

The Reference Data Service provides access to and management of reference data used by the Catch Recording application.

The supported reference-data domains are:

- Vessels
- Gears
- Ports
- Species
- Map land
- Map statistical areas
- A derived map-port representation
The service architecture includes:

- Reference Data Controller
- Validation Module
- Query Module
- Command Module
- Data Normalisation Module
- In-Memory Data Store
- Cache Refresh Module
- Persistence Module
External dependencies are:

- Authentication Service
- AWS S3-compatible Reference Data Store
- API Gateway
- Catch Recording Service as a consumer
## Mandatory architectural constraints

### No database

The Reference Data Service does not use a database.

Do not introduce:

- MongoDB
- Redis
- DynamoDB
- PostgreSQL
- MySQL
- SQLite
- An ORM
- An ODM
- Database models
- Database repositories
- Database migrations
- Database plugins
- Database connection configuration
- Database sessions or transactions
A reference-data `collection` means a complete versioned JSON or GeoJSON reference-data file. It does not mean a database collection.

### Persistence ownership

- S3-compatible object storage is the durable source of truth.
- Only the Persistence Module may access AWS S3 or Floci.
- Shared contracts must not import or expose AWS SDK types.
- The Persistence Module implementation belongs to a later step.
### In-memory storage

- Active canonical collections will be held as process-local JSON objects.
- The In-Memory Data Store is a cache, not a database.
- Redis must not be introduced.
- The In-Memory Data Store implementation belongs to a later step.
### Authentication ownership

- Only the Validation Module may communicate with the Authentication Service.
- Shared contracts must not import or expose HTTP-client implementation types.
- Authentication Service integration belongs to a later step.
### Identity

- Every canonical reference-data resource uses a GUID as its stable technical `id` .
- Existing UUIDs must be preserved.
- Business identifiers remain separate from GUIDs.
Business identifiers include:

- Vessel CFR
- Vessel registration number
- Vessel external mark
- Gear code
- Port code
- Species FAO code
- Statistical-area code
### Representations

The service supports:

- `canonical` , representing the complete authoritative service model
- `mobile` , representing a consumer projection generated from canonical data
Mobile representations must not be independently persisted.

### Collection management

- Updates replace complete reference-data collections.
- Item-level create, update, patch, and delete operations are not supported.
- `map-ports` is derived from the active ports collection.
- `map-ports` cannot be uploaded or persisted as an independent authoritative collection.
## Implementation scope

### 1. Dataset identifiers

Define the supported dataset identifiers centrally:

Plain Text

```text
vessels
gears
ports
species
map-land
map-statistical-areas
map-ports
```
Do not duplicate dataset-name arrays across components.

Provide repository-compatible types, constants, or helpers for determining whether a value is a supported dataset.

### 2. Dataset capabilities

Define the capabilities of each dataset.

The contract must express whether a dataset is:

- Queryable
- Uploadable
- Persisted
- Derived
- JSON
- GeoJSON
Use these required capabilities:

#### Vessels

- Queryable: yes
- Uploadable: yes
- Persisted: yes
- Derived: no
- Format: JSON
#### Gears

- Queryable: yes
- Uploadable: yes
- Persisted: yes
- Derived: no
- Format: JSON
#### Ports

- Queryable: yes
- Uploadable: yes
- Persisted: yes
- Derived: no
- Format: JSON
#### Species

- Queryable: yes
- Uploadable: yes
- Persisted: yes
- Derived: no
- Format: JSON
#### Map land

- Queryable: yes
- Uploadable: yes
- Persisted: yes
- Derived: no
- Format: GeoJSON
#### Map statistical areas

- Queryable: yes
- Uploadable: yes
- Persisted: yes
- Derived: no
- Format: GeoJSON
#### Map ports

- Queryable: yes
- Uploadable: no
- Persisted independently: no
- Derived: yes
- Format: GeoJSON
- Source dataset: ports
Provide reusable capability helpers where consistent with existing repository conventions.

### 3. Representation identifiers

Define the supported response representations:

Plain Text

```text
canonical
mobile
```
Provide a safe mechanism for determining whether an input is a supported representation.

Do not implement projection behaviour.

### 4. JSON-compatible value contract

If appropriate for the repository language, define a reusable JSON-compatible value contract supporting:

- Null
- Boolean
- Number
- String
- Arrays
- Objects
Avoid unrestricted `any` where a safer repository-compatible type can be used.

Do not convert the project from JavaScript to TypeScript merely to support this contract.

### 5. Collection envelope contract

Define the common contract for a complete reference-data collection.

It must support:

- Dataset identifier
- Collection GUID
- Schema version
- Collection version
- Generated timestamp
- Optional effective-from timestamp
- Item or feature count
- Complete collection content
Keep collection content generic enough for Step 04 to define the detailed vessel, gear, port, species, and map schemas.

Support both JSON item collections and GeoJSON feature collections without prematurely implementing either schema.

### 6. Collection metadata contract

Define internal collection metadata capable of representing:

- Dataset
- Collection GUID
- Schema version
- Collection version
- Data format
- Item or feature count
- ETag
- Checksum
- Size in bytes
- Last-modified timestamp
- Upload timestamp where available
- Actor identifier where available
- Internal object reference where required
- Active status where required
Separate internal persistence metadata from future public API projections.

Do not expose internal S3 object keys as part of an assumed public API contract.

### 7. Manifest contracts

Define contracts for:

- Active manifest
- Manifest dataset entry
The manifest must be able to identify the active persisted version of each authoritative dataset.

The manifest contract should support:

- Manifest GUID
- Manifest version
- Generated timestamp
- Dataset entries
- ETag or checksum where appropriate
A manifest dataset entry should support:

- Dataset
- Collection GUID
- Schema version
- Collection version
- Format
- ETag
- Checksum
- Item or feature count
- Size in bytes
- Last-modified timestamp
- Internal object reference where required
Do not create an independent persisted manifest entry for `map-ports` . The map-port representation is derived from ports.

### 8. Validation contracts

Define contracts for:

- Validation result
- Validation issue
- Validation error
- Validation warning
A validation issue should support:

- Machine-readable code
- Safe human-readable message
- Optional property path
- Optional item index
- Optional rejected value when safe
- Optional dataset
- Severity
- Optional correlation identifier
A validation result should support:

- Valid or invalid outcome
- Errors
- Warnings
- Received item or feature count where applicable
- Normalised item or feature count where applicable
Do not implement validation rules or runtime collection schemas.

Do not couple validation contracts to Hapi response objects.

### 9. Query contracts

Define contracts for:

- Query request
- Query filters
- Pagination request
- Sorting request
- Query result
- Query metadata
The query request should be able to represent future support for:

- Dataset
- Representation
- Free-text query
- Exact business code
- Multiple GUIDs
- Multiple business codes
- Offset
- Limit
- Sort
- Include-inactive option
- Dataset-specific filters
- Correlation identifier
The query result should support:

- Dataset
- Collection GUID
- Collection version
- Representation
- Total result count
- Offset
- Limit
- Returned items
- Optional query context
Do not implement searching, filtering, sorting, pagination, or item retrieval.

### 10. Upload contracts

Define contracts for:

- Full collection upload command
- Validation-only upload mode
- Upload result
- Previous collection metadata
- Upload warnings
- Optimistic concurrency information
The upload command should support:

- Dataset
- Uploaded content
- Content type
- File name where relevant
- Schema version
- Collection version
- Effective-from timestamp
- Description
- Validate-only indicator
- Expected ETag from `If-Match`
- Correlation identifier
- Authorised actor identifier
The upload result should support:

- Dataset
- Collection GUID
- Schema version
- Collection version
- Status
- Item or feature count
- ETag
- Checksum
- Size in bytes
- Upload timestamp
- Actor identifier
- Previous active collection metadata
- Validation or normalisation warnings
Do not implement:

- Multipart parsing
- JSON parsing
- Upload validation
- S3 writing
- Manifest activation
- In-memory replacement
### 11. Reference Data Repository contract

Define the infrastructure-independent interface that later Persistence Module code will implement.

It should support future operations for:

- Reading a collection
- Writing a versioned collection
- Reading the active manifest
- Writing or replacing the active manifest
- Retrieving object metadata
- Determining whether an object exists
The contract must:

- Use internal domain types.
- Avoid AWS SDK request and response types.
- Avoid exposing an S3 client.
- Avoid database terminology.
- Support JSON and GeoJSON.
- Support future optimistic concurrency requirements.
- Be replaceable with a test double.
Do not implement the repository.

### 12. In-Memory Data Store contract

Define the interface that the future process-local in-memory store will implement.

It should support future operations for:

- Storing or atomically replacing one active collection
- Retrieving a collection
- Retrieving collection metadata
- Determining whether a collection is loaded
- Listing loaded datasets
- Removing a collection for controlled test or recovery scenarios
- Setting and retrieving the active manifest
- Clearing state for tests
The contract must not imply:

- Database persistence
- Cross-process consistency
- Redis
- Transactions
- Database queries
- Database indexes
Do not implement the in-memory store.

### 13. Authentication and authorisation contract

Define the internal contract owned by the Validation Module for future Authentication Service integration.

It should support:

- Token validation input
- Authenticated actor identity
- Permissions or roles
- Authentication outcome
- Authorisation outcome
- Authentication failure
- Authorisation failure
- Authentication Service unavailability
- Correlation propagation
Provisional permissions are:

Plain Text

```text
reference-data.read
reference-data.write
```
Keep these values centralised and easy to change if the Authentication Service uses different permission names.

Do not implement HTTP calls.

Do not include raw bearer tokens in result objects or errors.

### 14. Canonical-to-mobile projector contract

Define an interface for future mobile response projection.

The contract should:

- Accept a supported dataset.
- Accept canonical data.
- Accept optional projection context.
- Return JSON-compatible mobile data.
- Preserve GUID identifiers.
- Avoid persistence and transport concerns.
- Allow dataset-specific implementations.
Projection context may later include:

- Vessel length
- Country code
- Language code
- Other approved consumer context
Do not implement any mobile projector.

### 15. Common service-error contract

Define a service-level error model that can later be mapped to HTTP responses.

It should support:

- Stable error code
- Safe public message
- Dataset where applicable
- Structured details
- Retryable indicator
- Correlation or trace identifier
- Internal diagnostic cause that is excluded from public serialisation
- Optional recommended HTTP status if this follows repository conventions
Provide central error-code definitions for future categories including:

Plain Text

```text
invalid_request
invalid_dataset
invalid_json
unauthorized
forbidden
dataset_not_found
reference_item_not_found
map_layer_not_found
collection_version_exists
collection_modified
duplicate_identifier
duplicate_business_code
file_too_large
unsupported_media_type
schema_validation_failed
business_validation_failed
authentication_service_unavailable
reference_store_unavailable
reference_data_unavailable
internal_error
```
Do not implement the final Hapi error mapper.

Ensure internal causes and stack traces cannot be accidentally exposed by normal public serialisation.

## Contract design rules

### Infrastructure independence

Shared domain contracts must not import:

- AWS SDK types
- Floci-specific types
- Hapi request or response types
- HTTP-client response types
- MongoDB types
- Redis types
- Database-driver types
- ORM or ODM types
### Dependency direction

Concrete component implementations may depend on shared contracts.

Shared contracts must not depend on:

- Controllers
- Routes
- Hapi handlers
- AWS adapters
- Authentication adapters
- Concrete stores
- Concrete repositories
### Substitutability

External-boundary contracts must support:

- Unit-test fakes
- Unit-test mocks
- Local adapters
- Production implementations
Tests for this step must not require:

- Docker
- Floci
- AWS
- Authentication Service
- MongoDB
- Redis
- Any database
### Immutability

Prefer immutable or read-only properties where supported by the existing project language and conventions.

Do not add deep-cloning or deep-freezing behaviour in this step.

### Runtime and static contracts

If the repository uses JavaScript:

- Follow the existing JSDoc and module conventions.
- Use immutable constants and documented object shapes where appropriate.
- Do not convert the repository to TypeScript.
- Do not present JSDoc as runtime validation.
If the repository uses TypeScript:

- Use explicit types and interfaces.
- Prefer discriminated unions for dataset capabilities and result outcomes where useful.
- Avoid `any` .
- Use read-only properties where appropriate.
Runtime collection validation belongs to later steps.

### Naming

Use the agreed domain language consistently:

- Dataset
- Reference-data collection
- Collection metadata
- Manifest
- Canonical representation
- Mobile representation
- Business code
- GUID
- In-memory store
- Persistence repository
Avoid database-specific terms.

## File organisation

Adapt to the structure created in Step 02.

A possible organisation is:

Plain Text

```text
src/
  common/
    domain/
      datasets
      representations
      collections
      manifest
      validation
      query
      upload
      errors
    contracts/
      reference-data-repository
      in-memory-data-store
      authentication-client
      reference-data-projector
```
Do not force this structure if the repository already has an equivalent coherent convention.

Do not define the same contract in multiple component directories.

## Required tests

Add focused tests proving that:

1. All supported datasets are recognised.
2. Unknown dataset identifiers are rejected.
3. Uploadable datasets are classified correctly.
4. Queryable datasets are classified correctly.
5. Persisted datasets are classified correctly.
6. Derived datasets are classified correctly.
7. `map-ports` is queryable.
8. `map-ports` is derived.
9. `map-ports` is not uploadable.
10. `map-ports` is not independently persisted.
11. JSON and GeoJSON formats are correctly classified.
12. Canonical and mobile representations are recognised.
13. Unknown representation identifiers are rejected.
14. External-boundary contracts can be replaced by test doubles.
15. Public service-error serialisation contains only safe properties.
16. Internal diagnostic causes are not publicly serialised.
17. Shared modules can be imported without circular-dependency failures.
18. No test requires a database or external infrastructure.
Use the existing test framework and naming conventions.

Do not add Docker or integration tests in this step.

## Documentation requirements

Add or update concise documentation covering:

- Supported datasets
- Dataset capabilities
- Uploadable datasets
- Derived datasets
- Canonical and mobile representations
- GUID identity versus business identifiers
- Meaning of a complete reference-data collection
- External component contracts
- S3-compatible storage as durable persistence
- Process-local JSON objects as the cache
- Explicit absence of a database
- Explicit absence of Redis
Use the documentation location established by the repository. Avoid duplicate design documents.

## Security and privacy considerations

- Do not include raw access tokens in result contracts.
- Do not include AWS credentials in domain contracts.
- Keep internal diagnostic errors separate from public errors.
- Make rejected validation values optional.
- Do not expose internal S3 object references through public contracts by default.
- Treat actor identifiers as generic audit references.
- Do not include real vessel or production reference data in tests.
- Avoid exposing file-system paths, environment variables, credentials, or stack traces through service-error serialisation.
## In scope

- Shared dataset identifiers
- Dataset capability definitions
- Representation identifiers
- JSON-compatible type where useful
- Collection-envelope contract
- Collection-metadata contract
- Manifest contracts
- Validation contracts
- Query contracts
- Upload contracts
- Reference Data Repository interface
- In-Memory Data Store interface
- Authentication and authorisation interface
- Canonical-to-mobile projector interface
- Common service-error model
- Unit tests for constants, helpers, and safe-error behaviour
- Minimal contract documentation
## Out of scope

Do not implement:

- A database connection
- A database abstraction
- MongoDB
- Redis
- DynamoDB
- SQL persistence
- An ORM or ODM
- S3 client construction
- S3 repository implementation
- Floci bucket provisioning
- In-memory data-store implementation
- Authentication Service HTTP integration
- Hapi routes
- API handlers
- Canonical vessel schema
- Canonical gear schema
- Canonical port schema
- Canonical species schema
- GeoJSON schemas
- Runtime collection validation
- Dataset-specific validation
- Data normalisation
- Mobile projections
- Search or pagination logic
- Cache refresh
- Startup hydration
- Manifest API
- Upload parsing
- Atomic collection replacement
- Seed data
- OpenAPI definitions
- Deployment infrastructure
## Expected deliverables

1. Approved plan saved as:
Plain Text

```text
github-prompts/Step 03-define-shared-domain-types-and-contracts-plan.md
```
1. Central dataset definitions.
2. Dataset capability definitions.
3. Canonical and mobile representation definitions.
4. Shared collection and metadata contracts.
5. Manifest contracts.
6. Validation contracts.
7. Query contracts.
8. Upload contracts.
9. Infrastructure-independent repository contract.
10. In-memory store contract.
11. Authentication and authorisation contract.
12. Projection contract.
13. Safe service-error contract.
14. Focused unit tests.
15. Updated contract documentation.
## Acceptance criteria

This step is complete only when:

- The approved plan is saved before implementation begins.
- Supported datasets are centrally defined.
- Dataset capabilities are centrally defined.
- `map-ports` is explicitly derived and not uploadable.
- Canonical and mobile representations are centrally defined.
- Collection-envelope and metadata contracts exist.
- Manifest contracts exist.
- Validation contracts exist.
- Query contracts exist.
- Upload contracts exist.
- The Persistence Module has an infrastructure-independent repository interface.
- The In-Memory Data Store has a database-free interface.
- The Validation Module has an infrastructure-independent authentication interface.
- A canonical-to-mobile projection interface exists.
- A safe service-error contract exists.
- External-boundary contracts can be replaced with test doubles.
- Shared contracts do not import AWS SDK, Hapi, HTTP-client, database, or Redis types.
- No database connection or abstraction is introduced.
- MongoDB and Redis are not introduced.
- No S3 or Floci implementation is added.
- No Authentication Service integration is added.
- No API routes are added.
- No detailed dataset schemas are added.
- No business workflows from later steps are implemented.
- Unit tests pass.
- Linting passes.
- Formatting checks pass.
- Existing application startup remains functional.
- Documentation is updated.
## Verification

Inspect `package.json` and use the actual repository commands.

Run all applicable equivalents of:

Shell

```text
npm run lint
npm run format:check
npm test
npm run test:coverage
npm start
```
Do not add duplicate scripts when equivalent scripts already exist.

If a pre-existing failure is discovered:

1. Record the exact command.
2. Record the failure.
3. Determine whether the failure was introduced by this step.
4. Do not broaden the scope silently.
5. Ask for clarification when resolution requires unrelated work.
No database, Docker, Floci, S3, or Authentication Service testing is expected in this step.

## Final response requirements

After implementation, report:

1. Summary of completed work.
2. Saved plan-file path.
3. Files created.
4. Files modified.
5. Dataset capabilities defined.
6. Shared contracts introduced.
7. Tests added.
8. Commands executed and results.
9. Architectural boundaries preserved.
10. Confirmation that no database connection or abstraction was introduced.
11. Confirmation that MongoDB and Redis were not introduced.
12. Confirmation that no S3 implementation was added.
13. Confirmation that no Authentication Service implementation was added.
14. Work deferred to later steps.
15. Remaining assumptions, risks, or owner decisions.
If you reach any ambiguity, ask me to clarify.