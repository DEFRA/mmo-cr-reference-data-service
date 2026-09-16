# Step 12 Implementation Plan: Authentication Service Integration

## 1. Repository state discovered

- `src/common/contracts/authentication-client.js` (Step 03) already defines the final internal
  contract (`authenticate`, `authorize`) and final permission names (`reference-data.read`,
  `reference-data.write`) — these are not provisional.
- No concrete Authentication Service client, HTTP call, or real endpoint contract exists anywhere
  in the repository or its design docs (confirmed by full-text search across `design/` and `src/`).
  This matches the master plan's own assumption 11.
- `config.js` (extended in Step 11) already has `authentication.{serviceUrl,timeoutMs,retryCount,
retryDelayMs}`. `tracing.header` (`x-cdp-request-id`, via `@defra/hapi-tracing`) is the existing
  correlation convention, reused here rather than inventing a second one.
- No HTTP client dependency exists in the repo beyond native Node/global `fetch`; `vitest-fetch-mock`
  is already a devDependency and wired in `.vite/setup-files.js`, so no new dependency is needed.

## 2. Owner-confirmed decision

No real Authentication Service contract exists. Approved: implement the adapter + a real HTTP
client against a minimal, clearly-labelled **PROVISIONAL** assumed REST contract —
`POST {authentication.serviceUrl}/validate`, `Authorization: Bearer <token>` (+ the existing
`x-cdp-request-id` correlation header) → `{ actorId: string, permissions: string[] }` — plus a
synthetic test double for local/dev and unit tests. Every file states this is provisional pending
real confirmation.

## 3. Proposed file structure

```
src/reference-data/validation/authentication/
  http-authentication-client.js       (+ test)  PROVISIONAL real HTTP client
  test-authentication-client.js       (+ test)  synthetic test double
  permission-check.js                 (+ test)  requireAuthenticatedActor/requireReadPermission/
                                                 requireWritePermission/hasExactPermission/authorize
src/reference-data/validation/index.js  modified: composes the production authenticationClient,
                                                    re-exports the factories and permission helpers
src/architecture-boundaries.test.js      modified: new boundary assertion (auth client confined to
                                                    reference-data/validation/**)
```

## 4. Contracts and mapping

`authenticate({ token, correlationId })` → `AuthenticationOutcome` (Step 03 shape). Failure codes
used: `unauthorized` (missing/invalid/expired token), `forbidden` (403 from the service — reserved,
not the read/write permission check, which is local), `authentication_service_unavailable`
(unconfigured, network failure, timeout, malformed response, non-2xx after retries exhausted).
`authorize({ actor, permission })` and `requireReadPermission`/`requireWritePermission` are pure,
local, exact-match checks against the actor already returned by `authenticate` — never a second
network call.

## 5. Retry policy

Bounded (`authentication.retryCount`, default 1; `authentication.retryDelayMs`, default 100ms).
`401`/`403` never retried (returned immediately). Explicit `502/503/504` and network-level
failures (including timeout) are retried up to the bound; any other non-2xx status fails
immediately without retry.

## 6. Security

Raw tokens are read only to build the `Authorization` header for the single outbound request and
never appear in the returned outcome, logs, or errors (round-tripped only as `Bearer <token>` in
one outgoing header). Missing configuration or malformed responses fail closed. The test double is
never wired into the production composition root.

## 7. Explicitly deferred

Login/logout/token issuance, Hapi HTTP error-status mapping (Step 13), collection validation,
normalisation, persistence, cache-refresh, database/Redis, OpenAPI, metrics/audit (Step 25).

## 8. Verification commands

```
npm run lint
npm test
```
