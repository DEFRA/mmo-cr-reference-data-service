---
description: 'Node.js, Hapi.js and API coding standards for the MMO Catch Recording Reference Data Service: ES modules, Hapi server/plugin composition, route and controller layering, Joi validation, Boom errors and error envelope plugin, convict config, structured logging and architecture boundaries. Use when writing or reviewing backend service code.'
applyTo: 'src/**/*.js'
---

# Node.js, Hapi & API standards

Precedence: DEFRA standards > GDS > community. Where DEFRA is silent, follow the
[DEFRA Node.js standards](https://defra.github.io/software-development-standards/standards/node_standards/)
and idiomatic Hapi/Node.js guidance.

## Language & style

- **ES Modules** (`type: module`, Node **≥ 24**). Use `import`/`export`; no CommonJS in `src/`.
- **Import alias:** use `#/` for `src/` (e.g. `import { config } from '#/config.js'`). Keep the `.js`
  extension on relative/aliased imports.
- **Style:** `neostandard` (Standard-style — no semicolons, single quotes, 2-space indent). Don't fight the
  formatter (ESLint + Prettier). Run `npm run lint` and `npm run format`.
- **Naming:** `lowerCamelCase` for variables/functions, `UpperCamelCase` for classes/constructors. Booleans
  read as assertions (`isValid`, `hasError`). Name by role; omit needless words.
- **Functions:** prefer small, pure functions; return values rather than mutating arguments. Use
  `async/await` and **propagate errors** — do not swallow them.
- **Immutability:** prefer `const`; avoid shared mutable module state.
- **Never block the event loop.** Push CPU-intensive work off the request path.

## Hapi server & plugins

- The server is created in `src/server.js` and registers, in order: `requestLogger`, `requestTracing`,
  `errorResponse`, `correlation`, `metrics`, `metricsHttp`, `secureContext`, `pulse` and `router`. Follow
  that composition.
- Server-wide route defaults (`validate.options.abortEarly: false`, the shared `failAction`, and the
  `security` headers block: HSTS, `xss`, `noSniff`, `xframe`) are set in `createServer()`. **Do not weaken
  them**.
- `stripTrailingSlash` is on — define paths without a trailing slash.

## Layering & architecture boundaries (mandatory)

Follow the established hexagonal layering:

- **Routes (`src/routes/`)** — wire path/method and Joi validation to controllers in `src/reference-data/controller/`.
- **Controllers (`src/reference-data/controller/`)** — validate, query the in-memory query engine (`src/reference-data/query/`) or persistence service, and format response/projections (standard, mobile, map).
- **In-memory data store (`src/reference-data/in-memory-store/`)** — holds canonical collections in memory for low-latency queries; updated atomically.
- **Persistence (`src/reference-data/persistence/`)** — reads/writes S3 objects via the AWS SDK.
- **Validation & normalisation (`src/reference-data/validation/`, `src/reference-data/normalisation/`)** — dataset schemas, business rules and canonical normalisation.
- **Architecture boundaries:**
  - `@aws-sdk/client-s3` may ONLY be imported in `src/reference-data/persistence/`
  - Concrete Authentication Service client may ONLY be imported in `src/reference-data/validation/authentication/`
  - Enforced by `src/architecture-boundaries.test.js`.

## API contract

- The published contract is what consumers depend on. See [docs/api-reference.md](../../docs/api-reference.md).
- Keep response shapes, projections (`default`, `mobile`, `map`), status codes and error shapes stable.
  Version any breaking change and record it explicitly.
- `/health` stays fast, unauthenticated and dependency-safe.

## Configuration

- Use **convict** (`src/config.js`) for all configuration, validated `strict`. Every key needs a `doc`,
  `format` and `env`.
- **No secrets in source.** Injected via environment from CDP Portal. Document new keys in the README.

## Dependencies

- **Pin exact versions** in `package.json` (enforced by `save-exact=true` in `.npmrc`). Use `npm ci` in
  automated builds. Run `npm run security-audit`.
- **No TypeScript** without an approved DEFRA exemption.
