# Step 12 — Completion Summary: Authentication Service Integration

## Plan

[Step 12-implement-authentication-service-integration-plan.md](./Step%2012-implement-authentication-service-integration-plan.md)

## Owner-confirmed decision

No real Authentication Service contract exists anywhere in the repo/design docs. Approved:
implement the adapter + a real HTTP client against a minimal, clearly-labelled **PROVISIONAL**
assumed contract (`POST {baseUrl}/validate`, Bearer token → `{actorId, permissions[]}`), plus a
synthetic test double. Recorded in `/memories/repo/conventions.md`.

## Files created

- `src/reference-data/validation/authentication/http-authentication-client.js` (+ 17 tests) —
  `createHttpAuthenticationClient`: no network call at construction; missing token/unconfigured
  baseUrl fail closed without a request; 401→`unauthorized`, 403→`forbidden` (never retried);
  502/503/504 and network/timeout failures retried up to `authentication.retryCount`; any other
  non-2xx fails immediately; malformed/incomplete success bodies fail closed;
  `Authorization: Bearer <token>` + existing `x-cdp-request-id` header forwarded; `AbortController`
  timeout via `authentication.timeoutMs`.
- `src/reference-data/validation/authentication/test-authentication-client.js` (+ 7 tests) —
  `createTestAuthenticationClient({ tokens })`: controllable synthetic actors, invalid-token and
  unavailable-service simulation; never wired into production composition.
- `src/reference-data/validation/authentication/permission-check.js` (+ 16 tests) —
  `hasExactPermission`, `requireAuthenticatedActor`, `requirePermission`,
  `requireReadPermission`/`requireWritePermission` (throw `unauthorized`/`forbidden` via the Step 03
  error model), `authorize` (pure local check, no second network call).

## Files modified

- `src/reference-data/validation/index.js` — composes the production `authenticationClient`
  (`config.get('authentication.*')`) and re-exports the factories/permission helpers, alongside the
  unchanged `validation = { name: 'validation' }` boundary marker.
- `src/architecture-boundaries.test.js` — new assertion: only `reference-data/validation/**` may
  import the concrete HTTP authentication client.

## Tests

40 new tests. Full suite: 698 passed / 6 skipped (Floci-gated), 0 regressions.

## Verification

```
npm run lint   # pass
npm test        # 698 passed, 6 skipped, ~97% coverage
```

## Security / privacy

Raw tokens are used only to build one outgoing `Authorization` header and never appear in the
returned outcome, logs, or thrown errors (verified by a dedicated test asserting the token string
is absent from `JSON.stringify(outcome)`). Fails closed on missing config, malformed responses, and
non-2xx statuses. Exact permission matching only — no substring/implicit grants. The test double
requires explicit synthetic token configuration and is never the production default.

## Deferred

Login/logout/token issuance, HTTP status-code mapping for routes (Step 13), all query/upload/
persistence/cache functionality, metrics/audit (Step 25). Real Authentication Service contract
confirmation remains explicitly pending — everything here is labelled provisional.

## Deviations from plan

None. The owner's approved fallback (adapter + provisional HTTP client + test double) was
implemented exactly as agreed.
