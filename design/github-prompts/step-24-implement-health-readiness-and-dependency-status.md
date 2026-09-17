# Step 24: Implement Health, Readiness, and Dependency Status

## Recommended reasoning effort

- Planning phase: High
- Implementation phase: High
- Verification phase: High
- Defra Sonar review: Medium

## Role

Act as a senior Node.js backend engineer implementing the Reference Data Service for the Catch Recording application.

Implement health, readiness, and dependency status exactly as defined by Step 24 of the approved Reference Data Service implementation plan.

Do not change, reorder, expand, reduce, or reinterpret the approved implementation plan.

## Approved objective

Provide reliable health and readiness endpoints that accurately describe:

- Process liveness
- Application readiness
- Startup hydration status
- Availability of mandatory reference-data collections
- Persistence dependency status where required
- Authentication Service dependency status where required
- Cache refresh status
- Safe degraded-state information
- Shutdown state
  The endpoints must support container orchestration and operational diagnosis without exposing credentials, secrets, complete internal configuration, collection contents, stack traces, or sensitive dependency details.

## Approved dependencies

Before implementation, verify the required earlier steps are complete, including:

- Service structure and configuration
- Shared domain contracts
- In-Memory Data Store
- Persistence Module
- Cache Refresh Module
- Startup hydration
- Authentication Service integration
- Common API behaviour and error handling
- Manifest API
- Read APIs
- Deterministic local bootstrap where required by the approved sequence
  Do not silently implement missing functionality belonging to another step.

If a required dependency is incomplete, identify the exact gap and ask for clarification before duplicating or replacing earlier-step functionality.

## Mandatory ambiguity rule

If any ambiguity, conflict, missing contract, or inconsistency is discovered:

1. Stop the current planning or implementation activity.
2. Describe the exact ambiguity.
3. Identify the affected requirement, file, contract, configuration, or previous step.
4. Show the relevant current implementation.
5. Present the smallest viable options.
6. Recommend one option with technical rationale.
7. Explain the impact of each option.
8. Ask me to clarify.
9. Wait for my response before proceeding.
   Do not resolve ambiguity through an undocumented assumption.

In particular, ask for clarification if the approved design or repository does not define:

- Exact health and readiness route paths.
- Whether a separate dependency-status endpoint is required.
- Whether health endpoints require authentication.
- Whether dependency details are public or protected.
- Which datasets are mandatory for readiness.
- Whether optional dataset failures affect readiness.
- Whether stale but valid cached data remains ready.
- Whether Authentication Service availability affects readiness.
- Whether S3 availability affects readiness after hydration.
- Whether a failed scheduled refresh affects readiness.
- How long dependency results may be cached.
- Whether health checks may make live dependency calls.
- Timeout limits for dependency probes.
- Whether dependency failures should return `503` or a successful degraded response.
- Whether readiness should remain false during startup hydration.
- Whether shutdown immediately changes readiness.
- Whether build and version information may be exposed.
- Whether timestamps, durations, and collection versions may be exposed.
- Whether Kubernetes, ECS, or another platform consumes specific response fields.
- Whether liveness failures should ever depend on external services.
- Whether a missing active manifest blocks readiness.
- Whether a manually disabled refresh scheduler affects readiness.
  Do not invent these behaviours.

## Required working mode

Start in Plan mode.

Before changing source files:

1. Inspect the complete repository.
2. Read the approved Reference Data Service design.
3. Read the master implementation plan.
4. Read the approved prompts, saved plans, and completion summaries for all completed steps.
5. Inspect the current Git working tree:
   Shell

```text
git status --short
git diff --stat
git diff --name-only
```

1. Inspect:

- Hapi.js server bootstrap
- Existing health and readiness routes
- Application lifecycle hooks
- Startup hydration state
- Cache Refresh Module state
- In-Memory Data Store metadata
- Mandatory dataset configuration
- Persistence Module dependency contracts
- Authentication Service client contracts
- Common API response and error handling
- Logging and correlation behaviour
- Metrics hooks
- Graceful shutdown
- Docker and container definitions
- Deployment health-check configuration where present
- Existing tests and fixtures

2. Identify any existing health or readiness behaviour that should be retained.
3. Determine whether Step 24 work is already partially implemented.
4. Verify partial work against this prompt rather than replacing it automatically.
5. Identify all ambiguities before completing the plan.
   Do not modify source files during planning.

Produce a concise, repository-specific, file-by-file implementation plan.

Save the GitHub-generated plan as:

Plain Text

```text
design/github-prompts/Step 24-implement-health-readiness-and-dependency-status-plan.md
```

If the repository uses `github-prompts` at its root rather than `design/github-prompts` , use the established repository location while preserving the exact plan filename.

The saved GitHub-generated plan must be treated as already approved.

After saving the plan, continue directly with implementation without requesting plan approval.

Only stop when a material ambiguity, conflict, missing dependency, security concern, or incompatible operational decision requires clarification.

The plan must be saved before implementation begins.

## Required endpoints

Implement or align the approved endpoints equivalent to:

HTTP

```text
GET /health
GET /readiness
GET /health/dependencies
```

Use the exact route paths already approved by the repository if they differ.

Do not add duplicate aliases for existing health routes.

If the approved design does not require a separate dependency endpoint, preserve dependency summaries within the approved readiness contract and document that decision.

## Liveness semantics

The health endpoint must represent process liveness.

A live process should return success when:

- The Hapi.js server can process requests.
- The event loop is operating.
- The application has not entered a fatal shutdown state.
- No unrecoverable internal lifecycle failure requires process replacement.
  Liveness must not fail solely because:

- S3 is temporarily unavailable.
- The Authentication Service is temporarily unavailable.
- Startup hydration is incomplete.
- A reference-data collection is unavailable.
- A scheduled cache refresh failed.
- An optional dataset is unavailable.
- A downstream request timed out.
  External dependency failures belong to readiness or dependency status.

Avoid a liveness design that causes unnecessary restart loops during an external outage.

## Readiness semantics

The readiness endpoint must indicate whether the application can safely serve its intended Reference Data Service traffic.

Readiness must consider:

- Startup lifecycle status
- Startup hydration completion
- Mandatory active manifest availability
- Mandatory reference-data collection availability
- Valid active canonical collections in the In-Memory Data Store
- Fatal cache or hydration state
- Application shutdown state
- Any other dependency explicitly required by the approved readiness policy
  Readiness must be false when:

- Startup hydration has not completed.
- A mandatory dataset has never been loaded successfully.
- The active manifest is unavailable or invalid when required.
- The service is shutting down.
- A fatal lifecycle error prevents safe request processing.
  A later refresh failure must not automatically make readiness false when the previous valid mandatory data remains available and usable.

Do not represent missing mandatory data as a ready service with empty collections.

## Dependency status

Expose safe dependency status for approved operational dependencies.

Potential dependencies include:

- Reference-data persistence
- Authentication Service
- Startup hydration
- Cache Refresh Module
- In-Memory Data Store
- Active manifest
- Mandatory datasets
  The implementation must distinguish:

Plain Text

```text
operational
degraded
unavailable
unknown
disabled
```

Adapt status values to existing repository conventions.

Do not expose unnecessary implementation details.

## Dependency probes

Prefer passive status derived from existing application state where that accurately represents operational availability.

Examples:

- Startup hydration status comes from the Cache Refresh Module.
- Loaded dataset status comes from the In-Memory Data Store.
- Last successful refresh comes from cache-refresh metadata.
- Last Authentication Service outcome may come from an approved dependency-status tracker.
- Persistence dependency status may come from the last approved check or a bounded active probe.
  Do not make expensive dependency calls on every ordinary health request without an approved requirement.

If active probes are required:

- Use finite timeouts.
- Use existing client abstractions.
- Do not bypass the Persistence Module.
- Do not bypass the Validation Module ownership of Authentication Service access.
- Do not retry indefinitely.
- Do not allow one hanging dependency to hang the health endpoint.
- Bound concurrent probes.
- Cache results only according to an approved freshness policy.
- Report stale probe status safely.

## Persistence dependency status

Only the Persistence Module may interact with S3 or Floci.

Health and readiness code must not:

- Import the AWS SDK.
- Send raw S3 commands.
- Inspect raw AWS SDK exceptions.
- Access Floci directly.
- List buckets or objects outside the Persistence Module contract.
  If a persistence probe is required, add or reuse the smallest safe Persistence Module operation.

The probe must distinguish approved conditions such as:

- Service reachable
- Configured bucket available
- Configured bucket missing
- Access denied
- Timeout
- Temporary service failure
- Unknown failure
  Do not expose raw AWS error names publicly.

Preserve existing precedence so that a missing bucket does not become an ordinary missing-object condition.

## Authentication Service dependency status

Only the Validation Module may access the Authentication Service.

Health, readiness, and controller code must not:

- Call the Authentication Service directly.
- Send bearer tokens as part of a health probe.
- Decode authentication tokens.
- Expose Authentication Service URLs.
- Expose raw dependency response bodies.
  If the Authentication Service exposes an approved unauthenticated health endpoint, access it only through the existing Validation Module-owned client boundary.

If no approved health operation exists, use passive dependency state or report the dependency as unknown rather than inventing an endpoint.

Do not validate a real user token merely to determine dependency health.

## Mandatory dataset status

Use the central dataset registry or approved configuration to identify mandatory datasets.

Do not scatter mandatory-dataset lists through route handlers.

For each mandatory dataset, determine whether:

- The dataset is loaded.
- A valid canonical collection is active.
- Collection metadata is available.
- A collection ID and version are present.
- The collection has completed successful startup hydration.
- The collection remains usable after any later refresh failure.
  Do not expose collection content.

Expose collection versions only if approved by the operational contract.

## Optional dataset status

Optional dataset failure must follow the approved readiness policy.

Preferred behaviour:

- Optional failure contributes to a degraded dependency status.
- Optional failure does not make readiness false.
- A previous valid optional collection remains available after refresh failure.
- Missing optional data is reported safely.
  If all maintained datasets are mandatory under the current repository configuration, do not invent optional behaviour beyond keeping the implementation extensible.

## Cache refresh status

Expose safe cache lifecycle information, such as:

- Startup hydration state
- Current refresh state
- Last refresh start
- Last successful refresh
- Last failed refresh
- Number of loaded datasets
- Failed dataset names where safe
- Whether the scheduler is enabled
- Whether a refresh is currently running
  Do not expose:

- Complete refresh error objects
- Stack traces
- Complete manifests
- S3 object keys
- Collection contents
- Credentials
  A running refresh does not make the service unready when valid active data remains available.

## Stale-data policy

Readiness must use the approved stale-data policy.

Preferred behaviour:

- Continue serving the previous valid collection after a failed refresh.
- Remain ready while all mandatory datasets have usable valid data.
- Mark dependency status as degraded when refresh failures occur.
- Do not remove readiness solely because the latest refresh failed.
- Become unready only when required valid data is unavailable or exceeds an explicitly approved maximum age.
  Do not invent a maximum data age if none is configured.

If the approved design requires a maximum age, implement it using an injected clock and validated configuration.

## Startup lifecycle

Readiness must transition through explicit states equivalent to:

Plain Text

```text
starting
hydrating
ready
degraded
not-ready
shutting-down
```

Adapt names to existing lifecycle contracts.

Requirements:

- Readiness is false before hydration completes.
- Health remains live during normal startup.
- Successful hydration makes readiness true.
- Optional failures may produce degraded but ready state.
- Mandatory failures keep readiness false.
- Shutdown changes readiness to false before the server stops accepting work.
- State transitions are deterministic and testable.
- Tests must not rely on real long waits.

## Response contracts

### Health response

A healthy liveness response should be equivalent to:

JSON

```text
{
  "status": "ok",
  "service": "reference-data-service",
  "timestamp": "2026-09-16T18:30:00.000Z"
}
```

Include build or version information only if already approved.

Do not expose sensitive configuration.

### Readiness response

A ready response should be equivalent to:

JSON

```text
{
  "status": "ready",
  "timestamp": "2026-09-16T18:30:00.000Z",
  "hydration": {
    "status": "completed",
    "lastSuccessfulAt": "2026-09-16T18:20:00.000Z"
  },
  "datasets": {
    "mandatory": {
      "expected": 6,
      "loaded": 6,
      "missing": []
    }
  }
}
```

A non-ready response should be equivalent to:

JSON

```text
{
  "status": "not-ready",
  "timestamp": "2026-09-16T18:30:00.000Z",
  "reason": "startup_hydration_incomplete",
  "datasets": {
    "mandatory": {
      "expected": 6,
      "loaded": 3,
      "missing": [
        "species",
        "map-land",
        "map-statistical-areas"
      ]
    }
  }
}
```

Adapt to existing response contracts.

### Dependency-status response

A dependency response may be equivalent to:

JSON

```text
{
  "status": "degraded",
  "timestamp": "2026-09-16T18:30:00.000Z",
  "dependencies": {
    "referenceStore": {
      "status": "unavailable",
      "requiredForReadiness": false,
      "lastCheckedAt": "2026-09-16T18:29:58.000Z"
    },
    "authenticationService": {
      "status": "operational",
      "requiredForReadiness": true,
      "lastCheckedAt": "2026-09-16T18:29:59.000Z"
    },
    "referenceData": {
      "status": "operational",
      "mandatoryDatasetsLoaded": 6
    }
  }
}
```

Do not expose raw dependency URLs or error messages.

## HTTP status behaviour

Use the approved health-check status policy.

Preferred behaviour:

### Health

Plain Text

```text
200 when the process is live
500 only for an unrecoverable internal liveness failure
```

### Readiness

Plain Text

```text
200 when ready
503 when not ready
```

A degraded but still usable service may return `200` with:

Plain Text

```text
status: degraded
```

only when the approved readiness policy permits it.

### Dependency status

Use the approved operational contract.

Possible behaviour:

Plain Text

```text
200 when the status document is generated successfully, even if one dependency is degraded
503 when a required dependency makes the service not ready
```

Do not invent status-code semantics when deployment configuration expects a specific policy.

Health and readiness responses must not use the ordinary API error envelope unless the approved repository convention explicitly requires it.

Unexpected endpoint failures must still be safely handled.

## Cache-Control

Health, readiness, and dependency responses must not be publicly cached.

Return:

HTTP

```text
Cache-Control: no-store
```

Also use other existing no-cache headers where required by repository conventions.

Do not return long-lived reference-data cache headers on operational endpoints.

## Correlation handling

Apply existing correlation behaviour where compatible.

Requirements:

- Preserve a valid supplied correlation ID.
- Generate one when absent.
- Return the approved correlation header.
- Use the identifier in safe logs.
- Avoid making a missing correlation ID a liveness failure.
- Do not include correlation IDs as metric labels.
  If platform health probes do not supply correlation identifiers, generation must remain inexpensive and safe.

## Authentication policy

Use the approved route-access policy.

Preferred behaviour:

- Basic liveness and readiness endpoints remain accessible to platform probes.
- Detailed dependency information is protected or redacted.
- Public responses expose only high-level status.
- Protected operational responses may expose additional safe diagnostic metadata.
  Do not expose credentials, service URLs, bucket names, internal object keys, stack traces, or complete failure causes, even on protected endpoints.

If endpoint authentication policy is not already defined, stop and ask for clarification.

## Error handling

Operational endpoints must fail safely.

Requirements:

- Do not expose raw Hapi.js errors.
- Do not expose AWS SDK errors.
- Do not expose Authentication Service errors.
- Do not expose stack traces.
- Do not expose configuration values.
- Keep public messages safe.
- Log protected diagnostic causes using existing conventions.
- Bound response size.
- Preserve the distinction between a dependency being unavailable and the health endpoint itself failing.
- Avoid recursive dependency on the normal reference-data query path.

## Logging

Use existing structured logging conventions.

Safe fields may include:

- Correlation ID
- Route identifier
- Overall status
- Readiness state
- Hydration state
- Mandatory dataset counts
- Missing mandatory dataset names where approved
- Dependency status
- Probe duration
- Status code
- Last successful refresh age
- Shutdown state
  Do not log:

- Credentials
- Tokens
- Dependency URLs
- Bucket names unless explicitly approved
- S3 object keys
- Complete manifests
- Complete collections
- Raw dependency bodies
- Stack traces for expected dependency outages
- Full sensitive configuration
  Avoid excessive logging from high-frequency platform probes.

Use log-level or sampling behaviour already established by the repository.

## Metrics

Use existing metrics hooks where available.

Prepare or emit bounded metrics equivalent to:

Plain Text

```text
reference_data_health_requests_total
reference_data_readiness_requests_total
reference_data_dependency_status
reference_data_dependency_probe_duration
reference_data_mandatory_datasets_loaded
reference_data_hydration_status
reference_data_last_successful_refresh_age
```

Use bounded labels such as:

- Endpoint
- Status
- Dependency
- Ready or not ready
  Do not use:

- Correlation IDs
- Collection GUIDs
- Object keys
- Dependency URLs
- Raw error messages
  as metric labels.

Do not introduce a new monitoring vendor.

## Configuration

Reuse or add the smallest necessary validated configuration for:

- Health route paths where configurable
- Dependency probe enablement
- Dependency probe timeout
- Dependency status cache duration
- Mandatory datasets
- Maximum allowed data age where approved
- Detailed-status exposure
- Shutdown readiness behaviour
  Requirements:

- Validate numeric durations.
- Reject negative values.
- Use safe defaults.
- Keep tests deterministic.
- Do not parse configuration inside route handlers.
- Do not expose secret values in status responses.
- Do not make production behaviour depend on test defaults.
  Do not add configuration that is not required by the implemented policy.

## Graceful shutdown

Integrate readiness with existing shutdown behaviour.

When shutdown starts:

1. Mark the service not ready.
2. Stop accepting new application traffic according to existing lifecycle conventions.
3. Preserve health long enough for graceful draining where approved.
4. Stop future cache refresh scheduling.
5. Await or safely terminate active work according to configured timeouts.
6. Avoid publishing stale dependency-probe results.
7. Complete shutdown without requiring successful dependency access.
   Add deterministic tests for shutdown readiness transitions.

Do not redesign the entire shutdown implementation.

## Security requirements

- Treat dependency responses as untrusted.
- Use finite probe timeouts.
- Do not perform unbounded retries.
- Do not expose credentials or tokens.
- Do not expose internal endpoints.
- Do not expose bucket names or object keys.
- Do not expose complete manifest or collection metadata.
- Do not expose stack traces.
- Protect detailed diagnostics according to the approved access policy.
- Do not create public dependency proxy endpoints.
- Do not use user-supplied dependency names to make network calls.
- Use allowlisted dependency probes.
- Bound response size.
- Avoid server-side request forgery.
- Do not permit health query parameters to select arbitrary URLs.
- Do not weaken TLS validation.
- Do not add wildcard CORS.
- Review any new dependency for security, maintenance, and licensing.

## Performance requirements

Health endpoints may be called frequently.

Requirements:

- Keep liveness checks constant-time.
- Avoid dependency calls from liveness.
- Prefer passive readiness checks against existing state.
- Avoid scanning complete collections.
- Avoid reading S3 objects.
- Avoid parsing manifests on every request.
- Avoid calling the Authentication Service on every health request unless explicitly required.
- Bound active dependency probes.
- Cache probe results only according to an approved freshness policy.
- Avoid blocking startup or shutdown unnecessarily.
- Use injected clocks for deterministic age calculations.
- Avoid excessive logging.
- Avoid unbounded metric labels.

## Required unit tests

Testing is part of Step 24 and must be completed during this step.

### Health tests

Verify:

- Live process returns `200` .
- Health remains live during startup hydration.
- Health remains live during temporary S3 failure.
- Health remains live during Authentication Service failure.
- Health remains live after a scheduled refresh failure.
- Health response contains only approved fields.
- Health response uses `Cache-Control: no-store` .
- Health response includes correlation header where approved.
- Health response does not expose stack traces or dependency details.
- Fatal internal lifecycle state follows approved behaviour.

### Readiness tests

Verify:

- Readiness is false before hydration starts.
- Readiness is false during hydration.
- Readiness becomes true after successful mandatory hydration.
- Missing mandatory dataset returns not ready.
- Invalid mandatory dataset returns not ready.
- Missing active manifest follows approved readiness behaviour.
- Optional dataset failure follows approved behaviour.
- A failed later refresh retains readiness when previous valid data remains.
- Readiness becomes false when valid mandatory data is unavailable.
- Stale-data policy follows approved configuration.
- Shutdown makes readiness false.
- Response status and HTTP status are consistent.
- Response uses `Cache-Control: no-store` .

### Mandatory dataset tests

Verify:

- Expected mandatory dataset count.
- Loaded mandatory dataset count.
- Missing dataset names.
- Unsupported configured mandatory dataset rejected at startup.
- Derived `map-ports` cannot be configured as a mandatory persisted dataset.
- Loaded metadata belongs to active collections.
- Empty valid collections remain loaded.
- Unloaded collections are not represented as empty loaded collections.
- Dataset ordering is deterministic.

### Cache status tests

Verify:

- Hydration state.
- Last successful hydration.
- Refresh idle state.
- Active refresh state.
- Successful refresh state.
- Failed refresh state.
- Previous valid data retained.
- Scheduler enabled or disabled status.
- Safe failure summary.
- No complete refresh result exposed.

### Persistence dependency tests

Where implemented, verify:

- Operational persistence.
- Missing bucket.
- Access denied.
- Timeout.
- Temporary failure.
- Unknown failure.
- Finite timeout.
- Raw AWS errors not exposed.
- Persistence probe goes through the Persistence Module.
- Specific persistence error classification remains intact.
- Liveness is unaffected by persistence outage.

### Authentication dependency tests

Where implemented, verify:

- Operational Authentication Service.
- Unavailable Authentication Service.
- Timeout.
- Malformed dependency result.
- No user token sent.
- No raw response exposed.
- Probe remains within the Validation Module boundary.
- Liveness remains unaffected.
- Readiness follows the approved dependency policy.

### Dependency-status tests

Verify:

- All dependencies operational.
- One optional dependency degraded.
- One required dependency unavailable.
- Unknown status.
- Disabled probe.
- Deterministic dependency ordering.
- Safe timestamps.
- Safe public summary.
- Protected detailed response where approved.
- No secrets or URLs returned.
- Correct HTTP status policy.

### Probe concurrency tests

Where active probes exist, verify:

- Concurrent calls reuse or safely coordinate one probe where approved.
- Probe timeout releases guards.
- Probe failure releases guards.
- No unbounded dependency calls.
- Cached result freshness.
- Expired cached result.
- Stale result indication.
- Shutdown prevents new probes where required.

### Shutdown tests

Verify:

- Readiness changes before shutdown completion.
- Health follows the approved draining policy.
- Refresh scheduling stops.
- Active dependency probes are handled safely.
- No stale status is published after shutdown.
- Shutdown does not require S3 or Authentication Service success.
- No open handles remain.

### Architecture boundaries

Verify:

- Health controllers do not import the AWS SDK.
- Readiness code does not call S3 directly.
- Authentication Service probes remain in the Validation Module.
- Dependency status does not inspect raw AWS SDK errors.
- No complete collection scan occurs.
- No database or Redis dependency is introduced.
- No public arbitrary dependency-probe route is introduced.
- Operational routes do not trigger cache refresh.
- Operational routes do not modify active state.

## Route-level integration tests

Use Hapi.js `server.inject` or the repository’s established Docker-free API test approach.

Verify:

1. Health route registration.
2. Readiness route registration.
3. Dependency-status route registration where approved.
4. Healthy liveness response.
5. Starting readiness response.
6. Hydrating readiness response.
7. Ready response.
8. Degraded but ready response where approved.
9. Not-ready response.
10. Shutdown response.
11. Missing mandatory dataset.
12. Optional dataset failure.
13. Previous valid data after refresh failure.
14. Persistence unavailable.
15. Authentication Service unavailable.
16. Dependency probe timeout.
17. Correlation header.
18. `Cache-Control: no-store` .
19. Safe content type.
20. No stack traces.
21. No raw AWS errors.
22. No raw Authentication Service response.
23. No credentials.
24. No complete manifest or collection content.
25. Existing API routes remain operational.
26. Normal tests remain Docker-free.
    Use dependency test doubles.

Do not require real S3, Floci, or Authentication Service calls for ordinary route tests.

## Floci integration tests

Use the existing separate Floci configuration only for focused persistence dependency checks where justified:

Shell

```text
npm run test:floci
```

Potential scenarios include:

- Configured bucket available.
- Configured bucket missing.
- Persistence endpoint unavailable.
- Startup hydration after deterministic bootstrap.
- Readiness after successful hydration.
- Readiness with previously loaded data after temporary persistence failure.
  Do not make ordinary health tests depend on Docker.

Do not duplicate the full unit suite in Floci tests.

## Regression testing

Run existing tests for:

- Configuration
- Application lifecycle
- Persistence
- Floci integration
- In-Memory Data Store
- Startup hydration
- Cache refresh
- Authentication Service integration
- Common API behaviour
- Manifest API
- Query engine
- Read APIs
- Upload validation mode
- Collection replacement
- Deterministic bootstrap
- Graceful shutdown
  Confirm:

- Liveness does not depend on external service availability.
- Readiness uses existing active runtime state.
- Cache refresh failure preserves previous valid data.
- Specific persistence error handling remains unchanged.
- `NoSuchBucket` remains distinct from missing object.
- Health endpoints do not trigger S3 reads of collection objects.
- Health endpoints do not trigger cache refresh.
- Health endpoints do not mutate runtime state.
- Normal tests remain Docker-free.
- Floci tests remain separate.

## Defra SonarCloud review

After implementation and tests pass, review every Step 24 source and test file against the configured Defra SonarCloud rules.

Use the repository’s configured SonarCloud project and:

Plain Text

```text
https://sonarcloud.io/organizations/defra/rules
```

Review especially for:

- Missing timeout handling
- Unbounded dependency calls
- Unbounded retries
- Resource leaks
- Open timers or handles
- Shared mutable state
- Race conditions
- Unhandled promise rejections
- Broad catch blocks
- Swallowed exceptions
- Sensitive-data exposure
- Hardcoded credentials
- Hardcoded dependency URLs
- Magic timeout values
- Duplicate status strings
- Excessive cognitive complexity
- Dead code
- Weak test assertions
- Inconsistent HTTP status handling
- Incorrect readiness transitions
- Direct AWS SDK access
- Authentication boundary violations
- High-cardinality metrics
- Excessive health-check logging
  Do not:

- Disable Sonar rules globally.
- Add broad suppression comments.
- Exclude Step 24 files.
- Weaken tests.
- Remove assertions.
- Change approved operational semantics silently.
  If a finding requires an operational, security, deployment, or architecture decision, stop and ask for clarification.

If SonarCloud runs only in CI, report that final verification remains pending CI.

## Documentation requirements

Update focused documentation covering:

- Liveness purpose
- Readiness purpose
- Dependency status purpose
- Endpoint paths
- HTTP status behaviour
- Startup hydration states
- Mandatory dataset readiness
- Optional dataset behaviour
- Refresh-failure behaviour
- Previous-valid-data behaviour
- Stale-data policy
- Persistence dependency policy
- Authentication Service dependency policy
- Active versus passive probes
- Probe timeouts
- Probe result caching
- Shutdown transitions
- Response examples
- Authentication policy
- Safe diagnostic exposure
- Cache-Control
- Local testing
- Floci testing
- Container orchestration configuration
- Troubleshooting not-ready state
- Troubleshooting missing datasets
- Troubleshooting dependency outages
- Security and performance considerations
  Do not include credentials, tokens, internal URLs, or complete dependency error details.

## Out of scope

Do not implement:

- New reference-data query behaviour
- New upload behaviour
- New replacement behaviour
- New canonical schemas
- New validation rules
- New normalisation rules
- New persistence provider
- Direct S3 access outside Persistence Module
- Direct Authentication Service access outside Validation Module
- Public arbitrary dependency probes
- Automatic dependency repair
- Automatic bucket creation in production
- Automatic seed bootstrap in production
- Redis
- Database functionality
- Distributed cache coordination
- Full monitoring-platform integration
- Alert configuration
- Production dashboard creation
- API Gateway deployment
- Fargate deployment
- IAM changes
- User-facing diagnostic detail
- Item-level mutations

## Expected deliverables

1. GitHub-generated plan saved as:
   Plain Text

```text
design/github-prompts/Step 24-implement-health-readiness-and-dependency-status-plan.md
```

1. Health endpoint.
2. Readiness endpoint.
3. Dependency-status endpoint or approved equivalent.
4. Explicit liveness policy.
5. Explicit readiness policy.
6. Mandatory dataset status.
7. Startup hydration status.
8. Cache refresh status.
9. Persistence dependency status where approved.
10. Authentication Service dependency status where approved.
11. Safe degraded-state behaviour.
12. Shutdown readiness integration.
13. No-store cache behaviour.
14. Correlation integration.
15. Structured logging.
16. Metrics hooks.
17. Docker-free unit tests.
18. Docker-free route integration tests.
19. Focused Floci tests where justified.
20. Regression verification.
21. Defra SonarCloud review.
22. Operational documentation.
23. Step completion report.

## Acceptance criteria

- The plan is saved before implementation.
- The saved plan is treated as approved.
- Copilot does not request plan approval.
- Health represents liveness.
- Readiness represents ability to serve intended traffic.
- External dependency failure does not automatically fail liveness.
- Readiness remains false until mandatory startup hydration succeeds.
- Every mandatory dataset must have valid active data before readiness succeeds.
- Optional dataset behaviour is explicitly documented.
- Failed later refresh retains readiness when previous valid mandatory data remains.
- Missing valid mandatory data makes readiness false.
- Shutdown makes readiness false.
- Dependency probes use finite timeouts.
- Dependency probes do not perform unbounded retries.
- S3 access remains inside the Persistence Module.
- Authentication Service access remains inside the Validation Module.
- Health routes do not trigger collection reads from S3.
- Health routes do not trigger cache refresh.
- Health routes do not modify runtime state.
- Operational responses use safe response contracts.
- `Cache-Control: no-store` is returned.
- Sensitive configuration is not exposed.
- Credentials and tokens are not exposed.
- Stack traces and raw dependency errors are not exposed.
- Dependency URLs and object keys are not exposed.
- Mandatory dataset status is deterministic.
- Liveness checks remain lightweight.
- Ordinary readiness checks avoid expensive full-collection scans.
- Normal tests remain Docker-free.
- Floci tests remain separate.
- Existing persistence error semantics remain unchanged.
- Tests, coverage, linting, formatting, and build pass.
- Step 24 changes are reviewed against Defra SonarCloud rules.
- Documentation matches implemented behaviour.
- Work outside Step 24 remains deferred.

## Verification

Use the repository’s actual package-manager scripts.

Run the applicable equivalents of:

Shell

```text
npm test -- <health-tests>
npm test -- <readiness-tests>
npm test -- <dependency-status-tests>
npm test -- <lifecycle-tests>
npm test -- <shutdown-tests>
npm test -- <architecture-boundary-tests>
npm test
npm run test:coverage
npm run lint
npm run format:check
npm run build
npm run test:floci
```

Run the repository’s Sonar or static-analysis command if available.

Explicitly verify:

Plain Text

```text
Step 24 plan saved
health route registered
readiness route registered
dependency route registered where approved
health returns 200 while live
health remains live during hydration
health remains live during S3 outage
health remains live during Authentication Service outage
readiness false before hydration
readiness false during hydration
readiness true after mandatory hydration
missing mandatory dataset
optional dataset failure policy
failed refresh with previous valid data
failed refresh without previous valid data
missing active manifest
invalid active manifest
persistence operational
persistence unavailable
configured bucket missing
Authentication Service operational
Authentication Service unavailable
dependency timeout
bounded probe duration
probe-result freshness
degraded status
not-ready status
shutdown readiness transition
no-store header
correlation header
safe response fields
no credentials
no tokens
no dependency URLs
no bucket object keys
no complete manifest
no complete collections
no stack traces
no raw AWS errors
no raw Authentication Service errors
no S3 access outside Persistence Module
no Authentication Service access outside Validation Module
no collection scan during liveness
no refresh triggered
no runtime-state mutation
normal tests remain Docker-free
Floci tests remain separate
NoSuchBucket remains distinct from missing object
```

Record:

- Exact commands
- Exit codes
- Test counts
- Coverage
- Type-check result
- Lint result
- Formatting result
- Build result
- Floci result
- Defra SonarCloud result
- Pre-existing failures
- Approved deviations
  If a command produces no output for more than two minutes:

1. Stop the command.
2. Report the exact command.
3. Report its last output.
4. Report whether the process remains active.
5. Wait for instruction before retrying.

## Completion response

After implementation, report:

1. Saved Step 24 plan path.
2. Summary of completed work.
3. Files created.
4. Files modified.
5. Health route and liveness policy.
6. Readiness route and policy.
7. Dependency-status route or equivalent.
8. Mandatory dataset policy.
9. Optional dataset policy.
10. Startup hydration behaviour.
11. Cache refresh and stale-data behaviour.
12. Persistence dependency policy.
13. Authentication Service dependency policy.
14. Active or passive probe behaviour.
15. Probe timeout and caching policy.
16. Shutdown readiness behaviour.
17. HTTP status behaviour.
18. Response contracts.
19. Authentication policy.
20. Security and redaction controls.
21. Logging and metrics.
22. Unit-test results.
23. Route integration-test results.
24. Floci test results where run.
25. Complete test-suite result.
26. Coverage result.
27. Lint and formatting results.
28. Build result.
29. Architecture-boundary results.
30. Defra SonarCloud review result.
31. Existing issues not introduced by Step 24.
32. Confirmation that no database or Redis was introduced.
33. Confirmation that no direct S3 or Authentication Service access was added outside approved boundaries.
34. Work deferred to subsequent steps.
35. Remaining assumptions, risks, or owner decisions.
    Do not modify the approved implementation plan.

If you reach any ambiguity, ask me to clarify.
