---
name: unit-tests
description: 'Write and strengthen tests for the MMO Catch Recording Reference Data Service: unit tests for controllers, query engines, normalisers, dataset validators and config formats; Hapi server.inject route tests asserting JSON envelopes and projections; architecture boundary tests; FLOCI local S3 integration tests (npm run test:floci); and E2E lifecycle tests (npm run test:e2e). Use when adding tests, closing coverage gaps, or setting up a test for a new endpoint.'
argument-hint: "e.g. 'write tests for port query endpoint' or 'add FLOCI integration test for collection replacement'"
user-invocable: false
---

# Unit, Integration & Boundary tests (Vitest)

Write fast, deterministic tests that ship **with** the code, following the
[testing instructions](../../instructions/testing.instructions.md).

## Test layers in this repository

- **Unit tests:**
  - Routes / Controllers (`src/routes/`, `src/reference-data/controller/`): `server.inject` asserting
    status code, standard response, mobile projection, map projection and error envelopes.
  - Query engine (`src/reference-data/query/`): filtering, prefix searching, sorting, pagination bounds.
  - Validation (`src/reference-data/validation/`): structural, business and referential dataset validation.
  - Normalisation (`src/reference-data/normalisation/`): raw → canonical transformation.
  - Boundaries: `src/architecture-boundaries.test.js` asserts S3 SDK and auth client isolation.
- **FLOCI Integration tests (`npm run test:floci`):**
  - Persistence against FLOCI local S3 emulator.
  - Manifest generation, ETag tracking, background cache refresh and atomic replacement.
- **End-to-End tests (`npm run test:e2e`):**
  - Full application lifecycle test verifying startup hydration, query execution and endpoint responses.

## Procedure

1. **Read** existing colocated `*.test.js` files nearby for established patterns.
2. **Arrange** — mock outbound HTTP (`vitest-fetch-mock`); use test fixtures from `src/common/schemas/fixtures/`.
3. **Act** — call the function or `server.inject({ method, url, query, payload })`.
4. **Assert** — assert observable outputs, projection structures and error envelopes.
5. **Run & verify** — `npm test` (unit/boundary), `npm run test:floci` (integration), `npm run test:e2e`.

## Coverage targets

- **≥90%** global · **≥95%** core logic · **100%** error-handling and security paths.
- Track in [DEFRA SonarCloud](https://sonarcloud.io/organizations/defra).
