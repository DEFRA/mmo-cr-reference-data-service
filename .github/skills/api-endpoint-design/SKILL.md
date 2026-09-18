---
name: api-endpoint-design
description: 'Build or extend a reference data API endpoint end-to-end in the MMO Catch Recording Reference Data Service: route wiring, Joi query/param validation, thin controller, query engine filtering, mobile and map projection formats, manifest integration, Boom error mapping, tests, and docs/api-reference.md updates. Use when adding a query endpoint, modifying projection shapes, or implementing dataset read/upload APIs.'
argument-hint: "e.g. 'add GET /ports/search endpoint' or 'add mobile projection for gear query'"
user-invocable: false
---

# API endpoint design (Reference Data Service)

Build an endpoint the way this service already does it, so the contract stays consistent and safe. Follow
the [nodejs-hapi-api](../../instructions/nodejs-hapi-api.instructions.md),
[security](../../instructions/security.instructions.md) and
[data-persistence](../../instructions/data-persistence.instructions.md) instructions.

## When to use

- Adding a new reference data query endpoint or projection view.
- Changing query parameters, filtering logic or sorting on an existing route.
- Adding or updating full-collection upload or validation-mode endpoints.
- Implementing contract changes defined in [docs/api-reference.md](../../../docs/api-reference.md).

## Design the contract first

1. **Resource and path** — `/vessels`, `/gears`, `/ports`, `/species`, `/map-locations`, `/manifest`.
2. **Projection view** — decide which projection is requested (`default`, `mobile`, `map`).
3. **Request validation** — Joi schema on `params` and `query` (`limit`, prefix `q`, category, etc.) with
   `abortEarly: false`.
4. **Query Engine delegation** — query is executed against the in-memory data store in `<10ms` without I/O.
5. **Errors** — map to `@hapi/boom` (`notFound`, `badRequest`, `unauthorized`). The `errorResponse` plugin
   maps to the standard envelope.
6. **Documentation** — update `docs/api-reference.md` and README in the same change.

## Architecture boundary check

- Ensure no S3 SDK calls are introduced in the controller or query engine.
- Ensure the concrete auth client remains inside `src/reference-data/validation/authentication/`.
- Verify with `npm test` (`src/architecture-boundaries.test.js`).
