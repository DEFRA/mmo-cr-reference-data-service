# Phase 04 — Completion Report: Cache Lifecycle, Authentication, and Common API Behaviour

## Phase completion summary

Steps 11, 12, and 13 implemented sequentially, each with its own saved plan and completion
summary, per the phase execution model. All ambiguities identified during phase planning (Step 12
Authentication Service contract; Step 13 correlation header and 409/412 mapping; Step 11
lifecycle-knob defaults) were raised to the owner and explicitly resolved before implementation —
recorded in `/memories/repo/conventions.md`.

## Plan paths

- [Phase 04 plan](./Phase%2004-cache-lifecycle-authentication-and-common-api-behaviour-plan.md)
- [Step 11 plan](./Step%2011-implement-cache-refresh-and-startup-hydration-plan.md) / [summary](./step-11-completion-summary.md)
- [Step 12 plan](./Step%2012-implement-authentication-service-integration-plan.md) / [summary](./step-12-completion-summary.md)
- [Step 13 plan](./Step%2013-implement-common-api-behaviour-and-error-handling-plan.md) / [summary](./step-13-completion-summary.md)

## Files created/modified per step

See each step's individual completion summary for the full file list. Headline additions:
`src/reference-data/cache-refresh/*` (hydration/refresh/scheduler/readiness), `GET /health/ready`,
`src/reference-data/validation/authentication/*` (HTTP client, test double, permission checks),
`src/plugins/{correlation,error-response}.js`, `src/common/helpers/api/*`,
`src/common/domain/http-status.js`. `config.js` gained all Step 11/12 knobs.

## Cache hydration and refresh behaviour

Startup hydration reads the active manifest through the Persistence Module only, validates it
structurally + for duplicate/unsupported entries, processes each dataset through the approved
structural → normalise → business pipeline, and publishes atomically per dataset via the In-Memory
Data Store. Mandatory-dataset availability for readiness is derived live from the store
(`store.hasCollection`), not duplicated bookkeeping. Refresh only re-downloads changed datasets
(checksum → etag → version → lastModified precedence), isolates failures per dataset (previous
valid data retained), and reports removed-but-still-manifested datasets as failures without
deleting the retained data.

## Cache failure and partial-availability behaviour

Verified by test: one invalid/failed mandatory dataset does not block hydration of the others; a
failed refresh for a dataset with prior valid data keeps the service ready; a mandatory dataset
with no valid data ever (missing from manifest, or every attempt failed) keeps the service not
ready; `markShuttingDown()` immediately flips readiness to false.

## Authentication Service contract used

**PROVISIONAL** (no real contract exists anywhere in the repo/design docs — confirmed by
full-text search, owner-approved fallback): `POST {authentication.serviceUrl}/validate`,
`Authorization: Bearer <token>` + the existing `x-cdp-request-id` header →
`{ actorId: string, permissions: string[] }`. Final permission names
(`reference-data.read`/`reference-data.write`) were already fixed by Step 03, not provisional.

## Authentication and authorisation behaviour

`authenticate()` fails closed for: missing token, unconfigured `baseUrl`, 401/403, malformed/
incomplete success bodies, and non-2xx after bounded retries. `requireReadPermission`/
`requireWritePermission` perform exact, local permission matching against the already-authenticated
actor (no second network call); missing/malformed permission data fails closed to `forbidden`.

## Timeout and retry behaviour

`authentication.timeoutMs` (default 2000ms) via `AbortController`. `401`/`403` never retried.
`502/503/504` and network/timeout failures retried up to `authentication.retryCount` (default 1)
with `authentication.retryDelayMs` (default 100ms) between attempts; any other non-2xx status fails
immediately without retry. All retry tests use `retryDelayMs: 0` / mocked timers — no real delays.

## Token-redaction verification

Dedicated test asserts the raw token string never appears in `JSON.stringify(outcome)`; the token
is used only to build one outgoing `Authorization` header per attempt.

## Common API and error behaviour

Every error reaching the API boundary — known domain/service errors (checked first, by `.code`,
before any generic Boom status), Boom validation failures (mapped to allowlisted
`{path, message}` detail pairs), unmatched routes, and unexpected errors — is converted to the
standard `{ error: { code, message, traceId, ... } }` envelope with the correct HTTP status. No
stack traces, raw Joi/Boom payloads, or raw AWS errors ever reach a response (verified by test).

## Correlation handling

Reuses the existing `x-cdp-request-id` header end-to-end: a valid supplied value is preserved; a
missing or invalid (regex-rejected) value is replaced with a generated UUID; the same value is
used for the response header and every error's `traceId`.

## ETag and conditional-request handling

`matchesIfNoneMatch`/`matchesIfMatch`/`parseIfMatchCandidates` implemented and unit-tested
(opaque-value comparison, weak/strong and wildcard support). Not yet wired into any route since no
read/write routes exist until Step 14 onward — prepared for reuse.

## Request-size and media-type handling

`payload_too_large` (413) and `unsupported_media_type` (415) mappings implemented and tested via
the Boom-status branch of the error mapper; enforcement itself is Hapi's existing route/server
payload configuration (no route uses non-default limits yet, since no upload route exists until
Step 21).

## Test results

- Focused Step 11 tests: cache-refresh module, 14/14 service tests + supporting pure-module tests, all passing.
- Focused Step 12 tests: 40/40 authentication tests passing.
- Focused Step 13 tests: ~70 tests (error mapping, correlation, server integration) passing.
- Complete suite: **769 passed / 6 skipped** (Floci-gated, unaffected), 0 regressions.
- Coverage: ~97% statements / ~90% branches / ~98% functions.
- Lint: pass. Format: pass for every file created/modified in this phase.
- Architecture boundaries: 2/2 pass (S3 SDK confined to `persistence/**`; Authentication Service
  client confined to `reference-data/validation/**`).

## Defra SonarCloud analysis method

No SonarCloud CI/API access is available in this environment, so this is a **local static review**
against the Defra rule risk list in the phase prompt, applied to every file created/modified in
Steps 11–13. Final CI-based SonarCloud verification is **pending** and should be confirmed once
this branch runs through the repository's actual SonarCloud pipeline.

## Rules/risk areas reviewed

Hardcoded credentials/tokens/URLs (none found — `authentication.serviceUrl` is always read from
config); magic numbers (named constants used throughout: `HTTP_STATUS_UNAUTHORIZED`,
`SERVER_ERROR_THRESHOLD`, `ONE_HOUR_SECONDS`, etc.); duplicate literals (dataset/error-code strings
reused via existing `SERVICE_ERROR_CODES`/`DATASETS` constants, not re-typed); cognitive complexity
(largest new functions — `cache-refresh-service.js`'s `runHydration`/`runRefresh`,
`http-authentication-client.js`'s `authenticate` — kept flat via early returns and small helper
extraction); broad/unsafe catch blocks (every catch in new code narrows on `.code`/`.isBoom`/
`.retryableStatus` rather than swallowing generically); unhandled promise rejections (scheduler's
`onError` callback prevents a failed scheduled refresh from becoming an unhandled rejection;
`hydrate()`/`refresh()` never reject, always resolve to a result); unbounded retries/timers
(`retryCount`/`hydrationTimeoutMs`/scheduler interval all configurable and finite; scheduler timers
`unref()`d); sensitive-data logging (tokens never logged, verified by test; readiness/error
responses are allowlisted); mutable global state (services are all factory-created, no
module-level mutable singletons outside the intentional production composition roots already
established by earlier steps' conventions).

## Sonar issues fixed

One pre-existing latent bug found and fixed during Step 11: `validate-positive-integer.js`'s
convict format never coerced env-string values to numbers (silently returning strings for numeric
config). Added a `coerce` function there and to the new `validate-non-negative-integer.js`.

## Sonar issues accepted with approval

None required — no findings needed a suppression or accepted-risk deviation.

## Security hotspots reviewed

Authentication token handling (never logged/persisted/returned), correlation-id input (bounded
allowlist regex, regenerated rather than trusted when invalid), error-detail redaction (allowlisted
fields only), retry/timeout bounding (no infinite loops or unbounded delay).

## Confirmations

- No database or Redis functionality was introduced.
- No later-step functionality (manifest API, query engine, uploads, seed data, metrics/audit) was
  implemented.
- Only the Persistence Module accesses S3/Floci; only the Validation Module accesses the
  Authentication Service (both enforced by `architecture-boundaries.test.js`).
- Tokens and credentials are not exposed in logs, errors, or responses.
- The next approved implementation step remains **Step 14: Implement the manifest API**.

## Remaining ambiguities, risks, or owner decisions

- The real Authentication Service contract remains unconfirmed; everything in
  `http-authentication-client.js` is explicitly labelled provisional and must be revisited once a
  real contract is available.
- SonarCloud CI verification is pending — this report reflects a manual review only.
- `conditional-request.js`/`cache-control.js`/`pagination.js` are implemented and tested but not
  yet wired into a route, since no read/write route exists before Step 14.
