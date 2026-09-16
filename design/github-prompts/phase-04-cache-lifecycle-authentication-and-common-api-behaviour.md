# Phase 04: Cache Lifecycle, Authentication, and Common API Behaviour

## Recommended reasoning effort

- Planning phase: High
- Implementation phase: High
- Final Defra Sonar review: High

## Role

Act as a senior Node.js backend engineer implementing Phase 4 of the Reference Data Service for the Catch Recording application.

Phase 4 consists exclusively of:

1. Step 11: Implement the Cache Refresh Module and startup hydration
2. Step 12: Implement Authentication Service integration
3. Step 13: Implement common API behaviour and error handling
   Follow the approved Reference Data Service implementation plan and the existing approved prompts for Steps 11, 12, and 13.

This phase prompt coordinates those steps. It does not replace, rewrite, combine, expand, reduce, or reinterpret the individual step prompts.

## Mandatory ambiguity rule

If any ambiguity, inconsistency, missing contract, unresolved business decision, external-service uncertainty, or conflict with the existing implementation is found:

1. Stop the current planning or implementation activity.
2. Describe the exact ambiguity.
3. Identify the affected step and files.
4. Show the relevant existing implementation or approved requirement.
5. Explain the available options.
6. Recommend an option with clear technical rationale.
7. Explain the impact of each option.
8. Ask me to clarify or approve the decision.
9. Wait for my response before proceeding.
   Do not resolve ambiguity by making an assumption.

Do not silently reinterpret the approved plan.

The instruction to ask for clarification applies during:

- Phase planning
- Step planning
- Implementation
- Testing
- Authentication Service integration
- Retry-policy design
- Cache-startup behaviour
- Error mapping
- SonarCloud remediation
- Any proposed change to an existing contract

## Objective

Complete Phase 4 by executing the approved Step 11, Step 12, and Step 13 prompts in order.

Each step must retain:

- Its approved objective
- Its approved scope
- Its approved exclusions
- Its approved dependencies
- Its approved deliverables
- Its approved testing requirements
- Its approved completion criteria
- Its approved architecture constraints
- Its individual plan-file requirement
  Testing must be completed as part of each step. Do not defer step-specific testing to Steps 26, 27, or 28.

## Required source documents

Before planning or implementation, locate and read the approved implementation plan and these prompts in full:

Plain Text

```text
github-prompts/step-11-implement-cache-refresh-and-startup-hydration.md
github-prompts/step-12-implement-authentication-service-integration.md
github-prompts/step-13-implement-common-api-behaviour-and-error-handling.md
```

Use the actual repository filenames if the approved files use slightly different casing or wording.

Also locate and read any existing approved step plans:

Plain Text

```text
github-prompts/Step 11-implement-cache-refresh-and-startup-hydration-plan.md
github-prompts/Step 12-implement-authentication-service-integration-plan.md
github-prompts/Step 13-implement-common-api-behaviour-and-error-handling-plan.md
```

If any implementation prompt is missing:

1. Stop.
2. Report the exact missing file.
3. Do not reconstruct or guess the missing prompt.
4. Ask me to provide or regenerate it.
   If an approved step plan conflicts with its corresponding prompt or the locked implementation plan:

5. Stop.
6. Identify the exact conflict.
7. Explain the consequences.
8. Ask me which instruction is authoritative.
9. Do not proceed until clarified.

## Plan protection

The approved Reference Data Service implementation plan is locked.

Do not:

- Change the plan
- Reorder Steps 11, 12, or 13
- Merge the three steps
- Split the steps
- Move work between steps
- Add new implementation steps
- Remove approved scope
- Expand the phase into Step 14 or later
- Reimplement Steps 01 through 10
- Defer tests required by an active step
- Change approved architecture boundaries without consent
  If a deviation appears technically necessary:

1. Stop.
2. Identify the exact issue.
3. Explain why the approved plan cannot be followed.
4. Propose the smallest possible deviation.
5. Explain the risks of accepting and rejecting the deviation.
6. Wait for my explicit approval.
   A different coding preference or a potentially cleaner design is not sufficient justification for changing the plan.

## Required working mode

Start in Plan mode.

Before making any changes:

1. Inspect the complete repository.
2. Read the approved implementation plan.
3. Read the Step 11, Step 12, and Step 13 prompts completely.
4. Inspect the implementation completed through Step 10.
5. Inspect the current Git working tree:
   Shell

```text
git status --short
git diff --stat
```

1. Determine whether any work for Steps 11, 12, or 13 has already been partially implemented.
2. Verify existing work against the relevant step acceptance criteria.
3. Do not repeat completed work.
4. Identify contracts and component boundaries affected by the phase.
5. Identify unresolved external-service details.
6. Identify any ambiguity and stop for clarification before completing the plan.
   Produce a concise Phase 4 execution plan containing:

- Current repository status
- Step 11 readiness and dependency status
- Step 12 readiness and dependency status
- Step 13 readiness and dependency status
- Required execution order
- Expected files affected by each step
- Tests and verification gates for each step
- Architecture-boundary checks
- Known ambiguities
- Defra SonarCloud review strategy
  Wait for approval before modifying source files.

After approval, save the Phase 4 execution plan as:

Plain Text

```text
github-prompts/Phase 04-cache-lifecycle-authentication-and-common-api-behaviour-plan.md
```

The phase plan does not replace the individual plan files required by the Step 11, Step 12, and Step 13 prompts.

## Execution model

Execute the phase in this exact order:

1. Step 11
2. Step 12
3. Step 13
4. Final Phase 4 integration verification
5. Defra SonarCloud rules analysis
   Do not implement all three steps in one uninterrupted operation.

After completing each step:

1. Run its focused tests.
2. Run its integration tests where required.
3. Run the complete test suite.
4. Run coverage where required.
5. Run linting.
6. Run formatting checks.
7. Verify its architecture boundaries.
8. Produce a concise completion report.
9. Stop and wait for approval before starting the next step.

## Step 11 execution

Execute the approved Step 11 prompt exactly.

### Approved Step 11 objective

Load persisted collections into memory and refresh only those that have changed.

### Required Step 11 scope

Implement:

- Application-startup cache hydration
- Manifest retrieval through the Persistence Module
- Comparison of collection IDs, versions, ETags, checksums, or last-modified metadata
- Loading missing collections
- Refreshing changed collections
- Retaining unchanged collections
- Atomic in-memory replacement
- Handling partially unavailable datasets
- Manual refresh capability for internal use
- Configurable periodic refresh only if required by the approved deployment model
  Define startup behaviour for:

- Missing manifest
- Empty bucket
- Invalid persisted collection
- S3 temporarily unavailable
- One invalid collection while other collections are valid

### Step 11 architecture constraints

- The Cache Refresh Module must access persisted data only through the Persistence Module.
- The Cache Refresh Module must not import the AWS SDK.
- The Cache Refresh Module must not access Floci directly.
- The Cache Refresh Module must update memory only through the In-Memory Data Store contract.
- A failed refresh must leave the previous valid collection active.
- One failed dataset must not corrupt other datasets.
- Unchanged collections must not be downloaded.
- Do not implement Authentication Service integration.
- Do not implement HTTP routes.
- Do not implement Step 12 or Step 13 functionality.

### Step 11 ambiguity checks

Stop and ask for clarification if any of these are unresolved:

- Whether cache refresh is periodic, request-triggered, event-triggered, or combined
- Which datasets are mandatory for readiness
- Whether a missing manifest prevents startup
- Whether an empty bucket is a valid first-start state
- Whether one invalid collection causes degraded readiness or complete unavailability
- Which metadata field is authoritative for detecting change
- Refresh interval and overlap behaviour
- Manual refresh exposure and ownership
  Do not choose these behaviours silently.

### Step 11 completion gate

Before moving to Step 12:

1. Confirm the Step 11 plan was saved.
2. Confirm startup hydration works through the approved contracts.
3. Confirm unchanged collections are not downloaded.
4. Confirm changed collections are refreshed independently.
5. Confirm failed refresh preserves previous valid data.
6. Confirm one failed dataset does not corrupt other datasets.
7. Confirm direct AWS SDK access remains confined to the Persistence Module.
8. Run Step 11 unit tests.
9. Run Step 11 Floci integration tests.
10. Run the complete test suite.
11. Run coverage.
12. Run linting.
13. Run formatting checks.
14. Produce the Step 11 completion report.
15. Stop and wait for approval.

## Step 12 execution

Execute the approved Step 12 prompt exactly.

### Approved Step 12 objective

Integrate token validation and permission checks through the Validation Module.

### Required Step 12 scope

Implement:

- Authentication Service client abstraction
- Token forwarding
- Token-validation response mapping
- Role or permission mapping
- Read permission enforcement
- Write permission enforcement
- Timeouts
- Approved controlled retries
- Authentication Service unavailable errors
- Test implementation for unit and local integration scenarios
  Proposed permissions are:

Plain Text

```text
reference-data.read
reference-data.write
```

Do not treat these permission names as final unless confirmed by the approved Authentication Service contract.

### Step 12 architecture constraints

- Only the Validation Module may call the Authentication Service.
- Raw access tokens must not be logged.
- Raw access tokens must not be persisted.
- Raw access tokens must not be returned in domain results.
- Authentication failures must fail closed.
- Authentication failures such as `401` and `403` must not be retried.
- Retries must be bounded and limited to approved transient failures.
- Do not implement login, logout, token issuance, token refresh, or user management.
- Do not implement Step 13 HTTP response mapping.
- Do not modify persistence, cache, schemas, normalisation, or query behaviour.

### Step 12 ambiguity checks

Stop and ask for clarification if any of these are unresolved:

- Authentication Service base URL
- Token-validation endpoint
- HTTP method
- Request headers
- Request body
- Successful response shape
- Invalid-token response
- Expired-token response
- Actor identifier
- Role representation
- Permission representation
- Final read and write permission names
- Timeout duration
- Retry count
- Retry delay
- Retryable response statuses
- Correlation-header expectations
- Availability of a local Authentication Service or approved test stub
  Do not invent an Authentication Service contract.

### Step 12 completion gate

Before moving to Step 13:

1. Confirm the Step 12 plan was saved.
2. Confirm the Authentication Service contract used was explicitly approved.
3. Confirm only the Validation Module calls the Authentication Service.
4. Confirm tokens are excluded from logs, errors, returned actors, and persistence.
5. Confirm read and write authorisation remain separate.
6. Confirm malformed responses fail closed.
7. Confirm timeouts are finite.
8. Confirm retries are bounded and only applied to approved transient failures.
9. Run Authentication Service client tests.
10. Run authorisation tests.
11. Run redaction tests.
12. Run architecture-boundary tests.
13. Run the complete test suite.
14. Run coverage.
15. Run linting.
16. Run formatting checks.
17. Produce the Step 12 completion report.
18. Stop and wait for approval.

## Step 13 execution

Execute the approved Step 13 prompt exactly.

### Approved Step 13 objective

Establish consistent transport behaviour before adding dataset endpoints.

### Required Step 13 scope

Implement:

- `/api/v1/reference-data` route prefix
- Request correlation identifiers
- Standard success envelopes
- Standard error envelopes
- Error-to-HTTP-status mapping
- ETag response handling
- `If-None-Match` support
- `If-Match` parsing
- Cache headers
- JSON and GeoJSON content types
- Request-size limits
- Unsupported media-type handling
- Safe error logging
- Hapi validation-failure handling

### Step 13 architecture constraints

- Controllers coordinate HTTP transport only.
- Controllers must not contain persistence, validation, normalisation, cache, or query business logic.
- Service errors from previous steps must be mapped consistently.
- Internal stack traces must never appear in production responses.
- Correlation identifiers must appear in safe errors and responses where approved.
- Conditional requests must follow the approved ETag design.
- Do not implement the manifest endpoint from Step 14.
- Do not implement collection query endpoints.
- Do not implement upload endpoints.
- Do not implement dataset-specific API behaviour.
- Do not change the Authentication Service contract.
- Do not bypass authentication or authorisation.

### Step 13 ambiguity checks

Stop and ask for clarification if any of these are unresolved:

- Exact success-envelope shape
- Exact error-envelope shape
- Correlation-header name and generation rules
- Behaviour for invalid caller-supplied correlation IDs
- Cache-Control values
- Weak versus strong ETag handling
- ETag comparison semantics
- `If-Match` and `If-None-Match` wildcard handling
- JSON versus GeoJSON content-type selection
- Maximum request size
- Error-code-to-status mapping
- Whether all endpoints require authentication by default
- Hapi route-prefix registration strategy
  Do not invent public API behaviour that conflicts with the approved API design.

### Step 13 completion gate

Before declaring Phase 4 implementation complete:

1. Confirm the Step 13 plan was saved.
2. Confirm the reference-data route prefix is established.
3. Confirm standard errors map to approved HTTP statuses.
4. Confirm internal details and stack traces are not exposed.
5. Confirm correlation identifiers are propagated consistently.
6. Confirm `If-None-Match` can produce `304` .
7. Confirm `If-Match` is parsed safely.
8. Confirm request-size limits are enforced.
9. Confirm unsupported media types produce `415` .
10. Confirm JSON and GeoJSON media types are supported.
11. Run Step 13 route-level tests.
12. Run error-mapping tests.
13. Run conditional-request tests.
14. Run correlation tests.
15. Run the complete test suite.
16. Run coverage.
17. Run linting.
18. Run formatting checks.
19. Produce the Step 13 completion report.
20. Stop before beginning the final Phase 4 review.

## Final Phase 4 integration verification

After Steps 11, 12, and 13 are individually complete, verify their integration without implementing Step 14 or later functionality.

Verify:

1. Cache Refresh uses the Persistence Module contract.
2. Cache Refresh uses the In-Memory Data Store contract.
3. Cache Refresh does not call S3 directly.
4. Authentication Service access is confined to the Validation Module.
5. HTTP error mapping correctly recognises authentication, authorisation, persistence, cache, and validation service errors already implemented.
6. Correlation identifiers can propagate through the transport and Authentication Service boundary.
7. Sensitive values remain redacted.
8. Startup and shutdown remain stable.
9. Existing Steps 01 through 10 remain operational.
10. No manifest, query, dataset, map, or upload endpoint from later steps has been implemented.
11. No database or Redis has been introduced.
12. The complete test suite passes.
13. Coverage remains at or above the repository threshold.
14. Linting passes.
15. All Phase 4 files pass formatting checks.
    If integration verification reveals a conflict between completed steps:

16. Stop.
17. Identify the two conflicting contracts or behaviours.
18. Explain which approved requirements are affected.
19. Propose the smallest correction.
20. Ask for approval before changing completed step behaviour.

## Defra SonarCloud rules analysis

After all Phase 4 implementation and verification activities are complete, analyse all code created or modified during Steps 11, 12, and 13 against the Defra SonarCloud rules:

Plain Text

```text
https://sonarcloud.io/organizations/defra/rules
```

This is a mandatory final Phase 4 quality gate.

### Sonar analysis scope

Analyse:

- Production JavaScript or TypeScript
- Unit tests
- Integration tests
- Test utilities
- Fixtures
- Configuration changes
- Hapi plugins and handlers
- Authentication client code
- Cache-refresh code
- Error-mapping code
- Correlation and ETag utilities
- Documentation code examples where analysed by the repository

### Required approach

1. Use the actual configured SonarCloud project and Defra quality profile where available.
2. Run the repository’s existing Sonar or static-analysis command if one exists.
3. Inspect the current SonarCloud or pull-request findings when accessible.
4. Do not assume that passing ESLint means Defra Sonar rules pass.
5. Do not claim SonarCloud success unless an actual analysis confirms it.
6. If SonarCloud runs only in CI, perform a local static review and state clearly that final verification is pending CI.
7. Analyse only new and modified Phase 4 code unless an existing finding blocks the quality gate.
8. Do not perform unrelated repository-wide cleanup silently.

### Rules and risk areas to inspect

At minimum, inspect Phase 4 code for:

- Hardcoded credentials
- Hardcoded tokens
- Hardcoded service URLs
- Magic numbers
- Duplicate literals
- Excessive cognitive complexity
- Excessive function complexity
- Duplicate code
- Dead code
- Unused exports
- Unused parameters
- Broad or unsafe catch blocks
- Swallowed exceptions
- Missing error handling
- Unhandled promise rejections
- Unsafe regular expressions
- Insecure random values
- Sensitive-data logging
- Authorization-header exposure
- Mutable global state
- Unbounded retries
- Unbounded timers
- Resource leaks
- Incorrect asynchronous handling
- Weak equality checks
- Poor null or undefined handling
- Unsafe object-property access
- Possible prototype-pollution paths
- Incorrect HTTP status handling
- Incorrect cache semantics
- Incorrect ETag handling
- Missing timeout handling
- Incomplete test assertions
- Duplicated test fixtures in executable JavaScript
- Maintainability findings
- Reliability findings
- Security hotspots

### Sonar remediation rules

When a Sonar issue is found:

1. Record the rule identifier.
2. Record the affected file and line.
3. Explain the risk.
4. Determine whether the issue was introduced by Phase 4.
5. Propose the smallest compliant change.
6. Confirm that the proposed fix remains within the approved step scope.
7. Ask for clarification before changing architecture, public contracts, or approved behaviour.
8. Implement straightforward, scope-safe quality fixes.
9. Run affected tests after each fix.
10. Rerun linting, formatting, coverage, and available Sonar analysis.
    Do not resolve Sonar findings by:

- Globally disabling rules
- Adding broad `NOSONAR` comments
- Excluding Phase 4 source files
- Weakening tests
- Deleting assertions
- Concealing sensitive logging rather than removing it
- Moving executable logic into data files
- Renaming code without addressing the finding
- Changing approved behaviour without consent
  A narrow rule suppression may only be proposed when:

- The finding is demonstrably a false positive.
- The rationale is documented.
- No clearer compliant implementation is practical.
- The suppression is limited to the exact finding.
- I explicitly approve it.

### Sonar quality gate

Phase 4 must not be declared fully complete until:

- New Phase 4 code has been analysed.
- Phase 4-introduced Sonar issues are resolved or explicitly accepted.
- Security hotspots introduced by Phase 4 are reviewed.
- Tests still pass.
- Coverage remains compliant.
- Linting passes.
- Formatting passes for changed files.
- Any CI-only verification is clearly identified as pending.

## General testing rules

Testing belongs to every step.

Do not defer Step 11, 12, or 13 tests to later testing phases.

For each test command:

- Show the exact command.
- Capture the result.
- Do not claim success without output.
- Do not hide failed or skipped tests.
- Do not weaken tests to obtain a passing result.
- Do not silently update snapshots without inspection.
  If any command produces no output for more than two minutes:

1. Stop the command.
2. Report the exact command.
3. Report the last available output.
4. Check whether its process is still running.
5. Suggest the next diagnostic action.
6. Wait for instruction before rerunning a potentially hanging command.
   Do not remain indefinitely at `Working` .

## Security and privacy requirements

Across Phase 4:

- Never log access tokens.
- Never persist access tokens.
- Never expose Authentication Service responses directly.
- Never expose AWS credentials.
- Never log complete reference-data collections.
- Never log complete manifests.
- Never expose stack traces in production responses.
- Fail closed on malformed authentication responses.
- Apply finite timeouts.
- Use bounded retries only where approved.
- Preserve previous valid cache data after refresh failure.
- Avoid reporting access failures as missing data.
- Validate correlation identifiers through approved mechanisms.
- Use synthetic identities and data in tests.
- Do not introduce a production authentication bypass.

## Phase 4 out of scope

Do not implement:

- Changes to the approved implementation plan
- Step 14 manifest API
- Step 15 query engine
- Vessel endpoints
- Gear endpoints
- Port endpoints
- Species endpoints
- Map endpoints
- Mobile projections
- Upload validation endpoints
- Atomic full collection replacement
- Seed reference data
- New database functionality
- MongoDB
- Redis
- DynamoDB
- LocalStack
- MinIO
- New persistence strategies
- Production deployment infrastructure
- IAM provisioning
- Final OpenAPI documentation
- Metrics and audit events assigned to Step 25

## Phase 4 completion criteria

Phase 4 is complete only when:

- Step 11 is complete and verified.
- Step 12 is complete and verified.
- Step 13 is complete and verified.
- All individual step plans are saved.
- All focused tests pass.
- Required Floci integration tests pass.
- The complete test suite passes.
- Coverage satisfies the repository threshold.
- Linting passes.
- All Phase 4 files pass formatting checks.
- Cache refresh preserves previous valid data after failures.
- Only the Persistence Module accesses S3 or Floci.
- Only the Validation Module accesses the Authentication Service.
- Tokens and credentials are not exposed.
- Common API errors are mapped consistently.
- Conditional request behaviour is tested.
- No later-step endpoint has been implemented.
- No database or Redis is introduced.
- Phase 4 changes have been analysed against Defra SonarCloud rules.
- Phase 4-introduced Sonar issues are resolved or explicitly accepted.
- Any CI-only SonarCloud validation is clearly reported as pending.

## Final Phase 4 report

After completing the phase, report:

1. Phase 4 completion summary.
2. Saved Phase 4 plan path.
3. Step 11 plan path and status.
4. Step 12 plan path and status.
5. Step 13 plan path and status.
6. Files created and modified by each step.
7. Cache hydration and refresh behaviour.
8. Cache failure and partial-availability behaviour.
9. Authentication Service contract used.
10. Authentication and authorisation behaviour.
11. Timeout and retry behaviour.
12. Token-redaction verification.
13. Common API and error behaviour.
14. Correlation handling.
15. ETag and conditional-request handling.
16. Request-size and media-type handling.
17. Focused test commands and results.
18. Integration-test commands and results.
19. Complete test-suite result.
20. Coverage result.
21. Lint result.
22. Formatting result.
23. Architecture-boundary verification.
24. Defra SonarCloud analysis method.
25. Defra SonarCloud rules or findings reviewed.
26. Sonar issues fixed.
27. Sonar issues accepted with approval.
28. Security hotspots reviewed.
29. Whether final SonarCloud CI verification is pending.
30. Confirmation that no database or Redis was introduced.
31. Confirmation that no later-step functionality was implemented.
32. Remaining ambiguities, risks, or owner decisions.
33. Confirmation that the next approved implementation step remains Step 14.
    Do not modify the approved implementation plan.

If you reach any ambiguity, ask me to clarify.
