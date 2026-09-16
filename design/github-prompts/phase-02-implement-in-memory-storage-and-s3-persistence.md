# Implement Phase 2: In-Memory Storage and S3-Compatible Persistence

## Recommended reasoning effort

- Planning phase: High
- Implementation phase: High

## Role

Act as a senior Node.js backend engineer implementing Phase 2 of the Reference Data Service.

Phase 2 consists exclusively of:

- Step 05: Implement the In-Memory Data Store
- Step 06: Configure Floci S3 resources for local development
- Step 07: Implement the Persistence Module
  Follow the existing approved prompts for Steps 05, 06, and 07 as the authoritative implementation instructions.

Do not replace, rewrite, reinterpret, combine, or expand those prompts.

## Objective

Complete Phase 2 by executing the approved Step 05, Step 06, and Step 07 prompts in sequence.

Each step must retain:

- Its original objective
- Its original scope
- Its original exclusions
- Its original deliverables
- Its original dependencies
- Its original tests
- Its original completion criteria
- Its original architecture constraints
- Its original plan-file requirement
  This phase prompt coordinates the work. It does not override the three individual step prompts.

## Required source documents

Before planning or implementation, locate and read:

Plain Text

```text
github-prompts/step-05-implement-in-memory-data-store.md
github-prompts/step-06-configure-floci-s3-resources-for-local-development.md
github-prompts/step-07-implement-persistence-module.md
```

Also locate and read the approved plan files if they already exist:

Plain Text

```text
github-prompts/Step 05-implement-in-memory-data-store-plan.md
github-prompts/Step 06-configure-floci-s3-resources-for-local-development-plan.md
github-prompts/Step 07-implement-persistence-module-plan.md
```

Use the actual filenames present in the repository if their letter casing differs.

If any Step 05, Step 06, or Step 07 implementation prompt is missing:

1. Stop.
2. Report the missing file.
3. Do not reconstruct or guess its contents.
4. Ask me to provide or regenerate the missing prompt.
   If an existing approved step plan conflicts with its corresponding implementation prompt:

5. Stop before implementation.
6. Identify the exact conflict.
7. Do not choose one interpretation silently.
8. Ask me to clarify which instruction is authoritative.

## Approved plan protection

The Reference Data Service implementation plan is locked.

Do not:

- Change the plan
- Reorder the steps
- Merge the steps
- Split the steps
- Add new implementation steps
- Move work between steps
- Defer step-specific tests to a later phase
- Expand Phase 2 into later functionality
- Reimplement completed Steps 01 through 04
  If a deviation appears necessary:

1. Identify the exact problem.
2. Identify the affected step.
3. Explain why the approved prompt cannot be followed.
4. Propose the smallest possible deviation.
5. Explain the consequences.
6. Wait for my explicit approval.
   Do not apply a deviation without consent.

## Required working mode

Start in Plan mode.

Before proposing Phase 2 work:

1. Inspect the complete repository.
2. Read the approved Reference Data Service implementation plan.
3. Inspect the implementation completed through Step 04.
4. Read the Step 05, Step 06, and Step 07 prompts in full.
5. Inspect the current Git working tree:
   Shell

```text
git status --short
git diff --stat
```

1. Determine whether Step 05, Step 06, or Step 07 has already been partially or fully implemented.
2. Review existing plans, commits, source files, tests, and documentation before deciding the current starting point.
3. Do not repeat completed work.
4. Do not assume a step is complete solely because files with matching names exist.
5. Verify completion against the acceptance criteria in the corresponding step prompt.
   Produce a concise Phase 2 execution plan showing:

- Current repository state
- Current completion status of Step 05
- Current completion status of Step 06
- Current completion status of Step 07
- Steps that still require implementation
- Required execution order
- Test and verification gate for each step
- Files expected to be affected by each step
- Any ambiguity or conflict discovered
  Wait for approval before modifying source files.

After the Phase 2 execution plan is approved, save it as:

Plain Text

```text
github-prompts/Phase 02-in-memory-storage-and-s3-persistence-plan.md
```

Saving the phase execution plan does not replace the plan-file requirements defined by the individual step prompts.

## Execution sequence

Execute the phase in this exact order:

1. Step 05
2. Step 06
3. Step 07
   Do not begin a later step until the preceding step has passed its completion gate.

## Step 05 execution

Execute:

Plain Text

```text
github-prompts/step-05-implement-in-memory-data-store.md
```

Follow the Step 05 prompt exactly.

Step 05 must implement only the approved In-Memory Data Store scope, including:

- Canonical collection storage
- Complete collection retrieval
- Collection metadata retrieval
- Loaded-state checks
- Atomic per-dataset replacement
- Controlled collection removal
- Active manifest storage and retrieval
- Loaded dataset listing
- Test-oriented clear operation
- Defensive data access
- Unit tests for every store operation
  Step 05 must not implement:

- S3 access
- Floci configuration
- Persistence Module behaviour
- Cache hydration
- Cache refresh
- Authentication
- API routes
- Querying
- Validation
- Normalisation
- Upload behaviour
- Database connectivity
- Redis

### Step 05 completion gate

Before continuing to Step 06:

1. Confirm the Step 05 approved plan was saved.
2. Run Step 05 tests.
3. Run the complete unit-test suite.
4. Run test coverage.
5. Run linting.
6. Run formatting checks for Step 05 files.
7. Confirm the In-Memory Data Store acceptance criteria pass.
8. Confirm no S3 or Floci functionality was implemented.
9. Confirm no database or Redis functionality was added.
10. Produce a concise Step 05 completion report.
    If Step 05 fails its completion gate, stop and resolve only Step 05 issues.

Do not begin Step 06 while Step 05 remains incomplete.

## Step 06 execution

Execute:

Plain Text

```text
github-prompts/step-06-configure-floci-s3-resources-for-local-development.md
```

Follow the Step 06 prompt exactly.

Step 06 must configure the repository’s existing Floci environment for local S3-compatible storage.

It must not introduce:

- LocalStack
- MinIO
- Another S3 emulator
- A database
- Redis
- Persistence Module implementation
- Cache hydration
- Cache refresh
- Authentication
- API routes
- Upload workflows
  Step 06 must use the object-key convention approved by the implementation plan and the Step 06 prompt.

### Step 06 completion gate

Before continuing to Step 07:

1. Confirm the Step 06 approved plan was saved.
2. Confirm the local reference-data bucket is created idempotently.
3. Confirm repeated Floci startup does not fail.
4. Confirm the service container can address Floci through the Docker network.
5. Confirm host-run configuration can address Floci through the host endpoint.
6. Run all Step 06 tests and verification commands.
7. Run the complete unit-test suite.
8. Run linting.
9. Run formatting checks for Step 06 files.
10. Confirm no separate S3 emulator was introduced.
11. Confirm no database or Redis functionality was added.
12. Produce a concise Step 06 completion report.
    If Step 06 fails its completion gate, stop and resolve only Step 06 issues.

Do not begin Step 07 while Step 06 remains incomplete.

## Step 07 execution

Execute:

Plain Text

```text
github-prompts/step-07-implement-persistence-module.md
```

Follow the Step 07 prompt exactly.

Step 07 must implement only the Persistence Module scope, including:

- AWS SDK S3 client configuration inside the Persistence Module
- Reference Data Repository implementation
- Versioned collection-object reading and writing
- Manifest reading and writing
- Object metadata retrieval
- Object existence checks
- JSON and GeoJSON serialisation
- Checksums and ETags
- AWS SDK error translation
- Unit tests with mocked SDK responses
- Integration tests against Floci
- Architecture-boundary verification
  Step 07 must not implement:

- Cache hydration
- Cache refresh
- In-Memory Data Store orchestration
- Validation
- Normalisation
- Authentication
- API routes
- Searching
- Upload API handling
- Collection activation workflow
- Rollback orchestration
- Database functionality
- Redis

### Step 07 completion gate

Before declaring Phase 2 complete:

1. Confirm the Step 07 approved plan was saved.
2. Run the Persistence Module unit tests.
3. Run the Floci integration tests.
4. Run the complete test suite.
5. Run test coverage.
6. Run linting.
7. Run formatting checks for Step 07 files.
8. Confirm the module reads and writes JSON through the S3-compatible API.
9. Confirm JSON and GeoJSON content types are handled correctly.
10. Confirm missing objects, access failures, malformed JSON, and unavailable storage produce predictable service errors.
11. Confirm deployed configuration can omit the custom S3 endpoint.
12. Confirm `map-ports` cannot be persisted independently.
13. Confirm the AWS S3 SDK is imported only within the Persistence Module and its focused tests.
14. Confirm no database or Redis functionality was added.
15. Confirm no cache, authentication, API, validation, normalisation, upload, or activation workflow was added.
16. Produce a concise Step 07 completion report.
    If Step 07 fails its completion gate, resolve only Step 07 issues before completing the phase.

## Testing requirements

Testing must be completed within each step.

Do not defer Step 05, Step 06, or Step 07 testing to Steps 26, 27, or 28.

For every step:

1. Run focused tests first.
2. Run the complete test suite.
3. Run coverage where required.
4. Run linting.
5. Run formatting checks.
6. Run integration tests where required by that step.
7. Record exact commands and results.
8. Fix failures introduced by the current step.
9. Do not broaden scope to resolve unrelated failures.
   If a repository-wide formatting check reports unrelated generated files:

10. Ensure every file modified by the current step passes Prettier.
11. Do not reformat unrelated generated conversation or metadata files.
12. Report remaining warnings accurately.
13. Do not claim that the repository-wide check passed if it exited unsuccessfully.
    If a pre-existing test or quality failure is discovered:

14. Record the exact command and relevant output.
15. Determine whether the current phase introduced it.
16. Do not change unrelated code silently.
17. Ask for clarification if resolving it requires work outside the active step.

## Phase architecture constraints

The completed Phase 2 must preserve these boundaries:

### In-Memory Data Store

- Stores canonical JSON-compatible objects and metadata.
- Is process-local.
- Is non-durable.
- Does not access S3.
- Does not access Floci.
- Does not access the Authentication Service.

### Persistence Module

- Is the only production component that imports the AWS S3 SDK.
- Is the only component that accesses S3 or Floci.
- Does not access the concrete In-Memory Data Store.
- Does not implement cache hydration or refresh.
- Does not implement validation or normalisation.
- Does not implement API routes.

### Floci

- Is the existing local S3-compatible environment.
- Must not be replaced by LocalStack or MinIO.
- Must be configured idempotently.
- Must use safe local test credentials.
- Must not introduce production credentials.

### Durable storage

- S3-compatible object storage remains the durable source of truth.
- The in-memory store remains a cache.
- No database is introduced.
- Redis is not introduced.

## Phase acceptance criteria

Phase 2 is complete only when all acceptance criteria from the approved Step 05, Step 06, and Step 07 prompts have been satisfied.

At minimum:

- Active canonical collections can be stored as process-local JSON-compatible objects.
- Collections and metadata can be retrieved.
- Per-dataset replacement is atomic.
- Failed replacement leaves previous data intact.
- Consumers cannot mutate active store state accidentally.
- The local Floci bucket is created idempotently.
- Host and container Floci configurations are documented and verified.
- The Persistence Module reads and writes through the S3-compatible API.
- Collection and manifest operations use the approved object-key convention.
- JSON and GeoJSON content types are supported.
- ETags and content checksums remain distinct concepts.
- Storage failures map to predictable service errors.
- The AWS S3 SDK is confined to the Persistence Module.
- `map-ports` is not independently persisted.
- No database is used.
- Redis is not used.
- Focused tests pass for every step.
- The complete test suite passes.
- Required Floci integration tests pass.
- Linting passes.
- All files modified during Phase 2 pass formatting checks.
- No later-step functionality has been implemented.

## Out of scope for Phase 2

Do not implement:

- Step 08 common validation
- Step 09 dataset-specific validation
- Step 10 canonical normalisation
- Step 11 cache refresh or startup hydration
- Step 12 Authentication Service integration
- Step 13 common API behaviour
- Step 14 manifest API
- Step 15 query engine
- Dataset query endpoints
- Mobile projections
- Map query endpoints
- Upload validation API
- Atomic collection activation workflow
- Seed reference data
- Health and readiness changes assigned to Step 24
- Metrics and audit events assigned to Step 25
- Final test consolidation
- OpenAPI documentation
- Deployment infrastructure
- Any database or Redis functionality

## Final Phase 2 report

After all three steps pass their completion gates, provide:

1. Phase 2 completion summary.
2. Phase execution plan path.
3. Step 05 plan path and completion status.
4. Step 06 plan path and completion status.
5. Step 07 plan path and completion status.
6. Files created and modified in each step.
7. In-Memory Data Store implementation summary.
8. Defensive-access and atomic-replacement strategy.
9. Floci configuration summary.
10. S3 bucket and object-key convention.
11. Persistence Module implementation summary.
12. JSON and GeoJSON handling.
13. Checksum and ETag strategy.
14. Error mappings implemented.
15. Unit-test commands and results for each step.
16. Floci integration-test commands and results.
17. Complete test-suite result.
18. Coverage result.
19. Linting result.
20. Formatting result.
21. Architecture-boundary verification result.
22. Confirmation that the AWS S3 SDK is confined to the Persistence Module.
23. Confirmation that no database or Redis was introduced.
24. Confirmation that no later-step functionality was implemented.
25. Any remaining Floci limitations, risks, or owner decisions.
26. The next approved implementation step, which must remain Step 08.
    Do not modify the approved implementation plan.

If you reach any ambiguity, ask me to clarify.
