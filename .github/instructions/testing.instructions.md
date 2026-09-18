---
description: 'Testing standards for the MMO Catch Recording Reference Data Service: Vitest unit tests, Hapi server.inject route tests asserting JSON and error shapes, architecture boundary tests, FLOCI local S3 integration tests, E2E test suites, coverage targets and SonarCloud. Use when writing or reviewing tests or setting quality gates.'
applyTo: '**/*.test.js'
---

# Testing standards

Follow DEFRA [quality assurance and test standards](https://defra.github.io/software-development-standards/standards/quality_assurance_standards/).
New or changed behaviour ships with tests. Track coverage in
[DEFRA SonarCloud](https://sonarcloud.io/organizations/defra) and keep the quality gate green.

Adopt the **testing pyramid**: catch most defects cheaply at the unit and API level.

## Test tiers in this repository

1. **Unit tests (`npm test`):**
   - Services, query engines, normalisers, dataset validators, config formats and domain rules. Fast,
     isolated, deterministic.
   - Route / API tests using Hapi `server.inject` against `createServer()`: assert status code, JSON body,
     and error envelopes.
   - Validation tests: Joi schemas return 400 and `abortEarly: false` surfaces all errors.
   - Architecture boundary guardrail: `src/architecture-boundaries.test.js` verifies S3 SDK and auth client
     import boundaries.
2. **FLOCI local S3 integration tests (`npm run test:floci`):**
   - Runs against FLOCI S3 emulator (`npm run floci:up`).
   - Verifies `reference-data-repository`, `bootstrap-local-reference-data`, `cache-refresh-service` and
     `replace-collection`.
3. **End-to-end tests (`npm run test:e2e`):**
   - Full service lifecycle test verifying end-to-end data hydration, querying and manifest generation.

## Framework & conventions

- **Vitest** is the test runner (`globals: true`, `environment: node`) with `@vitest/coverage-v8`. Colocate
  tests next to source as `*.test.js`.
- Structure tests **Arrange → Act → Assert**. One behaviour per test; name by scenario and expected
  behaviour (`Should return 404 when port code does not exist`).
- Use fixed timezone (`TZ=UTC`) and fake timers instead of real waits — never `sleep`.
- Use `vitest-fetch-mock` or explicit mocks for outbound calls; keep sample payloads/fixtures in
  `src/common/schemas/fixtures/`.
- Start/stop the Hapi server in `beforeAll`/`afterAll` (`server.initialize()` / `server.stop({ timeout: 0 })`).

## Coverage targets

Coverage must be **visible and reported** in [DEFRA SonarCloud](https://sonarcloud.io/organizations/defra)
and must not regress below the established baseline. The project quality gate is:

- **≥90%** overall (global) line/branch coverage.
- **≥95%** for core business logic — query engines, validation, normalisation, controllers, helpers.
- **100%** for error-handling and security-critical paths — schema validation, authentication client, error
  mapping.

**Coverage is a floor, not a goal.** Reject low-value tests that restate the framework or driver,
near-duplicate test cases, and brittle tests coupled to implementation detail. Assert on **observable
behaviour and output**.

## Running

- Local/CI unit tests: `npm test` (runs `TZ=UTC vitest run --coverage`). Watch mode: `npm run test:watch`.
- FLOCI integration tests: `npm run test:floci`.
- End-to-end tests: `npm run test:e2e`.
- Pre-commit gate: `npm run git:pre-commit-hook`.
