# Step 13 Implementation Plan: Common API Behaviour and Error Handling

## 1. Repository state discovered

- No error-mapping plugin, correlation utility (beyond `@defra/hapi-tracing`'s internal ALS store,
  which does not set a response header or generate a missing id), ETag/conditional-request
  utility, or pagination utility existed.
- `@defra/hapi-tracing` already wires the `x-cdp-request-id` header (`config.get('tracing.header')`)
  into an async-local-storage-backed `getTraceId()`, but never generates a value when absent and
  never sets a response header — this step builds on the same header name, not the same mechanism.
- Hapi route validation failures are already routed through `failAction` (Step 02), which currently
  just logs and rethrows the error Hapi itself already decorates with `.details` (Joi output) before
  invoking `failAction` — this step's error mapper consumes that existing `.details` shape rather
  than re-parsing Joi output.
- `src/reference-data/persistence/error-mapping.js` (Step 07) and the cache-refresh/auth
  (Steps 11/12) modules already throw plain `Error` objects with a stable `.code` drawn from
  `SERVICE_ERROR_CODES` — this step's mapper reads that `.code` directly (Hapi's automatic
  `Boom.boomify()` of a thrown non-Boom error preserves custom properties on the same object).

## 2. Owner-confirmed decisions

Correlation reuses the existing `x-cdp-request-id` header end-to-end (no new header introduced).
Both stale `If-Match` and `collection_version_exists` map to `409` (no `412` usage).

## 3. Proposed file structure

```
src/common/domain/http-status.js                (+ test)  SERVICE_ERROR_CODES -> HTTP status map
src/common/helpers/api/
  error-envelope.js                              (+ test)  standard { error: {...} } shape
  map-error-to-response.js                        (+ test)  classification/mapping precedence
  conditional-request.js                          (+ test)  If-None-Match / If-Match helpers
  cache-control.js                                          explicit named Cache-Control policies
  pagination.js                                   (+ test)  strict limit/offset parsing
src/plugins/
  correlation.js                                  (+ test)  resolves/generates + sets the header
  error-response.js                                          onPreResponse -> standard envelope
src/server.js                                     modified: registers the two new plugins
src/server.test.js                                new: full server.inject integration coverage
```

## 4. Error-classification precedence (implemented)

1. `error.code` matches a known `SERVICE_ERROR_CODES` value (works whether or not Hapi has already
   boomified the thrown error, since boomify preserves custom properties on the same object) —
   checked _before_ any generic Boom status inspection, preserving the existing
   `NoSuchBucket`-before-generic-404 precedence rule end-to-end.
2. Boom error with `.details` (Hapi route-validation failure) → `400 invalid_request` with
   allowlisted `{path, message}` pairs only.
3. Boom `404` with no details → `route_not_found`.
4. Boom `413`/`415` → `payload_too_large`/`unsupported_media_type`.
5. Any other Boom `< 500` → generic `invalid_request` at its own status code.
6. Everything else (including Boom `>= 500` and non-Boom unexpected errors) → safe generic
   `500 internal_server_error`.

## 5. Correlation

`onRequest` resolves `request.app.correlationId` from the `x-cdp-request-id` header (bounded
allowlist regex) or generates a `randomUUID()`. `onPreResponse` sets the header on the final
response. The error-response plugin is registered _before_ the correlation plugin so its mapped
response (built via `h.response(...)`, no `.takeover()`) still passes through the correlation
plugin's later `onPreResponse` extension in the same registration-order chain.

## 6. Explicitly deferred

Manifest/query/upload endpoints, dataset-specific behaviour, response-schema validation for
routes that don't exist yet, full OpenAPI documentation, rate limiting, CORS changes.

## 7. Verification commands

```
npm run lint
npm test
```
