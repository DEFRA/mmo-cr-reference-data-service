# Step 13 — Completion Summary: Common API Behaviour and Error Handling

## Plan

[Step 13-implement-common-api-behaviour-and-error-handling-plan.md](./Step%2013-implement-common-api-behaviour-and-error-handling-plan.md)

## Owner-confirmed decisions

Correlation reuses the existing `x-cdp-request-id` tracing header end-to-end (no new header).
Stale `If-Match` and `collection_version_exists` both map to `409` (no `412` anywhere).

## Files created

- `src/common/domain/http-status.js` (+ test) — `SERVICE_ERROR_CODES` → HTTP status map.
- `src/common/helpers/api/error-envelope.js` (+ test) — standard `{ error: {...} }` shape, optional properties omitted when undefined.
- `src/common/helpers/api/map-error-to-response.js` (+ 20 tests) — classification precedence: known service-error code → Boom-with-Joi-details → Boom 404/413/415 → generic Boom → safe 500 fallback. Verified specific-code-before-generic-404 precedence (mirroring the existing `NoSuchBucket` rule).
- `src/common/helpers/api/conditional-request.js` (+ test) — `matchesIfNoneMatch`/`matchesIfMatch`/`parseIfMatchCandidates`, opaque ETag comparison, wildcard support.
- `src/common/helpers/api/cache-control.js` — explicit named policies (`REFERENCE_DATA_READ`, `NO_STORE`), not applied automatically anywhere yet.
- `src/common/helpers/api/pagination.js` (+ test) — strict `limit`/`offset` parsing with configurable bounds.
- `src/plugins/correlation.js` (+ test) — resolves/generates the correlation id, sets it on every response.
- `src/plugins/error-response.js` — `onPreResponse` extension converting every Boom/thrown error into the standard envelope + correct status.
- `src/server.test.js` — full `server.inject` integration coverage (10 tests): success headers, valid/invalid/missing correlation id, known domain error mapping, unexpected-error safe 500, unmatched route, route validation failure with allowlisted details, health/readiness untouched.

## Files modified

- `src/server.js` — registers `errorResponse` before `correlation` (so the correlation header still applies to the final, error-mapped response without using `.takeover()`).

## Tests

~70 new tests. Full suite: 769 passed / 6 skipped (Floci-gated), 0 regressions.

## Verification

```
npm run lint   # pass
npm test        # 769 passed, 6 skipped, ~97% coverage
```

## Security / privacy

No stack traces, raw Joi/Boom payloads, or raw AWS errors ever reach a response (verified by
dedicated tests). Route-validation details are allowlisted to `{path, message}` only. Unexpected
errors always return a generic message; the original error is logged server-side only.

## Deferred

Manifest/query/upload endpoints (Steps 14+), response-schema validation for not-yet-existing
routes, full OpenAPI documentation, CORS/rate-limiting changes, metrics export (Step 25). The
`conditional-request.js`/`cache-control.js`/`pagination.js` utilities are prepared but not yet
wired into any route, since no read/write routes exist until Step 14 onward.

## Deviations from plan

None. Implemented exactly per the two owner decisions and the approved plan.
