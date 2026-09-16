# Run Phase 3: Steps 08, 09, and 10

## Recommended reasoning effort

- **Phase preparation:** High
- **Implementation:** High
- **Final integration and verification:** High

## Objective

Execute all work assigned to **Phase 3** , consisting of:

1. **Step 08:** Implement common structural and business validation
2. **Step 09:** Execute the scope defined by the approved Step 09 prompt and plan
3. **Step 10:** Implement canonical data normalisation
   Implement the steps sequentially in numerical order.

Do not combine the three steps into one uncontrolled implementation change. Treat each step as a separate implementation checkpoint with its own saved plan, verification, and completion summary.

## Approved-plan instruction

The implementation plans for Steps 08, 09, and 10 must be saved before their respective implementation work begins.

For this phase execution, assume that each plan is approved immediately after it has been produced and reviewed for completeness and consistency with the repository.

No additional owner approval pause is required unless:

- The proposed plan conflicts with the Reference Data Service design.
- The plan conflicts with an earlier approved implementation decision.
- The repository contains an ambiguity that materially affects behaviour, schemas, architecture, security, or compatibility.
- Executing the plan would require work outside the approved step scope.
- A required dependency or contract is missing.
- The implementation would require destructive or irreversible changes.

## Plan file requirements

Save the Step 08 plan as:

Plain Text

```text
github-prompts/Step 08-implement-common-structural-and-business-validation-plan.md
```

Save the Step 09 plan using the exact plan filename specified by the existing Step 09 GitHub prompt.

Save the Step 10 plan as:

Plain Text

```text
github-prompts/Step 10-implement-canonical-data-normalisation-plan.md
```

If the existing Step 09 prompt does not specify a plan filename, derive it from the Step 09 prompt filename using this convention:

Plain Text

```text
github-prompts/Step 09-<step-09-descriptive-name>-plan.md
```

Do not overwrite an existing approved plan silently.

If a corresponding plan file already exists:

1. Read it completely.
2. Confirm that the plan remains compatible with the current repository.
3. Treat it as approved.
4. Follow it unless implementation evidence reveals a material conflict.
5. Record any necessary deviation in the step completion summary.

## Source-of-truth hierarchy

Use this priority order when resolving implementation requirements:

1. The final approved Reference Data Service design
2. The master implementation plan
3. Approved architecture decisions and API design
4. Existing approved step plans
5. The GitHub prompt for the current step
6. Existing repository conventions and code
7. Assumptions documented in earlier implementation summaries
   Do not replace an approved architectural decision merely because another implementation would be easier.

When two sources conflict, stop the affected work and ask for clarification.

## Phase-wide architectural context

The Reference Data Service is a Node.js and Hapi.js backend service for the Catch Recording application.

The service manages these reference-data domains:

- Vessels
- Gears
- Ports
- Species
- Map-location data, including land and statistical-area collections
  The agreed C4 Level 3 components include:

- Reference Data Controller
- Validation Module
- Query Module
- Command Module
- Data Normalisation Module
- Persistence Module
- Cache Refresh Module
- In-Memory Data Store
  Preserve these rules throughout Phase 3:

1. The **Persistence Module is the only application component permitted to access S3** .
2. The **Validation Module is the only application component permitted to call the Authentication Service** .
3. The Data Normalisation Module must not access S3, Floci, or the Authentication Service.
4. Canonical data must remain aligned with legacy schemas wherever practical.
5. Valid supplied GUIDs must remain the stable technical identifiers.
6. Business identifiers must remain separate from GUIDs.
7. Map-location data is the primary new reference-data domain.
8. Mobile responses are projections of canonical data, not separately maintained collections.
9. Complete collection files are stored as JSON or GeoJSON.
10. The in-memory data store uses process-local JSON objects.
11. Redis or another external cache must not be introduced.
12. Updates are limited to complete collection replacement.
13. Item-level create, update, patch, and delete behaviour is outside scope.
14. Invalid data must not proceed to persistence or activation.
15. Normalisation must not conceal structural or business-validation failures.
16. Normalisation must not mutate supplied input.
17. Tests that do not require Floci must remain Docker-free.

## Repository assessment before Phase 3

Before executing Step 08:

1. Inspect the complete repository.
2. Read the master implementation plan.
3. Read all completed step plans and completion summaries.
4. Inspect the current source tree and test tree.
5. Inspect `package.json` and the active package-manager lock file.
6. Inspect the current Validation Module.
7. Inspect the current Data Normalisation Module.
8. Inspect the repository and persistence contracts from earlier steps.
9. Inspect canonical collection types and supported dataset definitions.
10. Inspect error classes and error-mapping behaviour.
11. Inspect existing JSON Schema or runtime-validation libraries.
12. Inspect test configurations, including the normal Docker-free suite and any Floci-specific suite.
13. Run the current baseline verification commands.
14. Record any pre-existing failures before making changes.
    Do not assume that earlier prompts were implemented exactly as originally described. Treat the repository as implementation evidence and compare it with the approved plans.

## Baseline verification

Before changing source files, run the repository's applicable equivalents of:

Plain Text

```text
install dependencies
run type checking
run linting
run the Docker-free test suite
run persistence tests
run the build
```

If a command already passed during the immediately preceding step and the repository has not changed since that run, the result may be referenced, but rerun all baseline commands when practical.

Record:

- Exact commands
- Exit codes
- Test counts
- Coverage results where configured
- Pre-existing warnings
- Pre-existing failures
- Environment requirements
  Do not silently fix unrelated baseline failures.

## Execution model

Execute the phase using the following checkpoints:

Plain Text

```text
Phase preparation
  -> Step 08 plan
  -> save Step 08 plan
  -> implement Step 08
  -> verify Step 08
  -> produce Step 08 completion summary
  -> Step 09 plan
  -> save Step 09 plan
  -> implement Step 09
  -> verify Step 09
  -> produce Step 09 completion summary
  -> Step 10 plan
  -> save Step 10 plan
  -> implement Step 10
  -> verify Step 10
  -> produce Step 10 completion summary
  -> run Phase 3 integration and regression verification
  -> produce Phase 3 completion report
```

Do not begin Step 09 until Step 08 acceptance criteria and verification have been completed or a documented non-blocking exception has been identified.

Do not begin Step 10 until Step 09 acceptance criteria and verification have been completed or a documented non-blocking exception has been identified.

## Step 08 execution

### Scope

Execute the existing Step 08 GitHub prompt:

Plain Text

```text
Step 08: Implement common structural and business validation
```

The implementation must establish or complete:

- Structural validation
- Common collection-envelope validation
- Common business validation
- Supported-dataset validation
- GUID validation
- Business-code validation support
- Duplicate detection
- Date and date-range validation
- Item-count and feature-count consistency
- Intra-collection relationship validation
- Validation result and issue contracts
- Stable machine-readable validation codes
- Dataset-validator registration
- GeoJSON structural-validation foundations
- Deterministic issue ordering
- Maximum issue-count protection
- Safe rejected-value handling
- Unit and appropriate integration tests
- Validation documentation

### Step 08 constraints

- Do not access S3.
- Do not access Floci.
- Do not call the Authentication Service.
- Do not depend directly on Hapi.js request objects.
- Do not mutate input.
- Do not hide validation failures through normalisation.
- Do not implement full upload endpoints.
- Do not implement mobile projections.
- Keep the normal test suite Docker-free.

### Step 08 checkpoint

Before proceeding to Step 09:

1. Run all Step 08-specific tests.
2. Run type checking.
3. Run linting.
4. Run the complete Docker-free test suite.
5. Run the build.
6. Confirm that persistence tests still pass.
7. Confirm that no new direct S3 or Authentication Service dependency was added to validation.
8. Save a Step 08 completion summary in the repository's established location.
9. Record any deferred validation behaviour.

## Step 09 execution

### Authoritative scope

Locate and read the existing Step 09 GitHub prompt and any existing Step 09 plan.

The Step 09 prompt and approved plan define the authoritative Step 09 title, scope, deliverables, acceptance criteria, test requirements, and exclusions.

Do not infer or replace Step 09 scope from its numerical position alone.

### Step 09 planning

If no Step 09 plan exists:

1. Inspect the repository after Step 08.
2. Produce the Step 09 plan.
3. Include exact files to create and modify.
4. Include dependencies on Step 08.
5. Include verification commands.
6. Include security and privacy considerations.
7. Include work explicitly deferred to Step 10 or later steps.
8. Save the plan using the filename defined by the Step 09 prompt.
9. Treat the saved plan as approved.

### Step 09 implementation

Implement only the approved Step 09 scope.

Preserve:

- Validation and normalisation separation
- GUID and business-code separation
- Existing module boundaries
- Docker-free normal tests
- Persistence isolation
- Authentication isolation
- Existing repository conventions

### Step 09 checkpoint

Before proceeding to Step 10:

1. Run all Step 09-specific tests.
2. Run Step 08 validation tests.
3. Run type checking.
4. Run linting.
5. Run the complete Docker-free test suite.
6. Run persistence tests.
7. Run the build.
8. Confirm no Step 08 regression.
9. Save a Step 09 completion summary.
10. Record any work deferred to Step 10.
    If the Step 09 prompt or plan cannot be located, stop before implementing Step 09 and ask for clarification.

## Step 10 execution

### Scope

Execute the existing Step 10 GitHub prompt:

Plain Text

```text
Step 10: Implement canonical data normalisation
```

The implementation must establish or complete:

- Common canonical normalisation contracts
- Normalisation result and warning models
- Common collection-envelope normalisation
- Explicit string policies
- Explicit numeric-conversion policies
- Explicit boolean-conversion policies
- Date and date-time policies
- Null and omission policies
- Dataset-normaliser registration
- Vessel normalisation
- Gear normalisation
- Port normalisation
- Species normalisation
- Map-land normalisation
- Map-statistical-areas normalisation
- Explicit handling of derived `map-ports`
- Stable warning codes
- Safe failures for ambiguous transformations
- Input immutability
- Idempotency
- Docker-free unit and integration tests
- Normalisation documentation

### Step 10 constraints

- Preserve valid supplied GUIDs.
- Do not generate or replace invalid GUIDs.
- Do not derive GUIDs from business codes.
- Preserve leading zeros in business identifiers.
- Do not reinterpret legacy gear `fixed` semantics.
- Do not flatten species names.
- Do not infer vessel home ports.
- Do not infer missing port coordinates.
- Do not swap coordinates based on guesses.
- Do not infer the source coordinate reference system.
- Do not simplify or topologically repair map geometry.
- Do not implement mobile response projections.
- Do not access S3 or Floci.
- Do not call the Authentication Service.
- Do not update the in-memory store.
- Do not create API responses.
- Keep normalisation separate from structural and business validation.
- Keep all normalisation tests Docker-free.

### Required pipeline integration

Verify the implemented stage order is explicit and testable:

Plain Text

```text
parse
  -> structural validation
  -> canonical normalisation
  -> business validation
  -> later persistence and activation
```

Do not allow Step 10 to duplicate Step 08 validators.

Do not allow Step 08 validation to silently perform Step 10 normalisation.

### Step 10 checkpoint

Before Phase 3 completion:

1. Run all Step 10-specific tests.
2. Run all Step 08 validation tests.
3. Run all Step 09 tests.
4. Run type checking.
5. Run linting.
6. Run the complete Docker-free test suite.
7. Run persistence tests.
8. Run the build.
9. Verify immutability.
10. Verify idempotency.
11. Verify deterministic warning ordering.
12. Verify that no S3, Floci, Authentication Service, or in-memory-store calls occur during normalisation.
13. Save a Step 10 completion summary.

## Phase-wide integration requirements

After all three steps are complete, add or run integration tests proving:

1. A valid canonical collection passes structural validation.
2. A structurally invalid collection is rejected before normalisation.
3. A structurally valid legacy-compatible collection is normalised.
4. Business validation evaluates the canonical normalised value.
5. Normalisation warnings remain distinct from validation errors.
6. Multiple validation issues are returned deterministically.
7. Duplicate GUIDs are not repaired by normalisation.
8. Duplicate business codes are not repaired by normalisation.
9. Invalid date ranges are not concealed by date formatting.
10. Missing relationships are not created by normalisation.
11. Leading-zero business identifiers remain strings.
12. Valid GUIDs remain unchanged.
13. A second normalisation pass makes no additional changes.
14. Input objects remain unchanged.
15. Dataset registries resolve the appropriate validator and normaliser.
16. Unsupported datasets fail safely.
17. Standard JSON and GeoJSON collections follow the correct validation and normalisation path.
18. `map-ports` is not treated as an independently uploaded collection.
19. Validation and normalisation make no S3 or Floci calls.
20. Validation and normalisation make no Authentication Service calls.
21. Step 07 persistence behaviour remains unaffected.
22. Existing error mapping tests continue to pass.

## Regression requirements

Run regression tests covering previously completed persistence and local infrastructure work.

At minimum, confirm:

- Existing persistence tests continue to pass.
- Specific S3 error names remain prioritised over generic HTTP status mapping.
- `NoSuchBucket` does not fall into a generic `404` object-not-found branch.
- Non- `412` write failures continue to map correctly.
- Existing PreconditionFailed behaviour remains correct.
- Floci-specific tests remain under their separate configuration.
- Normal `npm test` remains Docker-free.
- The existing Floci image decision remains unchanged unless explicitly approved.
- No seed-data or reset scope is pulled into this phase if it remains assigned to a later step.
  Do not broaden Phase 3 to address unrelated persistence coverage unless a regression was introduced by Phase 3.

## Test configuration

Preserve the approved test separation:

- Normal unit and application tests run without Docker.
- Floci tests use the repository's separate Floci test configuration and command.
- Phase 3 should not require Floci unless the authoritative Step 09 plan explicitly requires Floci for its approved scope.
- Validation and normalisation tests must not depend on Docker.
  Use the existing repository commands, including the established Floci-specific command where relevant, rather than inventing duplicate scripts.

## Scope control

Do not implement work assigned to later phases, including:

- Full upload API routes
- Multipart upload handling unless Step 09 explicitly owns it
- Active manifest API
- Full collection retrieval endpoints
- Dataset search endpoints
- Mobile response projections
- Cache initialisation
- Cache refresh scheduling
- Atomic collection activation
- Rollback orchestration
- Production infrastructure
- Fargate deployment
- API Gateway deployment
- IAM policies
- Item-level mutation endpoints
- Redis
- Full local seed-data management if assigned to a later step
- Local reset workflows if assigned to a later step
  If tests require a small fixture, create a focused test fixture rather than implementing the later seed-data workflow.

## Security and privacy review

For every step, verify:

- Collection inputs are treated as untrusted.
- Validation and normalisation do not execute input.
- Dynamic imports are not derived from untrusted values.
- Regular expressions cannot cause uncontrolled processing.
- Recursion and issue counts are bounded.
- Complete collections are not written to logs.
- Authentication tokens and credentials are not logged.
- Sensitive vessel identifiers are not unnecessarily logged.
- Warning and error values are safely redacted.
- Prototype-pollution keys cannot alter application objects.
- No network calls occur in pure validation or normalisation.
- No production reference data is added as a test fixture.
- New dependencies are justified and checked for security and licence impact.
  Record security considerations in every step completion summary and in the final Phase 3 report.

## Documentation requirements

Update the existing repository documentation rather than creating competing documents.

Documentation must cover the implemented Phase 3 behaviour, including:

- Structural validation
- Business validation
- Canonical normalisation
- Stage ordering
- Validation issue contracts
- Normalisation warning contracts
- GUID preservation
- Business-code preservation
- Duplicate handling
- Date handling
- Null and omission policy
- Dataset validator registry
- Dataset normaliser registry
- GeoJSON validation and normalisation boundaries
- Immutability
- Idempotency
- Security limits
- Performance considerations
- How to extend validation
- How to extend normalisation
- Docker-free test commands
- Work deferred to later phases

## Verification commands

Use the repository's actual package manager, scripts, module system, and test configuration.

Run the applicable equivalents of:

Plain Text

```text
install dependencies
run type checking
run linting
run Step 08 tests
run Step 09 tests
run Step 10 tests
run validation integration tests
run normalisation integration tests
run the complete Docker-free test suite
run persistence regression tests
run the build
run Floci tests only if required by the authoritative Step 09 scope
```

Also verify behaviour explicitly for:

Plain Text

```text
valid canonical collection
structurally invalid collection
unsupported dataset
dataset mismatch
invalid GUID
duplicate GUID
duplicate business code
invalid item count
invalid date
invalid date range
unresolved relationship
valid legacy-compatible normalisation
numeric-string conversion
leading-zero code preservation
valid GUID preservation
normalisation idempotency
input immutability
deterministic validation issue ordering
deterministic warning ordering
maximum issue-count handling
valid GeoJSON FeatureCollection
invalid GeoJSON structure
map coordinate numeric conversion where approved
unsupported or ambiguous map conversion
derived map-ports handling
absence of S3 calls
absence of Floci calls
absence of Authentication Service calls
absence of in-memory-store updates
```

Record exact commands, test counts, coverage, and results.

## Failure handling

When a failure occurs:

1. Determine whether the failure was introduced by the current step.
2. Fix failures introduced by the current step.
3. Record pre-existing failures separately.
4. Do not silently expand scope to fix unrelated problems.
5. Do not weaken tests to obtain a passing result.
6. Do not remove validation rules without architectural justification.
7. Do not disable linting, type checking, or coverage gates.
8. Do not use broad error catches that conceal the actual failure.
9. Preserve specific error-name handling ahead of generic status-code handling where applicable.
10. Ask for clarification if resolving the failure requires a schema or architecture decision.

## Per-step completion summaries

At the end of each step, produce and save a concise completion summary using the repository's existing documentation convention.

Each summary must include:

- Step number and title
- Plan filename
- Repository state discovered
- Files created
- Files modified
- Files deliberately left unchanged
- Behaviour implemented
- Tests added
- Exact verification commands
- Test and coverage results
- Security and privacy considerations
- Existing issues not introduced by the step
- Deferred work
- Deviations from the approved plan
- Remaining risks or ambiguities
  Do not proceed to the next step until the current summary has been produced.

## Final Phase 3 completion report

After all three steps and phase-level verification are complete, provide a final report containing:

- Phase objective
- Step 08 completion status
- Step 09 completion status
- Step 10 completion status
- Saved plan filenames
- Saved completion-summary filenames
- Architectural boundaries confirmed
- Files created and modified across the phase
- Validation capabilities delivered
- Step 09 capabilities delivered
- Normalisation capabilities delivered
- Integration behaviour verified
- Unit and integration test counts
- Coverage results
- Build, lint, and type-check results
- Persistence regression results
- Floci test results, if run
- Security and privacy controls
- Performance safeguards
- Approved deviations
- Existing issues not introduced by Phase 3
- Work deferred to later phases
- Remaining owner decisions

## Completion criteria

Phase 3 is complete only when:

- All three plans have been saved.
- The plans have been treated as approved.
- Steps 08, 09, and 10 have been implemented in order.
- Each step has a completion summary.
- All step-specific acceptance criteria have been evaluated.
- Validation and normalisation remain separate.
- Valid GUIDs are preserved.
- Business codes remain separate from GUIDs.
- Input immutability is verified.
- Normalisation idempotency is verified.
- Validation issue ordering is deterministic.
- Normalisation warning ordering is deterministic.
- JSON and GeoJSON paths are covered.
- Validation and normalisation remain independent from S3, Floci, Hapi.js requests, and the Authentication Service.
- Normal tests remain Docker-free.
- Persistence regression tests pass.
- Type checking passes.
- Linting passes, or pre-existing failures are explicitly documented.
- The build passes.
- Documentation reflects the actual implementation.
- Deferred work remains outside the phase.
- The final Phase 3 completion report has been produced.
  if you reach any ambiguity ask me to clarify
