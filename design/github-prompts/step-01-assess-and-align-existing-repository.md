ARTIFACT-INSTRUCTION
artifact_type: github-copilot-prompt
target_folder: github-prompts
filename: step-01-assess-and-align-existing-repository.md
mode: plan-then-implement
ARTIFACT-INSTRUCTION-END

ARTIFACT-CONTENT

# Step 01: Assess and align the existing repository

## Recommended reasoning effort

- **Planning phase:** High
- **Implementation phase:** Medium

## Copilot operating mode

Start in **Plan mode**.

Before changing any source file, inspect the repository thoroughly and produce a concrete implementation plan based on what actually exists. Do not assume the repository is empty, do not replace working conventions without justification, and do not begin implementation until the plan has been reviewed and approved.

After the plan is approved, your **first implementation action** must be to save the approved plan as:

```text
github-prompts/Step 01-assess-and-align-existing-repository-plan.md
```

Only after saving the approved plan may implementation begin.

## Context

This repository will contain the **Reference Data Service** for the Catch Recording application. The service is a backend API responsible for access to and management of these reference-data domains only:

- Vessels
- Gears
- Ports
- Species
- Map-location data, including statistical areas and any required supporting map collections

The agreed target architecture is a Node.js and Hapi.js service intended to run in AWS Fargate behind AWS API Gateway.

The agreed C4 Level 3 component boundaries are:

- Reference Data Controller
- Validation Module
- Query Module
- Command Module
- Data Normalisation Module
- Persistence Module
- Cache Refresh Module
- In-Memory Data Store

External dependencies are:

- Authentication Service
- AWS S3 Reference Data Store
- API Gateway
- Catch Recording Service as an API consumer

The following constraints are architectural rules:

1. The **Persistence Module is the only component allowed to access S3**.
2. The **Validation Module is the only component allowed to call the Authentication Service**.
3. Canonical reference-data schemas should remain aligned with the legacy schemas wherever practical.
4. Every reference-data entity must use an existing or assigned GUID/UUID as its stable technical identifier.
5. Business identifiers such as CFR, FAO code, gear code, and port code must remain separate from GUIDs.
6. Map-location data is the principal new reference-data domain not clearly represented by the legacy schema.
7. Mobile API responses are projections of canonical data, not separately maintained data collections.
8. S3 stores complete JSON or GeoJSON reference-data collection files for persistence.
9. The service uses process-local JSON objects as an in-memory data store. Redis is not available and must not be introduced.
10. Updates are limited to uploading and atomically replacing a complete reference-data collection.
11. Item-level create, update, patch, and delete endpoints are outside scope.
12. Invalid or interrupted uploads must not replace the currently active collection.

## Objective

Assess the current repository and align its foundations with the agreed Reference Data Service architecture, while preserving useful existing code, tooling, conventions, and delivery configuration.

This step is primarily a repository-discovery and foundation-alignment task. It must leave the repository in a clear, buildable, testable state that is ready for later implementation steps, without prematurely implementing the complete Reference Data Service.

## Required planning analysis

Inspect the complete repository before proposing changes. At minimum, assess the following areas when present:

### Repository structure

- Top-level directories and files
- Application source layout
- Existing module boundaries
- Test directories and fixtures
- Scripts and developer utilities
- Documentation and architecture assets
- Infrastructure and deployment directories
- Generated files and ignored files

### Node.js and TypeScript foundation

- `package.json` scripts and dependencies
- Package manager and lock file
- Node.js runtime version
- TypeScript configuration
- Module system, such as ESM or CommonJS
- Path aliases
- Build output conventions
- Runtime entry points
- Hapi.js version and server bootstrap

### Existing quality tooling

- Linting
- Formatting
- Type checking
- Unit-test framework
- Integration-test framework
- Code coverage
- Pre-commit hooks
- Commit checks
- CI workflows

### Runtime and configuration

- Environment-variable handling
- Configuration schema and validation
- Logging
- Error handling
- Health and readiness endpoints
- Graceful startup and shutdown
- Docker and Docker Compose
- Local AWS or S3 emulation

### Existing domain implementation

- Reference-data routes
- Controllers or handlers
- Query logic
- Command or upload logic
- Validation logic
- Authentication integration
- S3 access
- In-memory caching
- Normalisation
- Schemas and data models
- Existing JSON or GeoJSON fixtures

### Delivery and operations

- Dockerfile
- Fargate, ECS, API Gateway, or other AWS configuration
- Infrastructure as code
- CI/CD workflows
- Security scanning
- Dependency scanning
- Secret handling
- Observability configuration

## Plan requirements

The plan must include:

1. A concise summary of the repository's current state.
2. A list of relevant technologies and versions detected from repository files.
3. Existing conventions that should be retained.
4. Gaps against the agreed Reference Data Service architecture.
5. Conflicts or risks that require resolution.
6. A proposed target folder and module structure that adapts to the repository rather than blindly replacing it.
7. An explicit list of files to create, modify, move, or leave unchanged.
8. A minimal implementation sequence for this step.
9. Verification commands that use the repository's actual package manager and scripts.
10. Assumptions and unresolved ambiguities.
11. A statement of what is deliberately deferred to later steps.

If a requested capability already exists and is suitable, retain it and document that decision rather than recreating it.

## Implementation scope after plan approval

After the plan is approved and saved, implement only the repository-alignment work justified by the assessment. Depending on the repository's actual state, this may include:

- Correcting or completing the Node.js and TypeScript project configuration.
- Aligning the Hapi.js server bootstrap with existing conventions.
- Establishing clear top-level component folders or module boundaries for the agreed C4 Level 3 components.
- Adding minimal placeholder module entry points or interfaces where needed to establish boundaries.
- Correcting essential package scripts for build, start, development, type checking, linting, and tests.
- Adding or correcting health and readiness endpoints if they are foundational and absent.
- Adding central configuration loading and startup validation only to the minimum degree needed for a reliable foundation.
- Adding structured logging and graceful shutdown only when absent or materially incomplete.
- Updating repository documentation to explain the project structure and development commands.
- Adding minimal unit tests that prove the service foundation starts and the health endpoints behave correctly.

Prefer small, targeted changes over a broad rewrite.

## Explicit exclusions

Do not implement the following in this step unless a minimal adapter is absolutely necessary to preserve compilation of existing code:

- Complete vessel, gear, port, species, or map schemas
- Full canonical collection validation
- Mobile response projections
- S3 persistence behaviour
- LocalStack integration
- Cache refresh scheduling
- Full in-memory collection management
- Authentication Service integration
- Search algorithms
- Full collection upload and atomic activation
- Manifest API behaviour
- OpenAPI coverage for the complete service
- AWS deployment infrastructure
- Item-level mutation endpoints
- Redis or any external cache

Existing implementations in these areas must be assessed and documented, but must not be casually rewritten as part of repository alignment.

## Target architectural boundaries

Use names compatible with the repository's existing naming style, but preserve these logical responsibilities:

```text
Reference Data Controller
  -> receives HTTP/API requests and maps them to use cases

Validation Module
  -> validates request structure and business inputs
  -> is the sole integration point with the Authentication Service

Query Module
  -> retrieves full collections and search results
  -> reads from the In-Memory Data Store

Command Module
  -> coordinates full collection validation and replacement

Data Normalisation Module
  -> converts inbound collections into canonical representations
  -> generates consumer-specific response projections when required

Persistence Module
  -> is the sole integration point with S3

Cache Refresh Module
  -> compares persisted metadata and refreshes changed in-memory collections

In-Memory Data Store
  -> stores parsed, normalised JSON objects and collection metadata in process memory
```

Do not introduce direct imports from business modules to concrete AWS SDK clients or Authentication Service clients.

## Repository alignment rules

- Preserve the detected package manager and lock file.
- Preserve the existing module system unless there is a demonstrated blocker.
- Preserve compatible testing and linting frameworks.
- Avoid upgrading unrelated dependencies.
- Do not remove existing functionality without documenting the reason and obtaining approval in the plan.
- Do not rename public routes or exported APIs merely for stylistic consistency.
- Do not create duplicate configuration, logging, error, or server-bootstrap mechanisms.
- Keep production source code free from hard-coded credentials and environment-specific values.
- Do not add speculative abstractions that are not required to establish the agreed component boundaries.
- Keep commits and changes focused on this step.

## Expected deliverables

1. The saved approved plan:

   ```text
   github-prompts/Step 01-assess-and-align-existing-repository-plan.md
   ```

2. A repository assessment captured in the saved plan or an existing appropriate design/documentation location.
3. A buildable and testable repository foundation.
4. A source structure aligned with the agreed components, adapted to existing repository conventions.
5. Corrected or completed developer scripts where required.
6. Minimal foundational tests.
7. Updated developer documentation with exact setup and verification commands.
8. A final implementation summary listing:
   - Files created
   - Files modified
   - Files deliberately left unchanged
   - Commands executed
   - Test results
   - Deferred work
   - Remaining risks or ambiguities

## Acceptance criteria

- The existing repository has been inspected before implementation begins.
- The approved plan is saved before any implementation change is made.
- The solution uses the repository's detected package manager and conventions.
- The project installs and builds successfully using documented commands.
- Type checking succeeds.
- Linting succeeds, or pre-existing failures are clearly separated from newly introduced failures.
- Foundational tests succeed.
- The Hapi.js service starts successfully when the repository is intended to contain a runnable service at this stage.
- Health and readiness behaviour is documented and tested when present or added.
- The agreed logical component boundaries are visible in the repository structure or explicitly mapped to the existing structure.
- Only the Persistence Module is positioned to access S3.
- Only the Validation Module is positioned to access the Authentication Service.
- No Redis dependency is introduced.
- No item-level reference-data mutation API is introduced.
- Existing useful functionality is preserved.
- No complete business capability from later implementation steps is unnecessarily implemented.
- Documentation accurately reflects the resulting repository, not an assumed target state.
- The final summary reports all verification results and any unresolved issues.

## Verification

Determine the exact commands from the repository. Run the applicable equivalents of:

```text
install dependencies
build
run type checking
run linting
run unit tests
start the service
call health endpoint
call readiness endpoint
```

Do not invent command names when the repository already defines them. If a command is missing and should be added in this step, explain the addition in the plan.

When verification reveals a pre-existing failure outside the approved scope:

1. Record the exact failing command.
2. Identify the likely pre-existing cause.
3. Explain whether the failure blocks this step.
4. Do not broaden the implementation silently.

## Completion response

At completion, provide a concise report containing:

- Repository state discovered
- Architectural alignment performed
- Files changed
- Verification commands and results
- Existing issues not caused by this implementation
- Work deferred to subsequent steps
- Any decision that still needs owner input

if you reach any ambiguity ask me to clarify
ARTIFACT-CONTENT-END
