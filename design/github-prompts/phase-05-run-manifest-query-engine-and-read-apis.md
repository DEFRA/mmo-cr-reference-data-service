# Phase 5: Manifest, Query Engine, and Read APIs

## Recommended reasoning effort

- **Planning:** High
- **Implementation:** High
- **Phase verification:** High

## Objective

Complete Phase 5 by implementing the shared query engine and all remaining Reference Data Service read APIs.

Step 14 has already been implemented and must be treated as a completed prerequisite.

Execute the remaining steps sequentially:

1. **Step 15:** Implement the shared query engine
2. **Step 16:** Implement vessel query endpoints and mobile projection
3. **Step 17:** Implement gear query endpoints and mobile projection
4. **Step 18:** Implement port query endpoints and mobile projection
5. **Step 19:** Implement species query endpoints and mobile projection
6. **Step 20:** Implement map-location query endpoints
   Use the existing GitHub prompt for each step as the authoritative source for that step's scope, rules, deliverables, exclusions, tests, acceptance criteria, and completion response.

Do not duplicate those detailed requirements in this phase prompt.

## Step 14 prerequisite

The following step is already implemented:

Plain Text

```text
Step 14: Implement the Manifest API
```

Before beginning Step 15:

1. Inspect the Step 14 implementation.
2. Read its saved plan and completion summary.
3. Run the relevant Step 14 regression tests.
4. Confirm that the Manifest API remains operational.
5. Reuse its established Query Module, API, ETag, correlation, caching, and testing conventions where applicable.
   Do not reimplement Step 14.

Only modify Step 14 code when a shared improvement is required by a later step. Any modification must preserve the existing Manifest API contract and pass its regression tests.

## Required execution order

Execute:

Plain Text

```text
Step 15
  -> Step 16
  -> Step 17
  -> Step 18
  -> Step 19
  -> Step 20
  -> Phase 5 regression verification
  -> Phase 5 completion report
```

Do not begin a step until the preceding step has completed its implementation and verification.

If one step has already been implemented, inspect its plan, implementation, completion summary, and tests. Verify it rather than implementing it again.

## Plan-saving requirement

Each step must save its GitHub-generated implementation plan using the exact plan filename specified in that step's prompt.

The required workflow for every step is:

1. Read the existing step prompt completely.
2. Inspect the current repository.
3. Generate the repository-specific plan.
4. Save the plan using the exact filename required by the step prompt.
5. Treat the saved plan as already approved.
6. Continue directly with implementation.
7. Run the step-specific verification.
8. Produce the step completion summary.
9. Continue to the next step.
   Do not request approval after saving a plan.

Only pause when a material ambiguity, conflict, missing prerequisite, security concern, or incompatible API decision requires owner input.

## Authoritative step prompts

Locate and follow the existing prompts for:

Plain Text

```text
Step 15: Implement the shared query engine
Step 16: Implement vessel query endpoints and mobile projection
Step 17: Implement gear query endpoints and mobile projection
Step 18: Implement port query endpoints and mobile projection
Step 19: Implement species query endpoints and mobile projection
Step 20: Implement map-location query endpoints
```

If any required step prompt cannot be found:

1. Do not infer its detailed requirements from the step title.
2. Stop before implementing that step.
3. Report the missing prompt.
4. Ask for clarification.

## Phase-wide implementation expectations

Across the remaining Phase 5 steps:

- Reuse the shared query engine instead of duplicating filtering, pagination, sorting, ETag, or query-result behaviour.
- Read active reference data from the process-local In-Memory Data Store.
- Do not access S3 or Floci from controllers, query modules, or projectors.
- Do not trigger cache hydration or refresh from a read request.
- Preserve valid GUIDs as technical identifiers.
- Keep business identifiers separate from GUIDs.
- Produce mobile responses as projections of canonical data.
- Do not persist separate mobile collections.
- Preserve standard API behaviour established by Step 13.
- Preserve the Manifest API implemented in Step 14.
- Keep ordinary tests Docker-free.
- Keep Floci-dependent tests under the existing separate Floci test command.
- Do not introduce item-level mutations.
- Do not introduce Redis or another external cache.

## Per-step checkpoint

At the end of each step:

1. Confirm that the required plan was saved.
2. Run the tests required by that step's prompt.
3. Run type checking.
4. Run linting.
5. Run the build.
6. Run the complete Docker-free test suite.
7. Run relevant regression tests for all previously completed Phase 5 steps.
8. Confirm architecture boundaries remain intact.
9. Produce the required step completion summary.
10. Record deviations, deferred work, and unresolved risks.
    Do not continue when a newly introduced failure remains unresolved.

## Phase 5 regression verification

After Step 20, run the complete Phase 5 verification suite.

At minimum, verify:

- Step 14 Manifest API
- Step 15 shared query engine
- Step 16 vessel endpoints and mobile projection
- Step 17 gear endpoints and mobile projection
- Step 18 port endpoints and mobile projection
- Step 19 species endpoints and mobile projection
- Step 20 map-location endpoints
- Common API behaviour and error handling
- In-Memory Data Store integration
- Startup hydration and cache refresh
- Validation and canonical normalisation
- Persistence regressions
- Health and readiness
- ETag and conditional-request behaviour
- Correlation handling
- OpenAPI or API-contract validation where present
- Complete Docker-free test suite
- Type checking
- Linting
- Build
  Confirm that:

- All read endpoints use active in-memory data.
- No read path directly accesses S3 or Floci.
- No read request triggers cache refresh.
- Canonical source data is not mutated by filtering, sorting, or projection.
- Mobile projections preserve GUID identities.
- Business identifiers remain separate from GUIDs.
- Search, filtering, sorting, and pagination follow shared conventions.
- `304 Not Modified` responses contain no body.
- Errors use the standard API envelope.
- Manifest behaviour remains unchanged.
- Normal tests remain Docker-free.

## Scope control

Do not implement work assigned to later phases, including:

- Validation-only collection uploads
- Full collection replacement
- Atomic manifest activation
- Upload rollback and recovery
- Item-level create, update, patch, or delete endpoints
- Production deployment infrastructure
- API Gateway deployment
- Fargate deployment
- Production IAM changes
- Redis
- A separate mobile-data store
- Direct S3 access from read APIs

## Phase completion criteria

Phase 5 is complete only when:

- Step 14 remains implemented and verified.
- Steps 15 through 20 have been completed in order.
- Every step plan has been saved using the filename specified by its prompt.
- Every saved plan has been treated as approved.
- Every step has a completion summary.
- All implemented read endpoints pass their tests.
- Cross-step regression tests pass.
- Type checking passes.
- Linting passes, or pre-existing issues are clearly documented.
- The build passes.
- The complete Docker-free test suite passes.
- Architecture boundaries remain intact.
- Documentation reflects the implemented APIs.
- A final Phase 5 completion report has been produced.

## Final Phase 5 completion report

Provide a concise report containing:

- Step 14 verification status
- Steps 15 through 20 implementation status
- Saved plan filenames
- Step completion-summary filenames
- Read endpoints delivered
- Shared query-engine capabilities delivered
- Canonical and mobile projections delivered
- ETag and conditional-request verification
- Error and correlation verification
- Architecture-boundary verification
- Test counts and coverage
- Type-check, lint, and build results
- Regression-test results
- Approved deviations
- Existing issues not introduced by Phase 5
- Work deferred to later phases
- Remaining risks or owner decisions
  if you reach any ambiguity ask me to clarify
