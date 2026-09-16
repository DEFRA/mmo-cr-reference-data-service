# Phase 04 Execution Plan: Cache Lifecycle, Authentication, and Common API Behaviour

## 1. Current repository status (discovered)

- Steps 01–10 complete (see `design/plans/reference-data-service-implementation-phases.md`).
- Cache Refresh Module: still the Step 02 placeholder (`{ name: 'cache-refresh' }`) — no hydration,
  no readiness endpoint exists at all (only a bare `GET /health` returning `{ message: 'success' }`,
  no readiness route, no dependency-status model).
- In-Memory Data Store (Step 05) is complete and provides `setCollection`/`getCollection`/
  `getCollectionMetadata`/`hasCollection`/`listLoadedDatasets`/`setManifest`/`getManifest`/`clear`,
  all defensively cloned via `structuredClone`. This is exactly the contract Step 11 needs.
- Persistence Module (Step 07) is complete: `fetchCollection`, `putCollection`, `fetchManifest`
  (and presumably `putManifest`, not needed by Step 11), with S3 error mapping already
  prioritising specific names (`NoSuchBucket`, `PreconditionFailed`, etc.) ahead of generic status.
- Validation (Step 08/09) and Normalisation (Step 10) modules are complete and expose
  `validateCollection`/`normaliseCollection` as pure functions — exactly what Step 11's per-dataset
  pipeline needs to call.
- Authentication: `src/common/contracts/authentication-client.js` (Step 03) already defines the
  final internal contract (`authenticate`/`authorize`) and the final permission names
  (`reference-data.read`, `reference-data.write`). No concrete client exists yet. No real
  Authentication Service HTTP contract exists anywhere in the repo or design docs (confirmed by
  full-text search) — this is the expected gap flagged by the master plan's own assumption 11.
- `config.js` already has `referenceData.refreshIntervalMs` (60000ms default) and
  `authentication.serviceUrl` (nullable). No hydration-timeout, refresh-concurrency,
  mandatory-dataset, or Authentication Service timeout/retry config exists yet.
- Hapi server (`server.js`) registers `requestLogger`, `requestTracing` (`@defra/hapi-tracing`,
  header = `config.get('tracing.header')` = `x-cdp-request-id`), `metrics`, `secureContext`,
  `pulse` (graceful shutdown, 10s timeout), `router`. No error-mapping plugin, no correlation
  utility beyond hapi-tracing, no ETag/conditional-request utilities, no standard error envelope.

## 2. Owner-confirmed decisions

Recorded in `/memories/repo/conventions.md`:

1. Step 12: no real Authentication Service contract exists. Implement the adapter + a real HTTP
   client against a minimal, clearly-labelled **PROVISIONAL** assumed REST contract
   (`POST {authentication.serviceUrl}/validate`, `Authorization: Bearer <token>` →
   `{ actorId, permissions[] }`), plus a test double for local/dev. Documented everywhere as
   provisional pending real confirmation.
2. Step 13 correlation ID: reuse the existing `x-cdp-request-id` tracing header end-to-end
   (request, response, error `traceId`) — do not add a second `X-Correlation-Id` header.
3. Step 13 status mapping: both stale `If-Match` and `collection_version_exists` → `409 Conflict`
   (no `412` usage anywhere in this repo).
4. Step 11 config knobs (all configurable, not hardcoded): mandatory datasets = all 6 non-derived
   datasets; hydration timeout default 10000ms; refresh concurrency default 3; periodic refresh
   reuses existing `referenceData.refreshIntervalMs`.

## 3. Step readiness and dependency status

- **Step 11** — ready. Depends on Steps 05, 07, 08, 09, 10 (all complete). No blocking ambiguity
  remains after decision 4.
- **Step 12** — ready to implement the adapter/contract/test-double/provisional-HTTP-client
  approach approved in decision 1. Real-service verification remains explicitly pending.
- **Step 13** — ready after decisions 2 and 3. Depends on Step 12 for the error codes it maps
  (`unauthorized`, `forbidden`, `authentication_service_unavailable`) and Step 08 for validation
  error shapes (both satisfied).

## 4. Required execution order

Step 11 → Step 12 → Step 13 → Phase 4 integration verification → Defra SonarCloud review.

## 5. Expected files affected per step

- **Step 11**: `src/config.js` (new knobs); `src/reference-data/cache-refresh/*` (new: hydration,
  refresh, manifest-comparison, scheduler, result types); `src/routes/health.js` or a new
  `readiness.js` route + `src/plugins/router.js`; new architecture-boundary assertions; tests.
- **Step 12**: `src/config.js` (auth timeout/retry knobs); `src/reference-data/validation/*` (new:
  authentication client, authorisation operations); `src/common/contracts/authentication-client.js`
  (test-double factory, no contract change); architecture-boundary test; tests.
- **Step 13**: `src/plugins/*` (new: error-mapper, correlation/response extensions);
  `src/common/domain/errors.js` (HTTP-status mapping additions only, additive); `server.js`
  (register new plugin(s)); tests.

## 6. Tests and verification gates (per step)

Focused unit tests → integration tests (Docker-free) → full `npm test` → `npm run lint` →
`npx prettier --check` (files touched) → architecture-boundary checks → Floci tests only where
Step 11 explicitly requires them (`npm run test:floci`, existing command, unchanged).

## 7. Architecture-boundary checks

- Cache Refresh Module: no `@aws-sdk/client-s3` import (reuses `architecture-boundaries.test.js`
  allow-list, unchanged — only `persistence/**` may import it).
- Cache Refresh Module: no Authentication Service import.
- New: only the Validation Module (and its `datasets/authentication-client.js`) may import the
  concrete Authentication Service client; no other module.
- Controllers (Step 13 error mapper) must not import the AWS SDK or the Authentication Service
  client directly — only the Step 03/08 service-error contracts.

## 8. Known ambiguities (resolved above)

All four blocking ambiguities identified during Phase 4 planning are resolved per Section 2.
No further ambiguity is currently blocking; any new one discovered mid-implementation will stop
work and be raised before proceeding, per the phase prompt's mandatory ambiguity rule.

## 9. Defra SonarCloud review strategy

After Steps 11–13 and integration verification are complete, run `npm run lint` (neostandard/ESLint,
already Sonar-adjacent) and manually review every new/modified file against the Sonar risk list in
the phase prompt (magic numbers, cognitive complexity, duplicate literals, broad catch blocks,
unbounded retries/timers, sensitive-data logging, weak equality, prototype pollution). No SonarCloud
CI run is available in this environment — final CI verification will be reported as pending.
