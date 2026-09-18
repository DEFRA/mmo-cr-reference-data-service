# Troubleshooting Guide

Operational troubleshooting for local development and diagnosis. All commands below already exist
in [`package.json`](../package.json) or are documented in the root [`README.md`](../README.md) — no
new scripts are introduced here.

## Floci not reachable

**Symptom**: `npm run test:floci`/`npm run test:e2e` hang or self-skip; `npm run dev` logs
`reference_store_unavailable`/connection-refused errors.

```bash
npm run floci:up
docker compose ps floci
curl http://localhost:4566/_floci/health
```

If the container reports unhealthy, check `npm run floci:logs`. If in doubt, run
`npm run floci:reset` for a guaranteed-clean start.

## Bucket missing

**Symptom**: `npm run floci:buckets` does not list `mmo-cr-reference-data-service`.

The bucket is created automatically by [`compose/floci/start.d/10-setup-resources.sh`](../compose/floci/start.d/10-setup-resources.sh)
on Floci startup. Run `npm run floci:up` (not just `docker compose up floci` without waiting) so
the startup hook has run, then re-check with `npm run floci:buckets`.

## Active manifest missing

**Symptom**: `npm run floci:manifest` returns `404`; `GET /api/v1/reference-data/manifest` returns
`503 reference_data_unavailable`.

The bucket exists but is empty until the local bootstrap has been run:

```bash
npm run floci:up
npm run reference-data:bootstrap
npm run floci:manifest
```

## Startup hydration failure

**Symptom**: `cache-refresh: startup hydration started` is logged but never followed by a
successful readiness state; `GET /health/ready` stays `503`.

Usually caused by a missing manifest (see above) or Floci being unreachable at startup. Check the
structured log for `event: "reference_data.hydration_failed"` and its `errorCode` field, then
address the underlying dependency (Floci reachability, or run the bootstrap command).

## Readiness failure

**Symptom**: `GET /health/ready` returns `503` with `status: "not-ready"`.

Inspect the response body's `datasets.mandatory.missing` array — it lists exactly which mandatory
datasets (`vessels`, `gears`, `ports`, `species`, `map-land`, `map-statistical-areas`) have never
successfully hydrated. A dataset that failed to validate on its most recent refresh does **not**
flip readiness back to `false` once previously loaded — only a dataset that has _never_ loaded
successfully blocks readiness.

## Invalid collection (upload or seed)

**Symptom**: `PUT .../{dataset}` returns `422 schema_validation_failed` or
`422 business_validation_failed`; local bootstrap logs
`reference-data bootstrap: seed collection failed validation`.

Read the response/log's `details`/`errorCount` — every issue includes a `path`/`itemIndex`
identifying exactly where in the collection the problem is. Validation never partially activates a
collection; fix the source file and retry.

## Cache refresh failure

**Symptom**: structured logs show `event: "reference_data.refresh_failed"` or
`"...refresh_completed_with_errors"`, but the service keeps running.

A single dataset's refresh failure never corrupts other loaded datasets, and the previously valid
collection for the failed dataset remains active. Check the log's `failedDatasetCount`/per-dataset
failure entries, then confirm the persisted object for that dataset is valid (re-run a validation-
only upload against it if needed).

## Stale ETag / replacement conflict

**Symptom**: `PUT .../{dataset}` (full replacement) returns `409 collection_modified`.

The `If-Match` you supplied does not match the _active manifest entry's_ current
`{collectionId, version}` ETag. This is **not** the same ETag as a `GET` collection response — see
[docs/api-reference.md § Conditional requests and caching](./api-reference.md#conditional-requests-and-caching).
Re-fetch `GET /api/v1/reference-data/manifest`, recompute `If-Match` from the current entry, and
retry.

**Symptom**: `409 collection_version_exists`.

The `version` you supplied already exists with _different_ content (collection versions are
immutable). Choose a new, unused `version` value.

## Missing reference data (empty read responses)

Confirm the dataset was actually bootstrapped/uploaded (`npm run floci:manifest`), and that
`GET /health/ready` reports it as loaded, not just that Floci is reachable.

## Incorrect local endpoint (host vs container)

The AWS S3-compatible endpoint differs depending on where the process runs:

| Running as                           | `AWS_ENDPOINT_URL`                                                               |
| ------------------------------------ | -------------------------------------------------------------------------------- |
| Inside Docker Compose                | `http://floci:4566` (already set in [`compose.yml`](../compose.yml))             |
| Directly on the host (`npm run dev`) | `http://localhost:4566` (already set in [`compose/aws.env`](../compose/aws.env)) |

A `dev` process started on the host using the container endpoint (`floci:4566`) will fail DNS
resolution — use `localhost:4566` instead.

## Authentication Service unavailable

**Symptom**: every authenticated route returns `503 authentication_service_unavailable`.

The client applies a bounded timeout (`AUTHENTICATION_SERVICE_TIMEOUT_MS`, default 2000ms) and a
small number of bounded retries (`AUTHENTICATION_SERVICE_RETRY_COUNT`, default 1) only for
retryable statuses (`502`/`503`/`504`). Confirm `AUTHENTICATION_SERVICE_URL` is set and reachable.
Locally, no real Authentication Service exists — see the provisional contract documented in
[README § Security](../README.md#security) and use a local stub (as the `test:e2e` suite does) when
exercising authenticated routes without a real Authentication Service.

## Port conflict

**Symptom**: `npm run dev` fails to bind port `3001`.

```bash
lsof -nP -iTCP:3001 -sTCP:LISTEN
```

Stop the conflicting process, or set `PORT` to an alternative value for this run.

## Hanging test process

`npm test` never requires Docker and should complete quickly. If it hangs:

- Confirm you ran `npm test`, not `npm run test:floci`/`npm run test:e2e` (both require Floci and
  self-skip only when Floci is unreachable — they will otherwise wait on a real Docker container).
- `npm run floci:down` to stop any stray Floci container that a previous `test:floci`/`test:e2e` run
  left behind, then retry.

## Missing coverage report

**Symptom**: no `coverage/lcov.info` after running tests.

`npm test` already runs with `--coverage` (see the `test` script in `package.json`) and writes to
`coverage/` (gitignored). If the directory is missing, confirm the command completed without being
interrupted, and that `coverage` is not excluded by a local `.gitignore`/CI cache misconfiguration
outside this repository.

## Temporary upload cleanup

Not applicable — uploads are handled entirely in memory by Hapi's multipart parsing
(`output: 'annotated'`); no temporary files are ever written to disk, so there is nothing to clean
up (see [README § Security](../README.md#security)).
