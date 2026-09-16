# Plan: Step 02 — Establish Service Structure and Configuration

## Repository inspection summary

- ESM Node/Hapi CDP template. `src/common` (helpers, incl. `convict/` custom-format folder), `src/plugins` (hapi plugins), `src/routes` (currently only `health.js`), `src/services` (empty after Step 01 cleanup).
- `src/config.js` uses convict; existing sections: `host`, `port`, `serviceName`, `cdpEnvironment`, `log`, `httpProxy`, `tracing`. All fields have safe local defaults; no field is hard-required with zero default — this is the established repo convention.
- `compose.yml`: `floci` service provides the local S3-compatible endpoint (`http://localhost:4566` on host, `http://floci:4566` inside compose network). `compose/aws.env` sets test AWS credentials + `AWS_ENDPOINT_URL=http://localhost:4566` (host-relative — needs a container-network override for the app service).
- No `.env` / `.env.example` file exists in the repo.
- Step 01 already removed Mongo/Redis/example scaffolding; `src/services` and `src/routes` (besides health) are empty.

## Decisions

1. New component folders live under `src/reference-data/` (one subfolder per C4 component), leaving generic `common/plugins/routes/services` untouched.
2. Each component entry point exports only a name marker (e.g. `{ name: 'persistence' }`) — no stub methods, no business logic.
3. `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` are **not** added to convict config — left for the AWS SDK's own credential provider chain in the future Persistence Module, avoiding any risk of logging secrets.
4. `referenceData.bucket` gets a safe local default (`mmo-cr-reference-data-service`) to preserve the repo's existing "zero required `.env`" local-dev convention; deployed environments are expected to override it via CDP-injected env vars. Non-empty validation still applies if explicitly set to an empty string.
5. `aws.endpointUrl` and `authentication.serviceUrl` are nullable and only URL-validated when set — not required in deployed AWS environments.

## Steps

**Phase A — Component boundaries**
1. Create `src/reference-data/{controller,validation,query,command,normalisation,in-memory-store,cache-refresh,persistence}/index.js`, each a minimal named-marker module.
2. Create `src/reference-data/reference-data-components.test.js` asserting each module loads and exposes its expected `name`.

**Phase B — Configuration** *(independent of Phase A)*
3. Create `src/common/helpers/convict/validate-optional-url.js` (+ test) — custom format, validates URL only when value is non-null.
4. Create `src/common/helpers/convict/validate-non-empty-string.js` (+ test) — custom format, rejects empty/whitespace-only strings.
5. Create `src/common/helpers/convict/validate-positive-integer.js` (+ test) — custom format, requires integer > 0.
6. Edit `src/config.js` — register the three custom formats; add `aws` (`region`, `endpointUrl`, `forcePathStyle`), `referenceData` (`bucket`, `refreshIntervalMs`, `maxUploadBytes`), `authentication` (`serviceUrl`) sections.
7. Create `src/config.test.js` — valid local config, valid deployed-style config (no custom endpoint), invalid port, invalid endpoint URL, invalid boolean, invalid refresh interval, invalid upload limit, empty bucket name rejected, no secret values in validation errors.

**Phase C — Compose host/container endpoint** *(independent)*
8. Edit `compose.yml` — add `AWS_ENDPOINT_URL: http://floci:4566` and `S3_FORCE_PATH_STYLE: true` to the app service's `environment:` block (overrides the host-relative value from `compose/aws.env` only inside the container).

**Phase D — Documentation** *(depends on Phase B)*
9. Edit `README.md` — add a "Configuration" section documenting each variable (purpose, required/optional, local example, deployed-AWS behaviour, sensitivity).

**Phase E — Verification**
10. Run `npm run lint`, `npm run format:check`, `npm test`.
11. Start the app with valid local configuration and confirm `/health` still responds.

## Relevant files
- New: `src/reference-data/**` (8 component folders + test), `src/common/helpers/convict/validate-optional-url.js` (+test), `validate-non-empty-string.js` (+test), `validate-positive-integer.js` (+test), `src/config.test.js`, this plan file.
- Modified: `src/config.js`, `compose.yml`, `README.md`.
- Unchanged: `src/server.js`, `src/plugins/router.js`, `src/routes/health.js`, Dockerfile, npm scripts.

## Out of scope
S3 clients/repositories, bucket creation, schemas, normalisation, in-memory store behaviour, cache-refresh behaviour, Authentication Service calls, query/search logic, reference-data API routes, OpenAPI, Mongo/Redis (already handled in Step 01).
