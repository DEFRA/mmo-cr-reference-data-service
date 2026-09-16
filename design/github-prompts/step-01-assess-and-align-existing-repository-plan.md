# Plan: Step 01 — Assess and Align Existing Repository

## Repo assessment (findings)

- DEFRA CDP Node.js Backend Template. Node >=24 (nvm pinned 24.14.1), npm with package-lock.json, ESM (`"type": "module"`), path alias `#/*` -> `./src/*`.
- Hapi 21.4.10 bootstrap in src/server.js + src/index.js via src/common/helpers/start-server.js. Plugins registered: requestLogger (hapi-pino), requestTracing (@defra/hapi-tracing), metrics (@defra/cdp-metrics), secureContext (@defra/hapi-secure-context), pulse (hapi-pulse), mongoDb (template only), router.
- Config: convict-based src/config.js (host/port/serviceName/cdpEnvironment/log/mongo/httpProxy/tracing). `mongo` block + custom `mongo-uri` convict format exist only for the template's Mongo plugin.
- Quality tooling: ESLint 9 + neostandard, Prettier (semi:false, singleQuote, no trailing comma), Husky pre-commit (`security-audit && format:check && lint && test`), Vitest 4 + v8 coverage (`vitest.config.js`, setupFiles: `.vite/mongo-memory-server.js` (vitest-mongodb) + `.vite/setup-files.js` (fetch mock)). Sonar config present, Sonar scan step commented out in CI.
- CI: `.github/workflows/check-pull-request.yml`, `publish.yml`, `publish-hotfix.yml` — all run `npm ci`, format:check, lint, test; Docker build check on PR.
- Docker: multi-stage Dockerfile (development/production), CMD `node src`. compose.yml has services: `floci` (S3/AWS emulator, retained — used by later steps), `redis` (unused by any app code), `mongodb` (backs the template's mongo plugin only), and the app service (links/depends_on include mongodb; env has `MONGO_URI`).
- Existing domain code is 100% template scaffolding, not reference-data domain code: `src/routes/example.js`, `src/services/ExampleFind.js` (Mongo-backed CRUD example), `src/plugins/mongodb.js` (+ test), `src/common/helpers/mongo-lock.js` (+ test), `src/common/helpers/convict/validate-mongo-uri.js` (+ test).
- `src/routes/health.js` — static `GET /health` returning `{ message: 'success' }`, no dependency checks. Registered via `src/plugins/router.js`.
- Forward-looking, currently-unused deps already present for later steps (NOT Mongo-related — keep as-is, do not touch): `@aws-sdk/credential-providers`, `aws4`, `@defra/cdp-auditing`.
- Existing design docs already in repo:
  - `design/plans/reference-data-service-implementation-plan.md` — full 29-step master plan. Step 01 = assessment only. **Step 29** ("Remove unused template infrastructure and examples") is where the master plan originally assigned Mongo/Redis/example removal, depending on "Steps 01 and 28".
  - `design/github-prompts/step-02-establish-service-structure-and-configuration.md` (+ .meta.md) — already drafted; states Mongo/Redis "must not be removed in this step unless removal is essential... explicitly approved in the plan."
  - No `design/github-prompts/step-01...` file yet — this step's approved plan is saved here.

## Decisions (confirmed with the repository owner)

1. **Mongo/Redis/example removal timing** — Conflict found: master plan assigns this cleanup to Step 29, not Step 01. **The owner explicitly overrode this and approved removing Mongo/Redis/example scaffolding now, in Step 01.** This is a deliberate, approved deviation from the committed master plan; the master plan and Step 02 prompt are updated in this step to avoid future contradiction.
2. **Component folder scaffolding** — Not created in Step 01; remains Step 02's job per the master plan.
3. **Health endpoint** — `/health` stays a static liveness check; no readiness endpoint added in Step 01.

## Steps

**Phase A — Remove Mongo/Redis/example template scaffolding**

1. Delete: `src/plugins/mongodb.js`, `src/plugins/mongodb.test.js`, `src/common/helpers/mongo-lock.js`, `src/common/helpers/mongo-lock.test.js`, `src/common/helpers/convict/validate-mongo-uri.js`, `src/common/helpers/convict/validate-mongo-uri.test.js`, `src/routes/example.js`, `src/services/ExampleFind.js`, `.vite/mongo-memory-server.js`, and the `compose/mongo/` directory.
2. Edit `src/config.js` — remove the `mongo` config block and the `convictValidateMongoUri` import/`convict.addFormat` call.
3. Edit `src/server.js` — remove the `mongoDb` import, its registration entry, and its doc comment line.
4. Edit `src/plugins/router.js` — remove the `example` import and `.concat(example)`.
5. Edit `compose.yml` — remove the `redis` and `mongodb` services, the `mongodb-data` volume, and the app service's mongo link/depends_on/env entries.
6. Edit `vitest.config.js` — remove `.vite/mongo-memory-server.js` from `setupFiles`.
7. Edit `package.json` — remove deps `mongodb`, `mongo-locks`; remove devDep `vitest-mongodb`.
8. Run `npm install` to regenerate `package-lock.json`.

**Phase B — Documentation alignment** 9. Edit `README.md` — remove the "MongoDB Locks" section/TOC entry, remove `/example` API rows, remove Mongo/Redis mentions in the Docker Compose section. 10. Edit `design/plans/reference-data-service-implementation-plan.md` — note in Step 29 that Mongo/Redis/example removal was already completed in Step 01. 11. Edit `design/github-prompts/step-02-establish-service-structure-and-configuration.md` — update the note that Mongo/Redis "must not be removed" to reflect it was already removed in Step 01.

**Phase C — Verification** 12. Run: `npm ci`, `npm run format:check`, `npm run lint`, `npm test`, `npm run dev` then `curl localhost:3001/health`. 13. Optional: confirm `docker build` still succeeds.

**Phase D — Save plan & final summary** 14. Save this approved plan (this file) as the first implementation action. 15. Produce a completion report: files created/modified/deleted, commands run + results, deferred work, remaining risks.

## Relevant files

- src/config.js, src/server.js, src/plugins/router.js, src/plugins/mongodb.js(+test), src/common/helpers/mongo-lock.js(+test), src/common/helpers/convict/validate-mongo-uri.js(+test), src/routes/example.js, src/services/ExampleFind.js
- compose.yml, compose/mongo/10-init.js (delete dir), vitest.config.js, .vite/mongo-memory-server.js (delete), package.json, package-lock.json (regenerate)
- README.md
- design/plans/reference-data-service-implementation-plan.md, design/github-prompts/step-02-establish-service-structure-and-configuration.md

## Verification commands

npm ci | npm run format:check | npm run lint | npm test | npm run dev + curl http://localhost:3001/health

## Deferred to later steps

Full schemas, S3 persistence, cache refresh, auth integration, upload/activation, component folder scaffolding (Step 02), OpenAPI, AWS infra.
