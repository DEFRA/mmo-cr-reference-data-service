# Step 12: Implement Authentication Service Integration

## Recommended reasoning effort

- Planning phase: High
- Implementation phase: High

## Role

Act as a senior Node.js backend engineer implementing the Reference Data Service for the Catch Recording application.

Implement Authentication Service integration exactly as defined by Step 12 of the approved Reference Data Service implementation plan.

Do not change, reorder, expand, reduce, or reinterpret the approved plan.

## Approved objective

Integrate token validation and permission checks through the Validation Module.

## Approved dependencies

This step depends on:

- Step 02: Establish the service structure and configuration
- Step 03: Define shared domain types and contracts
- Step 08: Implement common structural and business validation
  Before implementation, verify that these dependencies are complete.

Do not implement missing work from unrelated steps silently.

## Required working mode

Start in Plan mode.

Before proposing changes:

1. Inspect the complete repository.
2. Read the approved Reference Data Service implementation plan.
3. Read the approved prompts and saved plans for Steps 01 through 11.
4. Inspect the implementation completed through Step 11.
5. Inspect the Validation Module boundary established in Step 02.
6. Inspect the authentication and authorisation contracts created in Step 03.
7. Inspect the shared service-error contract created in Step 03.
8. Inspect the common validation engine and validation-result contracts implemented in Step 08.
9. Inspect the application configuration established in Step 02, including:

- Authentication Service URL
- Request timeout configuration
- Logging configuration
- Runtime environment
- Correlation or tracing header

10. Inspect existing HTTP client conventions and dependencies.
11. Inspect existing Hapi authentication or authorisation plugins, if any.
12. Inspect existing request tracing and correlation conventions.
13. Inspect existing logging and redaction behaviour.
14. Inspect the current test framework and mocking conventions.
15. Search for any existing Authentication Service client or integration that should be reused.
16. Review the current working tree:
    Shell

```text
git status --short
git diff --stat
```

1. Identify any ambiguity in the Authentication Service contract, including:

- Endpoint
- HTTP method
- Required headers
- Request payload
- Success response
- Invalid-token response
- Expired-token response
- Permission or role representation
- Timeout requirements
- Retry policy

1. Do not invent missing Authentication Service details.
   Do not modify files during the planning phase.

Produce a concise, file-by-file implementation plan and wait for approval.

After the plan is approved, the first implementation action must be to save the approved plan as:

Plain Text

```text
github-prompts/Step 12-implement-authentication-service-integration-plan.md
```

Only after saving the approved plan may source-code implementation begin.

## Ambiguity rule

The approved implementation plan identifies the following decisions as potentially unresolved:

- Exact Authentication Service endpoint
- Exact Authentication Service request contract
- Exact Authentication Service response contract
- Exact permission or role names
  If these details are not already established in approved repository documentation or existing implementation:

1. Stop during planning.
2. Report the exact missing information.
3. Show the relevant existing configuration or contract.
4. Present the smallest set of available options.
5. Recommend an option with rationale.
6. Wait for clarification.
   Do not implement a speculative external API contract.

## Approved scope

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
  The provisionally proposed permissions are:

Plain Text

```text
reference-data.read
reference-data.write
```

These permission names must be confirmed against the approved Authentication Service contract before being treated as final.

Do not log raw access tokens.

## Architecture context

The Validation Module:

- Is the only Reference Data Service component permitted to communicate directly with the Authentication Service.
- Validates authentication outcomes.
- Applies authorisation decisions.
- Returns domain-compatible authentication and authorisation results.
- Converts Authentication Service failures into existing service errors.
  Other components must depend on the internal authentication and authorisation contract defined in Step 03.

The following components must not call the Authentication Service directly:

- Reference Data Controller
- Query Module
- Command Module
- Data Normalisation Module
- Persistence Module
- Cache Refresh Module
- In-Memory Data Store

## Mandatory architectural constraints

### Exclusive Authentication Service ownership

Only the Validation Module may:

- Construct the Authentication Service client.
- Make HTTP requests to the Authentication Service.
- Forward bearer tokens externally.
- Interpret Authentication Service responses.
- Map roles or permissions.
- Convert Authentication Service failures into authentication errors.
  Add or update an architecture-boundary test confirming this rule.

### No persistence access

Do not:

- Import the AWS SDK.
- Access S3.
- Access Floci.
- Call the Persistence Module.
- Read reference-data files.
- Write authentication results to persistent storage.

### No database

Do not introduce:

- MongoDB
- Redis
- DynamoDB
- SQL storage
- An ORM or ODM
- Database models
- Database repositories
- Database sessions
- Token persistence
- Authentication-result persistence
  Authentication results must not be persisted in this step.

### No API endpoint implementation

Do not implement:

- Reference-data query endpoints
- Manifest endpoint
- Upload endpoint
- Login endpoint
- Logout endpoint
- Token issuance endpoint
- Token refresh endpoint
- User-management endpoint
- Hapi route-level error mapping assigned to Step 13
  This service validates externally issued credentials. It does not issue credentials.

### No business-data validation changes

Do not modify:

- Canonical schemas
- Common collection validation
- Dataset-specific validation
- Data normalisation
- Query behaviour
- Cache refresh
- Collection persistence

## Authentication flow

Implement the internal authentication flow using the confirmed external contract.

The intended sequence is:

1. Receive a bearer token through the internal Validation Module API.
2. Validate the token input before making an external call.
3. Forward the token securely to the Authentication Service.
4. Propagate the approved correlation identifier.
5. Apply the configured timeout.
6. Interpret the Authentication Service response.
7. Map the authenticated actor into the Step 03 internal contract.
8. Map roles or permissions into the internal permission model.
9. Return an authentication result without returning or storing the raw token.
10. Translate failures into the approved service-error model.
    Do not couple the internal result to a concrete HTTP-client response.

## Bearer-token handling

Implement safe token handling.

Requirements:

- Accept the token through the existing internal contract.
- Validate that a token value is present before making a request.
- Avoid storing the token beyond the duration of the validation call.
- Do not include the token in returned actor or authorisation results.
- Do not include the token in error details.
- Do not include the token in logs.
- Do not include the token in metrics.
- Do not include the token in audit events.
- Ensure HTTP client logging does not expose the Authorization header.
- Preserve the token exactly when forwarding it, according to the confirmed Authentication Service contract.
- Do not decode or trust token claims locally unless explicitly required by an approved contract.
  Do not implement token issuance, refresh, or revocation.

## Authentication Service client

Implement a focused client owned by the Validation Module.

The client must support:

- Configured base URL.
- Confirmed validation endpoint.
- Confirmed HTTP method.
- Bearer-token forwarding.
- Correlation-header forwarding.
- Configured timeout.
- Controlled retry behaviour.
- Safe response parsing.
- Safe error translation.
- Dependency injection or test substitution.
  The client must not:

- Be exported as a general-purpose HTTP client.
- Be used by other application modules.
- Expose raw HTTP response objects through the domain contract.
- Log request headers containing credentials.
- retry authentication failures such as `401` or `403` .
- Perform unbounded retries.
- make network calls during module import.
  Reuse the repository’s existing HTTP client and proxy conventions where suitable.

Do not add a new HTTP client dependency unless the repository lacks an appropriate mechanism and the addition is justified in the approved plan.

## Actor identity mapping

Map the confirmed successful Authentication Service response into the existing Step 03 actor contract.

The internal actor representation should contain only approved fields, such as:

- Stable actor or user identifier
- Display-safe identifier where required
- Roles
- Permissions
- Authentication status
- Relevant tenancy or organisation context only if required by the approved contract
  Do not include:

- Raw access token
- Refresh token
- Password
- Secret
- Complete Authentication Service response
- Unneeded personal information
- Raw HTTP headers
  Do not invent actor fields absent from the confirmed external contract.

## Permission model

Support separate permission checks for:

Plain Text

```text
reference-data.read
reference-data.write
```

Treat these names as provisional until confirmed.

### Read permission

The read permission will later protect operations such as:

- Manifest retrieval
- Full collection retrieval
- Search
- Individual-item retrieval
- Map retrieval
  Do not implement those API operations in this step.

### Write permission

The write permission will later protect operations such as:

- Validation-only full collection upload
- Atomic full collection replacement
  Do not implement those upload operations in this step.

### Permission evaluation

Implement deterministic permission evaluation.

Requirements:

- Exact approved permission matching.
- No substring matching.
- No implicit write permission merely because read permission exists.
- No implicit read permission from write permission unless explicitly approved.
- No role-based assumptions unless the Authentication Service contract defines them.
- No permissive fallback when permission data is missing.
- Fail closed for unresolved or malformed permission information.
- Preserve the distinction between unauthenticated and unauthorised outcomes.

## Authorisation operations

Provide internal Validation Module operations equivalent to:

- Require an authenticated actor.
- Require read permission.
- Require write permission.
- Check a specified approved permission if supported by the Step 03 contract.
  The operations must:

- Use the internal actor and permission contract.
- Return the approved result or actor data.
- Throw or return the existing service-error type according to repository conventions.
- Avoid Hapi response creation.
- Avoid direct route handling.
- Avoid persistence or cache access.
  Do not create a competing authorisation framework if Step 03 already defines one.

## Response mapping

Map Authentication Service outcomes deterministically.

At minimum, handle:

### Successful token validation

Return an authenticated internal actor with approved roles or permissions.

### Missing token

Map to the existing unauthorised service error.

Expected category:

Plain Text

```text
unauthorized
``
```

### Invalid token

Map to:

Plain Text

```text
unauthorized
```

Do not expose whether token signature, issuer, audience, or another sensitive check failed unless the approved external contract explicitly allows a safe reason.

### Expired token

Map to:

Plain Text

```text
unauthorized
```

The internal diagnostic cause may distinguish expiry if supported, but the public-safe message must remain controlled.

### Insufficient permission

Map to:

Plain Text

```text
forbidden
```

### Authentication Service unavailable

Map to:

Plain Text

```text
authentication_service_unavailable
```

This includes appropriate cases such as:

- Connection refusal
- DNS resolution failure
- Timeout
- Temporary server failure
- Exhausted controlled retry attempts

### Malformed Authentication Service response

Fail closed and map to an approved dependency or internal-contract error.

Do not treat a malformed success response as authenticated.

### Rate limiting

Map Authentication Service throttling according to the approved service-error conventions.

Do not retry indefinitely.

## Timeout behaviour

Use the configuration established in Step 02 or add the smallest necessary validated configuration if an Authentication Service timeout is not yet represented.

If configuration changes are required:

1. Identify the missing value during planning.
2. Propose the smallest compatible addition.
3. Add validation and tests.
4. Do not redesign the broader configuration structure.
   Timeout requirements:

- Every Authentication Service call must have a finite timeout.
- Timeout must produce `authentication_service_unavailable` .
- Timeout errors must not contain the raw token.
- Tests must not wait for the real timeout duration.
- Use fake timers or a controlled client test double where appropriate.

## Controlled retry behaviour

Before implementing retries, inspect existing repository and platform conventions.

Requirements:

- Do not retry `400` , `401` , or `403` .
- Do not retry malformed token inputs.
- Retry only explicitly approved transient failures.
- Use a small bounded retry count.
- Avoid unbounded exponential delays.
- Avoid retry storms.
- Respect platform or response retry guidance where available.
- Make retry behaviour testable without real delays.
- Record the final cause safely.
- Do not log the bearer token during retries.
  If no retry policy is approved, stop and ask for clarification rather than inventing one.

## Correlation propagation

Use the tracing or correlation convention established in Step 02 and the current repository.

Requirements:

- Accept an approved correlation identifier through the internal contract.
- Forward the identifier using the configured tracing header.
- Do not generate conflicting identifiers inside the client when one is supplied.
- Validate or safely constrain externally supplied correlation values where an existing utility is available.
- Include the correlation identifier in safe service errors.
- Do not include bearer tokens in correlation metadata.
  Do not implement the complete request-correlation middleware assigned to Step 13.

## Error handling

Use the Step 03 service-error model.

Do not create a second error class or public error envelope.

Use existing error codes, including:

Plain Text

```text
unauthorized
forbidden
authentication_service_unavailable
```

Add the smallest central error-code extension only if an approved case is not currently represented.

Errors must:

- Have stable machine-readable codes.
- Have safe messages.
- Preserve an internal cause only through the approved internal mechanism.
- Avoid exposing HTTP client internals.
- Avoid exposing the Authentication Service URL.
- Avoid exposing headers.
- Avoid exposing tokens.
- Include correlation information when supplied.
- Distinguish authentication failure from dependency unavailability.
  Do not implement the final HTTP status mapper. That belongs to Step 13.

## Dependency injection and local test strategy

The Authentication Service client must be replaceable in tests.

Provide a controlled test implementation or test double that can represent:

- Authenticated actor with read permission.
- Authenticated actor with write permission.
- Authenticated actor with both permissions.
- Authenticated actor with no required permission.
- Invalid token.
- Expired token.
- Authentication Service unavailable.
- Timeout.
- Malformed success response.
  The test implementation must not bypass production security accidentally.

Requirements:

- It must not become the production default.
- It must not accept arbitrary tokens as valid in deployed environments.
- Its use must be explicit.
- Its configuration must be environment-safe.
- It must not expose hardcoded production identities.
- It must use synthetic actor identifiers.
  Do not create a development backdoor.

## Architecture-boundary verification

Add or update an architecture test confirming that:

- Only the Validation Module imports the concrete Authentication Service client.
- Other production modules depend only on internal authentication or authorisation contracts.
- No controller, query, command, persistence, cache, normalisation, or in-memory module directly calls the Authentication Service.
- No raw token is stored in domain state.
  Follow existing architecture-test conventions.

Do not make the test so broad that focused test doubles become impossible.

## Required unit tests

Testing is part of Step 12 and must be completed during this step.

### Client-construction tests

Verify:

1. The configured Authentication Service URL is used.
2. The confirmed validation endpoint is used.
3. The confirmed HTTP method is used.
4. Client construction performs no network request.
5. The client can be replaced with a test double.
6. Missing required client configuration fails safely.
7. The configured timeout is applied.

### Token-forwarding tests

Verify:

1. A valid token is forwarded using the confirmed contract.
2. The token is forwarded exactly once per attempt.
3. The correlation identifier is forwarded.
4. The raw token is not returned in the authentication result.
5. The raw token is not included in errors.
6. The raw token is not included in logs.
7. A missing token causes no external request.

### Response-mapping tests

Verify:

1. A valid success response maps to an authenticated actor.
2. Actor ID is mapped correctly.
3. Roles are mapped correctly where applicable.
4. Permissions are mapped correctly.
5. Unknown response fields do not leak into the actor contract.
6. A malformed success response fails closed.
7. Missing actor identity fails closed.
8. Missing or malformed permission information fails closed.

### Authentication-failure tests

Verify:

1. Missing token maps to `unauthorized` .
2. Invalid token maps to `unauthorized` .
3. Expired token maps to `unauthorized` .
4. Authentication failure does not expose sensitive diagnostic detail.
5. `401` is not retried.
6. Invalid input causes no external request.

### Authorisation tests

Verify:

1. Read permission authorises read access.
2. Missing read permission maps to `forbidden` .
3. Write permission authorises write access.
4. Missing write permission maps to `forbidden` .
5. Read permission does not automatically grant write permission.
6. Write permission does not automatically grant read permission unless explicitly approved.
7. Exact permission matching is used.
8. Substring or partial permission matching is rejected.
9. Missing permission data fails closed.
10. Actor and permission inputs are not mutated.

### Dependency-failure tests

Verify:

1. Connection refusal maps to `authentication_service_unavailable` .
2. DNS failure maps to `authentication_service_unavailable` .
3. Timeout maps to `authentication_service_unavailable` .
4. Temporary server failure maps correctly.
5. Throttling maps correctly.
6. Malformed remote data fails closed.
7. Internal HTTP-client details do not appear in public-safe errors.
8. Correlation identifier is preserved in the service error.

### Retry tests

If retries are approved, verify:

1. Approved transient errors are retried.
2. Retry count is bounded.
3. Authentication failures are not retried.
4. Authorisation failures are not retried.
5. Malformed requests are not retried.
6. Timeout behaviour remains bounded.
7. Tests do not use real delays.
8. The raw token is never logged across retry attempts.

### Test-client tests

Verify:

1. The test implementation returns controlled synthetic actors.
2. Read and write permissions can be configured independently.
3. Invalid-token behaviour can be simulated.
4. Unavailable-service behaviour can be simulated.
5. The test implementation cannot become active implicitly in deployed environments.
6. No hardcoded real user information is included.

### Architecture tests

Verify:

1. Concrete Authentication Service access is confined to the Validation Module.
2. Other modules import only the internal contract.
3. No AWS, S3, Floci, database, or Redis dependency is introduced by this step.
4. No raw token is stored in global or module-level application state.

## Local integration testing

The approved plan requires a local integration strategy.

If a real local Authentication Service is already available and documented:

- Use the approved local endpoint.
- Use only safe synthetic credentials.
- Do not commit valid secrets.
- Verify successful authentication.
- Verify invalid token handling.
- Verify unavailable-service handling.
- Keep integration tests isolated.
  If no local Authentication Service is available:

- Use the controlled injected test implementation for local application testing.
- Use an HTTP stub only if consistent with repository conventions.
- Clearly document that the test double validates integration boundaries, not the real Authentication Service contract.
- Do not pretend a mock proves external compatibility.
- Record real contract integration as pending.
- Do not add a new infrastructure emulator without approval.

## Regression testing

Run:

- Step 12 Authentication Service client tests.
- Step 12 authorisation tests.
- Step 08 validation tests.
- Existing architecture-boundary tests.
- The complete repository test suite.
- Test coverage.
- Linting.
- Formatting checks.
  Do not defer these tests to Step 26.

## SonarCloud considerations

Avoid introducing:

- Hardcoded tokens.
- Hardcoded real user identities.
- Hardcoded Authentication Service URLs.
- Unbounded retries.
- Duplicate permission strings.
- Excessive cognitive complexity.
- Broad catch blocks that discard causes.
- Logging of sensitive headers.
- Unhandled promise rejections.
- Mutable global authentication state.
- Magic numbers for timeout or retry values.
- Empty catch blocks.
- Weak random identifiers.
  Use central constants or validated configuration for:

- Permission names
- Timeout values
- Retry limits
- Tracing-header names
- Authentication endpoint paths where appropriate
  Do not disable SonarCloud rules globally.

## Documentation requirements

Add or update focused documentation covering:

- Validation Module ownership of Authentication Service access.
- Authentication flow.
- Authorisation flow.
- Read and write permissions.
- Authentication Service configuration.
- Timeout behaviour.
- Retry behaviour.
- Correlation propagation.
- Failure mapping.
- Token-redaction requirements.
- Local test strategy.
- Remaining external-contract assumptions.
  Do not duplicate the complete implementation plan or API design.

## Security and privacy considerations

- Never log bearer tokens.
- Never persist bearer tokens.
- Never return bearer tokens in result objects.
- Never return internal authentication diagnostics publicly.
- Fail closed on malformed responses.
- Use exact permission matching.
- Apply finite timeouts.
- Use bounded retries only for approved transient failures.
- Do not retry invalid credentials.
- Do not create a production authentication bypass.
- Ensure the local test implementation cannot be selected accidentally in deployed environments.
- Minimise actor information held by the service.
- Use synthetic test identities.
- Do not include real personal information in fixtures.
- Ensure logs redact Authorization and security-sensitive headers.
- Preserve correlation identifiers without combining them with token data.

## In scope

- Authentication Service client abstraction
- Concrete client inside the Validation Module
- Token forwarding
- Safe response mapping
- Internal actor mapping
- Role or permission mapping
- Read permission enforcement
- Write permission enforcement
- Timeout handling
- Approved controlled retry handling
- Unavailable-service mapping
- Correlation propagation
- Test implementation or test double
- Unit tests
- Local integration strategy
- Architecture-boundary verification
- Focused documentation

## Out of scope

Do not implement:

- Changes to the approved implementation plan
- Login
- Logout
- Token issuance
- Token refresh
- Token revocation
- User management
- Reference-data API endpoints
- Manifest API
- Query endpoints
- Upload endpoints
- Hapi HTTP error mapping
- Collection validation changes
- Dataset validation changes
- Data normalisation
- S3 or Floci access
- Persistence changes
- Cache hydration
- Cache refresh
- In-Memory Data Store changes
- Database functionality
- Redis
- OpenAPI definitions
- Metrics and audit events assigned to Step 25
- Production deployment infrastructure
- IAM provisioning

## Expected deliverables

The approved Step 12 deliverables are:

1. Authentication client interface and implementation.
2. Authorisation checks in the Validation Module.
3. Authentication error mapping.
4. Unit tests for authorised and unauthorised scenarios.
5. Local test strategy.
   Also produce:

6. Approved implementation plan saved at:
   Plain Text

```text
github-prompts/Step 12-implement-authentication-service-integration-plan.md
```

1. Architecture-boundary verification.
2. Focused authentication documentation.

## Approved completion criteria

The step must satisfy the approved plan criteria:

- Missing or invalid credentials return the internal equivalent of `401` .
- Insufficient permission returns the internal equivalent of `403` .
- Authentication Service failure returns the internal equivalent of `503` .
- Read and upload operations use distinct permissions.
- No component other than the Validation Module directly calls the Authentication Service.
- Tokens and security-sensitive headers are redacted from logs.
  Because the final HTTP mapping belongs to Step 13, this step should produce the correct service errors:

Plain Text

```text
unauthorized
forbidden
authentication_service_unavailable
```

Do not implement Hapi response mapping prematurely.

The implementation must also demonstrate:

- Authentication failures are not retried.
- Approved transient failures use bounded retry behaviour.
- Malformed Authentication Service responses fail closed.
- Correlation identifiers are propagated.
- Raw tokens never enter result objects, errors, logs, or persistent state.
- Tests use synthetic identities.
- No database, Redis, persistence, cache, query, upload, or API functionality is introduced.

## Verification

Inspect `package.json` and use the repository’s actual scripts.

Run the applicable equivalents of:

Shell

```text
npm test -- <authentication-client-tests>
npm test -- <authorisation-tests>
npm test -- <architecture-boundary-tests>
npm test
npm run test:coverage
npm run lint
npm run format:check
```

If a local Authentication Service or approved HTTP stub is available, run the documented local integration tests separately.

Format all files created or modified by Step 12.

If the repository-wide formatting check reports unrelated generated artifacts:

1. Confirm every file changed by Step 12 passes Prettier.
2. Do not reformat unrelated generated conversation or metadata files.
3. Report remaining warnings accurately.
4. Do not claim that the repository-wide formatting command passed if it failed.
   If a pre-existing failure occurs:

5. Record the exact command.
6. Record the relevant failure.
7. Determine whether Step 12 caused it.
8. Fix failures introduced by Step 12.
9. Do not broaden scope silently.
10. Ask for clarification if resolution requires unrelated work.
    No S3, Floci, database, Redis, or reference-data API integration testing is required for Step 12.

## Final response requirements

After implementation, report:

1. Summary of completed work.
2. Saved Step 12 plan path.
3. Files created.
4. Files modified.
5. Confirmed Authentication Service contract used.
6. Client-construction approach.
7. Dependency-injection approach.
8. Token-forwarding behaviour.
9. Actor and permission mapping.
10. Read-authorisation behaviour.
11. Write-authorisation behaviour.
12. Timeout configuration.
13. Retry behaviour.
14. Correlation propagation.
15. Error mappings.
16. Sensitive-data redaction.
17. Test implementation or local integration strategy.
18. Tests added.
19. Focused test results.
20. Complete test-suite result.
21. Coverage result.
22. Lint result.
23. Formatting result.
24. Architecture-boundary result.
25. Confirmation that only the Validation Module accesses the Authentication Service.
26. Confirmation that no raw tokens are logged, persisted, or returned.
27. Confirmation that no database or Redis functionality was introduced.
28. Confirmation that no S3, Floci, cache, data-validation, normalisation, query, upload, or API functionality was introduced.
29. Work deferred to later approved steps.
30. Remaining assumptions, risks, or owner decisions.
    Do not modify the approved implementation plan.

If you reach any ambiguity, ask me to clarify.
