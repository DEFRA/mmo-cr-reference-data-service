# Step 06: Configure Floci S3 Resources for Local Development

## Recommended reasoning effort

- **Planning phase:** High
- **Implementation phase:** Medium

## Copilot operating mode

Start in **Plan mode** .

Before modifying files, inspect the existing repository, including the approved outputs from previous implementation steps. Reuse existing conventions, configuration mechanisms, Docker Compose files, scripts, tests, and documentation where appropriate.

Do not assume the repository is empty.

After the plan is approved, the first implementation action must be to save the approved plan using this filename:

Plain Text

```text
github-prompts/Step 06-configure-floci-s3-resources-for-local-development-plan.md
```

Only after saving the approved plan may implementation begin.

## Objective

Configure as the local S3-compatible storage environment for the Reference Data Service.

The completed implementation must allow developers to:

- Start the local S3 emulator.
- Create the Reference Data Service bucket automatically.
- Enable the S3 behaviours required by the service.
- Load deterministic seed reference-data files.
- Inspect the local bucket and its objects.
- Reset local S3 data to a known state.
- Stop and restart the environment.
- Connect the Reference Data Service to the local S3 endpoint using the AWS SDK configuration established by the repository.
  This step configures local infrastructure and resources. It must not implement the complete Persistence Module or the Reference Data APIs.

## Architectural context

The Reference Data Service manages these reference-data domains:

- Vessels
- Gears
- Ports
- Species
- Map-location data, including statistical areas and supporting map collections
  Persistent reference-data collections will be stored as complete JSON or GeoJSON files in an AWS S3 bucket in deployed environments.

For local development, will provide the S3-compatible endpoint.

The following architecture rules must be preserved:

1. The **Persistence Module is the only application component permitted to communicate with S3** .
2. Local infrastructure may use the AWS CLI for provisioning, seeding, reset, and inspection.
3. Application modules must not call directly.
4. The application must use the normal AWS SDK S3 client configuration.
5. Environment-specific configuration determines whether the target is or AWS S3.
6. The local solution must use dummy credentials only.
7. Real AWS credentials must not be required for local development.
8. Reference-data collections are complete JSON or GeoJSON files.
9. Redis or another external cache must not be introduced.
10. The in-memory data store remains process-local and is outside this step.
11. Updates remain complete collection replacements rather than item-level mutations.

## Repository assessment

Before writing the plan, inspect the repository for:

- Existing Docker Compose files
- Existing , LocalStack, MinIO, or S3 emulator configuration
- Existing AWS SDK dependencies and configuration
- Existing environment files and templates
- Existing S3 bucket-name variables
- Existing AWS region variables
- Existing S3 endpoint variables
- Existing path-style addressing configuration
- Existing local-development scripts
- Existing seed-data directories
- Existing reference-data examples
- Existing test fixtures
- Existing infrastructure code
- Existing Makefile, task runner, or package scripts
- Existing CI workflows
- Existing developer documentation
- Existing `.gitignore` rules
- Existing container health checks
- Existing naming conventions for buckets and object keys
  Document discovered conventions in the plan and retain compatible implementations.

If another S3 emulator is already configured, explain the migration or coexistence strategy before making changes. Do not leave two competing local S3 configurations active without an explicit reason.

## Floci local endpoint

Configure the local S3-compatible endpoint as:

Plain Text

```text
http://localhost:4566
```

When the Reference Data Service runs inside Docker Compose, use the Compose service hostname instead:

Plain Text

```text
http://floci:4566
```

Do not hard-code either endpoint in application source code. Select the endpoint through environment configuration.

## Required local resources

Configure one local bucket for the Reference Data Service.

Use the existing repository naming convention if one is already established. Otherwise use:

Plain Text

```text
reference-data-local
```

The bucket must support:

- Complete JSON and GeoJSON collection objects
- Manifest objects
- Collection metadata
- Object metadata retrieval
- Object versioning
- Multiple immutable collection revisions
- Active collection manifest updates
  Enable bucket versioning if the repository and current version support it.

Configure public-access blocking where supported by the emulator. The local bucket must not be intentionally configured as public.

Do not add anonymous S3 access to make local development easier.

## Proposed object-key structure

Use an existing approved object-key convention if the repository already defines one.

Otherwise, establish this local seed structure:

Plain Text

```text
manifest/active.json

collections/vessels/{collection-version}.json
collections/gears/{collection-version}.json
collections/ports/{collection-version}.json
collections/species/{collection-version}.json

collections/map/land/{collection-version}.geojson
collections/map/statistical-areas/{collection-version}.geojson
```

The active manifest identifies the active object for each maintained dataset.

Do not create an independently maintained object for `map-ports` . The map-port projection will be derived from the active ports collection in a later implementation step.

If the current design uses a different approved key structure, retain it and document the difference in the plan.

## Local environment configuration

Add or align environment variables equivalent to:

Plain Text

dotenv isn’t fully supported. Syntax highlighting is based on Plain Text.

```text
AWS_REGION=eu-west-2
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test

REFERENCE_DATA_BUCKET=reference-data-local
REFERENCE_DATA_S3_ENDPOINT=http://localhost:4566
REFERENCE_DATA_S3_FORCE_PATH_STYLE=true
```

If the service executes inside Docker Compose, configure the container-specific endpoint as:

Plain Text

dotenv isn’t fully supported. Syntax highlighting is based on Plain Text.

```text
REFERENCE_DATA_S3_ENDPOINT=http://floci:4566
```

Adapt variable names to the repository's existing configuration schema rather than introducing duplicate variables.

Requirements:

- Dummy local credentials must not be reused in deployed environments.
- Real credentials must never be committed.
- `.env.example` may contain safe dummy local values.
- `.env` and generated local state must be ignored where appropriate.
- Production configuration must be able to omit the custom endpoint and use AWS S3.
- The implementation must not weaken deployed credential handling.
- Do not disable TLS validation globally.
- Do not introduce a production default that points to localhost.

## Docker Compose requirements

Use the repository's existing Compose filename and conventions.

Add a service equivalent to:

YAML

```text
services:
  floci:
    image: floci/floci:<pinned-version>
    ports:
      - "4566:4566"
    volumes:
      - floci-data:/app/data
```

The exact image name, image version, health-check mechanism, persistence path, and command must be verified against the dependency and repository versions in use.

Requirements:

- Pin the container image to a known version.
- Do not use an unpinned `latest` image.
- Expose port `4566` for host-based development.
- Add a health check supported by the selected image.
- Persist emulator state using a named volume or an approved project-local directory.
- Avoid mounting application secrets into the emulator.
- Configure dependent provisioning tasks to wait for emulator readiness.
- Avoid platform-specific shell behaviour where practical.
- Ensure the setup can run on developer machines and in CI where Docker is available.
  If the repository already uses separate Compose files for dependencies and applications, preserve that organisation.

## Automated bucket provisioning

Add an idempotent provisioning mechanism that:

1. Waits for to become ready.
2. Checks whether the configured bucket exists.
3. Creates the bucket only when it does not exist.
4. Enables bucket versioning.
5. Configures public-access blocking where supported.
6. Loads seed data only according to the selected startup policy.
7. Produces clear logs.
8. Returns a non-zero exit code when provisioning fails.
   The provisioning mechanism may use:

- A dedicated Compose initialisation service
- An existing repository task runner
- A shell script
- A TypeScript script
- The AWS CLI configured for the local endpoint
  Follow the repository's established scripting conventions.

Provisioning must be repeatable and must not fail simply because the bucket already exists.

Do not rely on a developer manually creating the bucket after every reset.

## Seed data

Create or reuse minimal deterministic seed collections for:

- Vessels
- Gears
- Ports
- Species
- Map land data
- Map statistical-area data
- Active manifest
  Seed files are local development fixtures, not authoritative production data.

Seed-data requirements:

- Use the canonical envelope currently approved by the project.
- Preserve GUID and business-code separation.
- Use valid GUIDs.
- Use deterministic values rather than generating different IDs on every run.
- Use fictional or safely reusable data.
- Do not include production personal data.
- Do not include credentials, tokens, or other secrets.
- Keep the files small enough for repository use.
- Use valid JSON.
- Use valid GeoJSON for map collections.
- Use WGS84 coordinates.
- Keep longitude before latitude in GeoJSON coordinate arrays.
- Ensure the active manifest points to the seeded objects.
- Ensure declared item and feature counts match actual contents.
- Ensure collection versions, checksums, and metadata are internally consistent when those values are required at this stage.
  If canonical schemas have not yet been finalised in the repository, create only the smallest fixtures needed by the currently approved contracts and document any deferred seed enrichment.

Do not invent unsupported legacy fields.

## Startup and seed policy

Define and document one deterministic seed policy.

The preferred behaviour is:

- Normal startup creates missing resources.
- Normal startup does not overwrite existing local objects.
- An explicit seed command uploads missing seed objects.
- An explicit reset command deletes local state, recreates resources, and reloads all seed data.
  Do not silently reset developer data during ordinary startup.

If the repository already has an approved reset convention, retain it.

## Local developer commands

Add commands using the repository's existing command mechanism.

Provide equivalents for:

Plain Text

```text
start local infrastructure
wait for Floci readiness
provision the local bucket
seed local reference data
list local buckets
list reference-data objects
download or inspect the active manifest
reset local reference-data storage
stop local infrastructure
remove local persisted state
```

Prefer package scripts, Make targets, or the repository's established task runner over long undocumented commands.

Raw AWS CLI examples may also be documented.

All AWS CLI calls to the emulator must explicitly use the local endpoint or a dedicated local profile. They must not accidentally target a real AWS account.

## Example AWS CLI operations

Adapt commands to the repository variables and scripts.

Bucket inspection should be equivalent to:

Shell

```text
aws \
  --endpoint-url http://localhost:4566 \
  --region eu-west-2 \
  s3api list-buckets
```

Object inspection should be equivalent to:

Shell

```text
aws \
  --endpoint-url http://localhost:4566 \
  --region eu-west-2 \
  s3api list-objects-v2 \
  --bucket reference-data-local
```

Manifest retrieval should be equivalent to:

Shell

```text
aws \
  --endpoint-url http://localhost:4566 \
  --region eu-west-2 \
  s3 cp \
  s3://reference-data-local/manifest/active.json \
  -
```

The documented developer workflow should use project scripts where available rather than requiring developers to remember these commands.

## Application integration boundary

This step may add or align configuration needed by the future Persistence Module, but must not implement the complete module.

It is acceptable to:

- Add typed local S3 configuration.
- Add a minimal S3 client factory if the repository architecture already requires one.
- Add a connectivity test isolated behind the persistence boundary.
- Add an interface-compatible development adapter if required by previous steps.
  It is not acceptable to:

- Add direct S3 calls to controllers.
- Add direct S3 calls to query or command modules.
- Add direct S3 calls to the in-memory data store.
- Add direct dependencies to domain logic.
- Add emulator-specific branches throughout application code.
- Implement the complete collection activation workflow.
  The local endpoint override must remain an infrastructure configuration detail.

## Testing requirements

Add automated verification appropriate to the repository.

At minimum, verify:

1. starts and becomes ready.
2. Provisioning creates the configured bucket.
3. Running provisioning twice succeeds.
4. Bucket versioning is enabled when supported.
5. Seed objects are uploaded.
6. The active manifest can be retrieved.
7. Seed object content can be retrieved.
8. A JSON object can be uploaded and downloaded.
9. Object metadata can be read.
10. Object replacement or additional object versions behave as expected.
11. The reset process restores deterministic seed data.
12. No real AWS credentials are required.
13. Local commands cannot accidentally use the default real AWS endpoint.
14. Tests clean up or isolate generated state.
    Use integration tests for behaviours that require the actual emulator.

Do not replace these tests with unit mocks, because this step exists to verify realistic S3-compatible behaviour.

Unit tests may still be used for scripts, configuration, and object-key construction.

## Security and privacy requirements

- Do not commit real AWS credentials.
- Do not require a developer's normal AWS profile for local execution.
- Use non-sensitive dummy credentials.
- Keep the local bucket non-public.
- Do not log credentials or complete sensitive object contents.
- Do not use production reference data as seed data without explicit approval.
- Do not disable security controls in shared or deployed configuration.
- Keep bound to local development usage.
- Document that local emulation does not replace security verification against deployed AWS infrastructure.
- Ensure generated emulator state is not committed accidentally.
- Review seed data for personal, regulated, or commercially sensitive information.

## Documentation requirements

Update the appropriate developer documentation with:

- Prerequisites
- Supported Docker version, if the repository enforces one
- AWS CLI prerequisites, if used
- How to start
- How the local bucket is created
- Bucket name
- Local endpoint
- Dummy credential configuration
- How to seed reference data
- How to inspect buckets and objects
- How to retrieve the active manifest
- How to reset local storage
- How to stop the environment
- How to remove persisted state
- How host execution differs from container execution
- Troubleshooting for port conflicts
- Troubleshooting for failed health checks
- Troubleshooting for incorrect endpoint configuration
- Troubleshooting for accidental real-AWS targeting
- Work intentionally deferred to later steps

## Explicit exclusions

Do not implement:

- The complete S3 Persistence Module
- Production S3 infrastructure
- AWS IAM policies
- Fargate deployment
- API Gateway deployment
- Complete cache loading
- Scheduled cache refresh
- Query API endpoints
- Manifest API endpoints
- Authentication Service integration
- Full collection upload endpoints
- Atomic collection activation
- Rollback orchestration
- Mobile response projections
- Item-level mutation endpoints
- Redis
- A second S3 emulator

## Required plan content

The plan must include:

1. Current repository state relevant to local infrastructure.
2. Existing S3 or emulator configuration discovered.
3. Existing scripts and conventions to preserve.
4. Selected image and pinned version.
5. Verified health-check approach.
6. Proposed Docker Compose changes.
7. Proposed provisioning mechanism.
8. Proposed local bucket name.
9. Proposed object-key structure.
10. Proposed seed-data structure.
11. Proposed startup and reset behaviour.
12. Application environment-variable changes.
13. Files to create.
14. Files to modify.
15. Files intentionally left unchanged.
16. Integration-test approach.
17. Documentation updates.
18. Security and privacy considerations.
19. Verification commands.
20. Risks, assumptions, and unresolved ambiguities.
21. Work explicitly deferred to later steps.

## Expected deliverables

- Approved plan saved as: Plain Text 1 github-prompts/Step 06-configure-floci-s3-resources-for-local-development-plan.md
- Docker Compose configuration.
- Pinned emulator image.
- Emulator health check.
- Idempotent local bucket provisioning.
- Local S3 bucket versioning configuration where supported.
- Safe local public-access configuration where supported.
- Deterministic seed collections.
- Active seed manifest.
- Seed command.
- Reset command.
- Inspection commands.
- Environment example updates.
- Integration tests.
- Developer documentation.
- Completion report.

## Acceptance criteria

- starts through the documented project command.
- The S3-compatible endpoint is available on port `4566` .
- The Reference Data Service local bucket is created automatically.
- Provisioning is idempotent.
- Bucket versioning is enabled where supported.
- Public access is not intentionally enabled.
- The active manifest exists.
- Seeded vessel, gear, port, species, land, and statistical-area objects exist.
- Seed objects are readable using the AWS CLI and the configured application S3 client.
- Seed data uses deterministic GUIDs.
- GUIDs remain separate from business codes.
- GeoJSON seed files are valid and use WGS84 longitude-first coordinates.
- Normal startup does not overwrite existing developer data.
- Reset restores known seed data.
- No real AWS account or credentials are needed.
- Local dummy credentials are not usable as deployed defaults.
- The custom S3 endpoint is controlled through environment configuration.
- Container-based application execution uses the `floci` service hostname.
- Host-based application execution uses `localhost` .
- Only the persistence boundary is positioned to use the application S3 client.
- No Redis dependency is introduced.
- No item-level mutation API is introduced.
- Integration tests pass.
- Existing unit tests, linting, type checking, and build commands continue to pass.
- Developer documentation accurately describes the resulting workflow.

## Verification

Use the repository's actual package manager and scripts.

Run the applicable equivalents of:

Plain Text

```text
install dependencies
run type checking
run linting
run unit tests
start Floci
verify Floci health
provision the local bucket
provision the local bucket a second time
seed reference-data objects
list the bucket
list objects recursively
retrieve the active manifest
retrieve one JSON collection
retrieve one GeoJSON collection
upload and retrieve a test object
inspect object metadata
verify bucket versioning
run local S3 integration tests
reset local storage
verify deterministic seed restoration
stop the local environment
run the complete repository test suite
```

Record the exact commands and results in the completion report.

If a requested capability differs from the version selected by the repository:

1. Verify the supported behaviour.
2. Document the limitation.
3. Propose the smallest compatible alternative.
4. Do not silently switch to another emulator.
5. Ask for clarification if the limitation materially changes the agreed design.

## Completion response

Provide a concise implementation report containing:

- Repository state discovered
- version used
- Files created
- Files modified
- Bucket name
- Object-key structure
- Seed collections created
- Environment variables added or changed
- Local commands added
- Tests added
- Verification commands and results
- Security and privacy considerations
- Existing issues not introduced by this step
- Work deferred to later steps
- Remaining risks or decisions requiring owner input
  if you reach any ambiguity ask me to clarify
