# Step 02: Establish the Service Structure and Configuration

## Recommended reasoning effort

- Planning phase: High
- Implementation phase: High

## Role

Act as a senior Node.js backend engineer working on the Reference Data Service.

The service provides access to and management of reference data used by the Catch Recording application.

This step establishes the service architecture and configuration foundation. It must not implement the business functionality assigned to later steps.

## Required working mode

Start in plan mode.

Before modifying any files:

1. Inspect the complete repository structure.
2. Read the existing `README.md` .
3. Read `package.json` and identify the available scripts and dependencies.
4. Read `Dockerfile` .
5. Read `compose.yml` .
6. Read `compose/aws.env` .
7. Inspect the existing `src` structure, including:

- `src/common`
- `src/plugins`
- `src/routes`
- `src/services`
- `src/config.js`
- `src/index.js`
- `src/server.js`

8. Inspect the existing test structure and test conventions.
9. Inspect the Floci configuration and startup scripts under `compose/floci` .
10. Identify the repository conventions for:

- Hapi plugins
- Route registration
- Configuration validation
- Logging
- Dependency injection
- Unit testing
- Linting
- Formatting
- Error handling

11. Identify functionality supplied by the platform template that should be reused instead of duplicated.
12. Identify any conflict between this prompt and the current repository.
    Do not implement changes during the planning phase.

Present a file-by-file implementation plan and wait for approval before beginning implementation.

After the plan is approved, the first implementation action must be to save the approved plan as:

Plain Text

```text
github-prompts/Step 02-establish-service-structure-and-configuration-plan.md
```

Do not begin source-code modifications until that plan file has been created.

## Project context

The Reference Data Service is a Node.js and Hapi backend service.

The service will manage the following reference-data domains:

- Vessels
- Gears
- Ports
- Species
- Map-location data
- Statistical-area data
  The agreed architecture contains these internal components:

- Reference Data Controller
- Validation Module
- Query Module
- Command Module
- Data Normalisation Module
- In-Memory Data Store
- Cache Refresh Module
- Persistence Module
  External integrations are:

- API Gateway
- Catch Recording Service
- Authentication Service
- S3-compatible Reference Data Store
  The current repository already contains Docker-based local development infrastructure.

Floci is already configured as the local AWS emulator and provides an S3-compatible endpoint. Do not introduce LocalStack, MinIO, or another AWS emulator.

## Architectural constraints

The implementation must preserve the following constraints.

### Component ownership

- Only the Validation Module may communicate directly with the Authentication Service.
- Only the Persistence Module may communicate directly with AWS S3 or Floci.
- The Query Module must not access S3 directly.
- The Command Module must not access S3 directly.
- The Cache Refresh Module must access persisted data through the Persistence Module.
- Controllers must coordinate HTTP requests and responses but must not contain business logic.

### Persistence and caching

- JSON reference-data collections will be persisted in S3-compatible object storage.
- Active collections will be stored as JSON objects in application memory.
- The in-memory store is not implemented in this step.
- Redis must not be used for the reference-data cache.
- MongoDB must not be introduced as reference-data persistence.
- Redis and MongoDB template infrastructure (config, plugin, compose services, example route/service) were already removed in Step 01 as an approved deviation from the master plan's original Step 29 sequencing; this step must not assume they still exist.

### Data design

- Canonical schemas will be based on the legacy reference-data schemas where possible.
- Existing UUIDs must be preserved.
- API resource identifiers will use GUIDs.
- Regulatory and business codes remain separate from GUIDs.
- Map-location data is the primary new reference-data domain.
- Canonical schemas, normalisation, query behaviour, and upload behaviour belong to later steps and must not be implemented here.

## Objective

Create a clean, testable module structure and a central validated configuration foundation for the Reference Data Service.

The result must allow later implementation steps to add business behaviour without restructuring the application.

## Scope

### 1. Establish component directories and module entry points

Create or align the source structure for these components:

- Reference Data Controller
- Validation Module
- Query Module
- Command Module
- Data Normalisation Module
- In-Memory Data Store
- Cache Refresh Module
- Persistence Module
  Use the repository’s established JavaScript, Hapi, naming, export, plugin, and testing conventions.

Prefer a structure that makes architectural ownership explicit while avoiding unnecessary layers.

Each component should have a minimal entry point or module contract sufficient to establish its boundary.

Do not add placeholder methods that falsely suggest completed business functionality.

Do not add speculative abstractions that are not required to establish the architecture.

### 2. Preserve application composition

Ensure the existing Hapi application can compose and register the new module structure.

Preserve:

- Application startup
- Server creation
- Existing health behaviour
- Existing logging conventions
- Existing plugin-registration conventions
- Graceful startup and shutdown behaviour
- Development and production entry points
  Do not break the existing Dockerfile, npm scripts, or local development commands.

### 3. Centralise configuration

Create or refine a single configuration layer for the Reference Data Service.

The configuration must cover, where applicable:

Plain Text

```text
PORT
NODE_ENV
AWS_REGION
AWS_DEFAULT_REGION
AWS_ENDPOINT_URL
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
REFERENCE_DATA_BUCKET
S3_FORCE_PATH_STYLE
AUTHENTICATION_SERVICE_URL
REFERENCE_DATA_REFRESH_INTERVAL_MS
REFERENCE_DATA_MAX_UPLOAD_BYTES
LOG_LEVEL
```

Follow repository conventions if equivalent variable names already exist.

Do not rename existing environment variables unnecessarily.

### 4. Distinguish required and optional configuration

Define which variables are:

- Required in all environments
- Required only in deployed environments
- Required only when a related feature is enabled
- Optional because the AWS SDK can resolve them through its normal provider chain
- Local-development overrides
  Expected principles:

- `PORT` must have a safe repository-compatible default if that matches the existing template.
- AWS region must be available.
- `REFERENCE_DATA_BUCKET` must be explicit.
- `AWS_ENDPOINT_URL` is expected for local Floci usage but must not be required in deployed AWS environments.
- Static AWS test credentials may be used locally through `compose/aws.env` .
- Static AWS credentials must not be required or embedded for deployed environments.
- `S3_FORCE_PATH_STYLE` should be configurable for S3-compatible local development.
- Authentication Service configuration should exist even though the integration is implemented later.
- Refresh and upload settings must use safe positive numeric values.

### 5. Validate configuration at startup

Add deterministic validation for configuration values.

Validation must cover, as appropriate:

- Required values
- Valid port range
- Valid URLs
- Positive upload limits
- Positive refresh intervals
- Supported runtime environments
- Boolean parsing
- Non-empty bucket names
- AWS region availability
  Invalid mandatory configuration must prevent service startup and produce a useful, non-sensitive error.

Do not log:

- AWS secret access keys
- Access tokens
- Credentials
- Complete environment dumps

### 6. Support host and container development

Account for the difference between:

Plain Text

```text
http://localhost:4566
```

when the service runs directly on the host, and a Docker-network endpoint such as:

Plain Text

```text
http://floci:4566
```

when the service runs inside Docker Compose.

Do not hard-code either endpoint in application logic.

The endpoint must come from environment configuration.

Review the current Compose configuration and make only the changes needed to pass appropriate values to the service.

Do not provision the S3 bucket in this step. Floci bucket initialisation belongs to a later implementation step.

### 7. Add configuration documentation

Update the relevant environment or README documentation with:

- Variable name
- Purpose
- Whether the variable is required
- Safe local example
- Behaviour in deployed AWS environments
- Whether the value is sensitive
  Do not include real secrets.

If an example environment file is appropriate under repository conventions, create or update one without including secret production values.

### 8. Add focused tests

Add tests for:

- Valid local configuration
- Valid deployed configuration without a custom AWS endpoint
- Missing required configuration
- Invalid port
- Invalid URL
- Invalid boolean value
- Invalid refresh interval
- Invalid upload limit
- Sensitive values not appearing in validation errors
- Successful composition or loading of component entry points
  Follow the repository’s existing Vitest and test-fixture conventions.

Tests must not require Docker, Floci, AWS, MongoDB, Redis, or the Authentication Service.

## Suggested component responsibilities

Use these responsibilities to establish boundaries, but do not implement the associated business behaviour during this step.

### Reference Data Controller

Future responsibility:

- Register routes.
- Accept inbound API requests.
- Map requests to use cases.
- Map use-case results to HTTP responses.

### Validation Module

Future responsibility:

- Perform structural validation.
- Perform business validation.
- Integrate with the Authentication Service.
- Apply authorisation rules.

### Query Module

Future responsibility:

- Retrieve full collections.
- Search and filter collections.
- Produce canonical and mobile responses.

### Command Module

Future responsibility:

- Coordinate full collection validation and replacement.
- Coordinate persistence and cache activation.

### Data Normalisation Module

Future responsibility:

- Convert inbound data into canonical structures.
- Produce mobile response projections where appropriate.

### In-Memory Data Store

Future responsibility:

- Hold normalised active collections as in-memory JSON objects.
- Hold manifest and collection metadata.

### Cache Refresh Module

Future responsibility:

- Compare persisted metadata.
- Reload collections when persisted files change.

### Persistence Module

Future responsibility:

- Own all direct AWS SDK and S3-compatible storage access.
- Read and write reference-data files and manifest metadata.

## Expected configuration shape

Use the repository’s conventions and avoid forcing this exact object structure if a better established pattern already exists.

The resulting configuration should make equivalent information clearly available:

Plain Text

```text
server
  port
  environment

aws
  region
  endpointUrl
  forcePathStyle

referenceData
  bucket
  refreshIntervalMs
  maxUploadBytes

authentication
  serviceUrl

logging
  level
```

AWS credentials do not need to be copied into the exported application configuration if the AWS SDK can consume them securely through its standard credential provider chain.

## In scope

- Repository inspection
- Component folder structure
- Minimal component entry points
- Application composition
- Configuration loading
- Configuration validation
- Safe environment parsing
- Environment documentation
- Focused configuration tests
- Focused component-loading tests
- Minimal Compose updates required to pass configuration

## Out of scope

Do not implement:

- S3 clients
- S3 repositories
- Floci bucket creation
- Collection schemas
- Vessel, gear, port, species, or map models
- Reference-data validation rules
- Data normalisation
- In-memory collection storage
- Cache refresh behaviour
- Authentication Service HTTP calls
- Authorisation decisions
- Query logic
- Search logic
- API endpoints for reference data
- Manifest endpoints
- Upload endpoints
- Mobile response projections
- OpenAPI contracts
- Seed data
- MongoDB or Redis removal
- Unrelated repository refactoring

## Implementation rules

1. Use the existing runtime and module system.
2. Do not convert the project between JavaScript and TypeScript.
3. Do not replace Hapi.
4. Do not change the Node.js version.
5. Do not introduce a new configuration library unless the repository has no acceptable configuration-validation mechanism and the dependency is justified in the approved plan.
6. Reuse existing CDP or repository conventions where possible.
7. Keep configuration parsing deterministic.
8. Keep component dependencies explicit.
9. Avoid circular imports.
10. Avoid global mutable state.
11. Do not introduce AWS SDK imports outside the future Persistence Module.
12. Do not introduce Authentication Service clients outside the future Validation Module.
13. Do not create false implementations that return dummy production data.
14. Do not add database-backed persistence.
15. Do not add Redis caching.
16. Do not add LocalStack or MinIO.
17. Keep modifications limited to this step.
18. Preserve backward compatibility with current health and startup behaviour unless the approved plan explains an essential change.

## Security considerations

- Never commit production credentials.
- Never print environment variables indiscriminately.
- Never include secret values in configuration-validation errors.
- Treat Authentication Service URLs and AWS endpoints as configuration.
- Validate URLs before use.
- Validate numeric limits to reduce denial-of-service risks.
- Define a conservative upload-size default.
- Keep local test credentials clearly separated from deployed configuration.
- Prepare configuration boundaries for least-privilege AWS access in later steps.

## Expected deliverables

The implementation should produce:

1. A clear module structure representing all agreed C4 Level 3 components.
2. Minimal entry points for those components.
3. Central configuration loading and validation.
4. Local and deployed AWS configuration support.
5. Authentication Service configuration.
6. Reference-data bucket configuration.
7. Cache refresh and upload-limit configuration.
8. Updated configuration documentation.
9. Unit tests for configuration behaviour.
10. Tests proving the component structure can be loaded.
11. An approved plan saved at:
    Plain Text

```text
github-prompts/Step 02-establish-service-structure-and-configuration-plan.md
```

## Verification commands

Determine the exact commands from `package.json` , then run all relevant checks.

These are expected to include equivalents of:

Shell

```text
npm run lint
npm run format:check
npm test
```

If the repository uses different script names, use the existing names rather than adding duplicate scripts without need.

Also verify that the application starts with valid local configuration.

Do not claim that Docker or Floci integration has been tested unless the relevant Docker command has actually been executed successfully.

## Completion criteria

This step is complete only when:

- The approved plan has been saved in the required location.
- The source structure represents all agreed internal components.
- Component boundaries are clear.
- The Hapi application still starts successfully.
- Configuration is loaded from environment variables.
- Mandatory configuration is validated at startup.
- Invalid mandatory configuration fails with a useful and safe error.
- Local Floci endpoint configuration is supported.
- Deployed AWS configuration does not require a custom endpoint.
- No credentials or tokens are logged.
- No S3 integration has been implemented outside the Persistence Module.
- No Authentication Service integration has been implemented outside the Validation Module.
- No later-step business functionality has been implemented.
- Unit tests pass.
- Linting passes.
- Formatting checks pass.
- Existing tests continue to pass.
- Documentation explains the relevant configuration.

## Final response requirements

After implementation, provide:

1. A concise summary of the completed work.
2. A list of created files.
3. A list of modified files.
4. A summary of configuration decisions.
5. A list of commands executed.
6. Test, lint, and formatting results.
7. Any assumptions made.
8. Any unresolved decisions or risks.
9. Confirmation that no later-step functionality was implemented.
10. Confirmation that the approved plan was saved in the required location.
    If you reach any ambiguity, ask me to clarify.
