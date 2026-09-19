# Deploying to CDP (Core Delivery Platform)

This is a practical view of how `mmo-cr-reference-data-service` fits into Defra's CDP and what's
needed to take it from a merged PR to a running service in a CDP environment. It's based on what
the repository already implements for CDP compliance (see below) plus standard CDP platform
conventions. **Treat the platform-side steps (portal screens, Terraform module names, DNS
conventions) as a best-effort summary** — confirm exact current steps against the
[CDP Portal](https://portal.cdp-int.defra.cloud) and the `#cdp-support` team, since the platform
evolves independently of this repo.

- [1. What this repo already provides for CDP](#1-what-this-repo-already-provides-for-cdp)
- [2. One-time service onboarding](#2-one-time-service-onboarding)
- [3. Requesting the S3 bucket this service needs](#3-requesting-the-s3-bucket-this-service-needs)
- [4. Environment variables per CDP environment](#4-environment-variables-per-cdp-environment)
- [5. CI/CD: how a merge becomes a deployable image](#5-cicd-how-a-merge-becomes-a-deployable-image)
- [6. Deploying a build to an environment](#6-deploying-a-build-to-an-environment)
- [7. Health checks, logs, metrics, and audit on the platform](#7-health-checks-logs-metrics-and-audit-on-the-platform)
- [8. Networking: calling and being called by other CDP services](#8-networking-calling-and-being-called-by-other-cdp-services)
- [9. Promotion path and rollback](#9-promotion-path-and-rollback)
- [10. Pre-deployment checklist](#10-pre-deployment-checklist)

## 1. What this repo already provides for CDP

These are already in place and don't need to be redone:

- **Multi-stage `Dockerfile`** built from `defradigital/node-development` /
  `defradigital/node:${PARENT_VERSION}` base images, with `uk.gov.defra.ffc.parent-image` labels
  and `curl` installed in the production stage — this is a **CDP platform healthcheck
  requirement** (the platform's ECS task healthcheck shells out to `curl`).
- **`SERVICE_VERSION`** config field ([src/config.js](../src/config.js)) — CDP injects this into
  the container at deploy time; the app just needs to read it (already wired, currently unused in
  responses but available for logging/metrics if needed).
- **`ENVIRONMENT`** config field (`cdpEnvironment`) — accepts every real CDP environment name
  (`infra-dev`, `management`, `dev`, `test`, `perf-test`, `ext-test`, `prod`) plus `local` for
  development.
- **`x-cdp-request-id` tracing header** support ([src/config.js](../src/config.js) `tracing.header`)
  — the platform's edge/ALB (or an upstream caller) sets this; the app echoes it as `traceId` in
  every error response and log line.
- **`@defra/cdp-auditing` / `@defra/cdp-metrics` / `@defra/hapi-secure-context` / `@defra/hapi-tracing`**
  already wired (see [README § Observability](../README.md#observability)) — no extra platform
  setup needed beyond the standard CDP AWS permissions the platform itself grants every ECS task.
- **`.github/workflows/publish.yml`** already uses `DEFRA/cdp-build-action/build@main` — the
  standard CDP GitHub Action that builds, tags, and publishes the image to the platform's ECR.
- **No secrets or AWS credentials in code or compose files** — production config expects the
  platform's IAM task role (`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` must **not** be set in any
  deployed environment; see [README § Configuration](../README.md#configuration)).

## 2. One-time service onboarding

If this service isn't already registered on the platform:

1. In the [CDP Portal](https://portal.cdp-int.defra.cloud), create a new service under the
   appropriate team, choosing **Node.js backend** as the template/kind (this repo already matches
   that template's shape — `Dockerfile`, `compose.yml`, `.github/workflows`).
2. The portal provisions the GitHub repository (already done here — `mmo-cr-reference-data-service`),
   an ECR repository, and opens the initial Terraform PR(s) against the platform's infrastructure
   repos to create the ECS service definition for each environment.
3. Confirm the AWS account ID / region in `.github/workflows/publish.yml`
   (`AWS_ACCOUNT_ID: '094954420758'`, `AWS_REGION: eu-west-2`) match what the portal assigned to
   this service — these are portal-generated, not hand-picked.

## 3. Requesting the S3 bucket this service needs

Unlike a typical stateless CDP service, this one owns an S3 bucket for reference-data collections
(`REFERENCE_DATA_BUCKET`, see [README § In-Memory Data Store](../README.md#in-memory-data-store)
and [Persistence Module](../README.md#persistence-module)). CDP services don't get ad hoc AWS
resources — additional infrastructure (S3, SQS, etc.) is requested through the portal's **"Create
new resource"** flow (or a PR to the shared Terraform service-infra module, depending on current
CDP process), which:

- Provisions one bucket per environment (dev/test/perf-test/ext-test/prod), each named
  distinctly — never share a bucket name across environments.
- Grants the service's ECS task role scoped `s3:GetObject`/`s3:PutObject`/`s3:ListBucket`
  permissions on that bucket only.
- Surfaces the resulting bucket name so it can be set as `REFERENCE_DATA_BUCKET` for that
  environment (see [§4](#4-environment-variables-per-cdp-environment)).

Do this **before** the first real deployment to an environment — without a valid, accessible
bucket, startup hydration will never complete, `/health/ready` will report `503` forever (mandatory
datasets never load), and the service will fail its readiness probe.

## 4. Environment variables per CDP environment

Set these per environment in the CDP Portal's environment-variable/secrets screens for this
service (never hard-coded, never committed). Everything not listed uses the documented default
(see [README § Configuration](../README.md#configuration) and [src/config.js](../src/config.js)).

| Variable                             | Value in deployed environments                                                                                                          |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `REFERENCE_DATA_BUCKET`              | The bucket name provisioned in [§3](#3-requesting-the-s3-bucket-this-service-needs) for that environment                                |
| `AWS_REGION`                         | Region the bucket was provisioned in (`eu-west-2` unless the portal says otherwise)                                                     |
| `AWS_ENDPOINT_URL`                   | **Leave unset** — must not be set outside local development                                                                             |
| `S3_FORCE_PATH_STYLE`                | **Leave unset/`false`** — only needed for Floci locally                                                                                 |
| `AUTHENTICATION_SERVICE_URL`         | The deployed Authentication Service's URL for that environment (see [§8](#8-networking-calling-and-being-called-by-other-cdp-services)) |
| `AUTHENTICATION_SERVICE_TIMEOUT_MS`  | Tune only if the real service's latency profile requires it (default `2000`)                                                            |
| `REFERENCE_DATA_REFRESH_INTERVAL_MS` | Default `60000` unless the team decides otherwise                                                                                       |
| `REFERENCE_DATA_MAX_UPLOAD_BYTES`    | Default `26214400` (25 MiB) unless a specific dataset is known to exceed it                                                             |
| `LOG_LEVEL`                          | `info` in `prod`; `debug` temporarily in `dev`/`test` if needed for troubleshooting                                                     |
| `METRICS_ENABLED` / `AUDIT_ENABLED`  | Leave at default (`true`) in every deployed environment                                                                                 |

`PORT`, `SERVICE_VERSION`, and `ENVIRONMENT` are set by the CDP platform itself at deploy time —
don't set them manually. `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` must never be set in a
deployed environment; the ECS task's IAM role supplies credentials to the AWS SDK automatically.

## 5. CI/CD: how a merge becomes a deployable image

`.github/workflows/publish.yml` runs on every push to `main`:

1. Checks out the code, installs dependencies (`npm ci`), and runs `npm test` — the build fails
   fast if tests fail (Floci-dependent and e2e suites self-skip in CI as they do locally).
2. `DEFRA/cdp-build-action/build@main` builds the production image from the `production` target
   in [Dockerfile](../Dockerfile) and pushes it to this service's ECR repository, tagged with the
   commit SHA (and typically a semver tag depending on the action's configured versioning
   strategy).
3. `publish-hotfix.yml` provides the equivalent path for a hotfix branch when a fix needs to skip
   the normal `main` flow.

No image is deployed automatically by this workflow — publishing to ECR and deploying to an
environment are deliberately separate steps on CDP (see [§6](#6-deploying-a-build-to-an-environment)).

## 6. Deploying a build to an environment

1. Open this service in the CDP Portal.
2. Go to the **Deployments** tab and choose the target environment (`dev` first, then `test`,
   `perf-test`/`ext-test` as required, then `prod`).
3. Pick the image tag/version published by the workflow in [§5](#5-cicd-how-a-merge-becomes-a-deployable-image)
   (usually the latest, but any previously published tag can be redeployed — this is also how you
   roll back).
4. Confirm the deployment. The platform updates the ECS service/task definition, performs a
   rolling deployment, and only routes traffic to new tasks once they pass the ECS healthcheck
   (`curl` against `/health`, per the Dockerfile comment) and, if configured, the ALB target-group
   health check.
5. Watch the rollout in the portal until it reports the new task set as stable.

## 7. Health checks, logs, metrics, and audit on the platform

- **Liveness**: `GET /health` — constant-time, no dependency calls (see
  [src/routes/health.js](../src/routes/health.js)). This is what the container healthcheck and/or
  ALB target-group health check should point at.
- **Readiness**: `GET /health/ready` — reports `503` until startup hydration has loaded every
  mandatory dataset; use this for any platform-level "is this task ready to receive traffic" gate
  if the ALB is configured to use it instead of/in addition to `/health`.
- **Dependency status**: `GET /health/dependencies` — diagnostic only, useful when triaging a
  live incident (S3/Floci-equivalent reachability, Authentication Service config state).
- **Logs**: structured ECS-format JSON (`@elastic/ecs-pino-format`) is emitted to stdout in every
  deployed environment and picked up by the platform's standard log shipping — no extra
  configuration required. Verify `LOG_FORMAT` was not accidentally overridden to `pino-pretty` in
  a deployed environment (`ecs` is already the production default).
- **Metrics**: `@defra/cdp-metrics` pushes AWS EMF metrics automatically once deployed (no
  `AWS_EMF_ENVIRONMENT=Local` override present outside local dev/compose) — visible in the
  platform's CloudWatch/Grafana dashboards under the `reference_data_*` metric names documented in
  [README § Metrics](../README.md#metrics).
- **Audit**: `@defra/cdp-auditing` routes `replace-collection`/`validate-collection` audit events
  to the platform's audit stream automatically; nothing extra to configure.

## 8. Networking: calling and being called by other CDP services

This service is a pure consumer of the Authentication Service (no other outbound service
dependency) and is called by the Catch Recording mobile/backend clients:

- **Outbound** — `AUTHENTICATION_SERVICE_URL` must resolve to the Authentication Service's
  in-VPC/service-mesh address for the same environment (not a public URL) so calls stay inside
  CDP's private networking. Confirm the correct per-environment hostname with the Authentication
  Service's team/portal entry rather than guessing a DNS pattern.
- **Inbound** — callers reach this service through whatever ingress the portal configured
  (typically a private ALB / internal DNS name per environment) — this repo doesn't need to do
  anything extra for that; it's part of the standard service onboarding in [§2](#2-one-time-service-onboarding).
- Cross-service calls between CDP services generally stay within the platform's shared VPC;
  public internet egress (e.g. calling a non-CDP third party) requires the `HTTP_PROXY` config
  already wired ([src/config.js](../src/config.js) `httpProxy`) and may need a proxy allow-list
  change requested from the platform team.

## 9. Promotion path and rollback

- Promote the same image tag through environments (`dev` → `test` → `perf-test`/`ext-test` →
  `prod`) rather than rebuilding per environment, so what's tested is exactly what ships.
- Rolling back is redeploying a previously published tag from the **Deployments** tab
  ([§6](#6-deploying-a-build-to-an-environment)) — no separate rollback tooling is needed.
- A failed replacement/upload never corrupts the active in-memory data
  (see [README § Atomic collection replacement](./api-reference.md#atomic-collection-replacement)),
  so a bad deploy's blast radius is scoped to whatever new bugs ship in the image itself, not to
  reference-data integrity.

## 10. Pre-deployment checklist

Before deploying to a new environment for the first time:

- [ ] S3 bucket provisioned for this environment and its name set as `REFERENCE_DATA_BUCKET`
- [ ] `AUTHENTICATION_SERVICE_URL` set to that environment's real Authentication Service address
- [ ] `AWS_ENDPOINT_URL` / `S3_FORCE_PATH_STYLE` are **unset** (no Floci-style overrides)
- [ ] No `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` set anywhere in that environment's config
- [ ] `LOG_LEVEL` appropriate for the environment (`info` for `prod`)
- [ ] Latest `main` build published via the `Publish` workflow and visible in the portal's image list
- [ ] Bootstrap/seed data for that environment uploaded via a real
      [atomic collection replacement](./api-reference.md#atomic-collection-replacement) call (the
      committed `resources/reference-data/seed` files are for local development only — never
      assume they exist in a deployed bucket)
