# Plan: Step 06 — Configure Floci S3 Resources for Local Development

## Repository inspection summary

- `compose.yml` already defines the `floci` service (`hectorvent/floci:latest-aws`, port 4566,
  `compose/aws.env`, `FLOCI_DEFAULT_REGION`) and the app service already gets the correct
  container-network endpoint override (`AWS_ENDPOINT_URL: http://floci:4566`,
  `S3_FORCE_PATH_STYLE: true`) — both set up in Step 02.
- `compose/aws.env` already provides dummy local credentials (`test`/`test`) and
  `AWS_ENDPOINT_URL=http://localhost:4566` for host execution.
- `compose/floci/start.d/10-setup-resources.sh` was mounted as a Floci startup hook
  (`/etc/floci/init/start.d`) but only contained commented-out example commands — no bucket was
  ever created.
- `src/config.js` (Step 02) already defines `referenceData.bucket` with default
  `mmo-cr-reference-data-service` — this is the bucket name used, not the `reference-data-local`
  name suggested as a fallback by this step's own prompt, because the repository already
  established a naming convention.
- **Object-key convention conflict identified and resolved**: the standalone Step 06 prompt's
  own "Proposed object-key structure" section (`manifest/active.json`,
  `collections/vessels/{version}.json`, ...) differs from the convention already approved in the
  master `reference-data-service-implementation-plan.md` Step 06 section
  (`reference-data/manifest.json`, `reference-data/vessels/{version}.json`, ...), which Step 07's
  prompt also treats as authoritative. Per the Step 06 prompt's own instruction ("use an existing
  approved convention if the repository already defines one"), the master-plan convention is
  used; the prompt's fallback structure is not used. Documented here rather than silently applied.
- **Seed data scope conflict identified and resolved**: the standalone Step 06 prompt asks for
  deterministic seed collections and an initial manifest. The master plan explicitly assigns this
  to Step 23 ("Add seed reference data and deterministic local bootstrap"), which depends on
  Steps 06, 07, **and 22** (atomic collection replacement) — none of which exist yet. Seed data
  and the manifest are therefore intentionally NOT created in this step; only the empty,
  correctly-configured bucket is provisioned. This preserves the master plan's locked step
  boundaries and dependency order.
- Investigated the running Floci image directly (`hectorvent/floci:latest-aws`, Floci 1.5.5):
  - Real AWS CLI v2 (`/usr/bin/aws`) is bundled in the image; used directly in the init script.
  - A `HEALTHCHECK` (`wget --spider http://localhost:4566/_floci/health`) is already baked into
    the image, so `depends_on: condition: service_healthy` already worked correctly — no compose
    healthcheck block needed.
  - Storage defaults to `FLOCI_STORAGE_MODE=memory` (data lost on every container
    stop/restart, confirmed empirically) even though `FLOCI_STORAGE_PERSISTENT_PATH=/app/data`
    is already baked in. Switching to `FLOCI_STORAGE_MODE=hybrid` plus a named volume at
    `/app/data` was confirmed (empirically, via full `docker compose down`/`up` cycles) to
    persist bucket state across container recreation while still flushing asynchronously.
  - `head-bucket` returns a real 404 when the bucket doesn't exist and `BucketAlreadyOwnedByYou`
    on a duplicate `create-bucket` — confirmed the idempotency strategy (check via `head-bucket`
    first) mirrors real, non-`us-east-1` S3 semantics.
  - `docker compose down -v floci` / `docker compose up -d --wait floci` correctly scope
    container, network, and volume lifecycle to just the `floci` service and block until healthy
    — used directly rather than hardcoding the compose-generated volume name.

## Decisions

1. Bucket name: `REFERENCE_DATA_BUCKET` (default `mmo-cr-reference-data-service`, matching
   `src/config.js`), added to `compose/aws.env` so both the app and the Floci init script share
   one source of truth locally.
2. Persistence: `FLOCI_STORAGE_MODE=hybrid` + a new `floci-data` named volume at `/app/data`
   (confirmed correct by inspecting the running container, not guessed).
3. No compose `healthcheck:` block added — the image's built-in health check already satisfies
   `depends_on: condition: service_healthy`.
4. Provisioning script confines itself to bucket existence, versioning, and public-access
   blocking only — no seed objects, no manifest (see "Seed data scope conflict" above).
5. Local developer commands added as `npm run floci:*` scripts, using `docker compose exec floci
aws ...` for inspection commands so no AWS CLI installation is required on the host.

## Steps

1. `compose/floci/start.d/10-setup-resources.sh` — idempotent bucket creation (region-aware
   `LocationConstraint` handling), versioning, public-access block, clear logging, non-zero exit
   on failure (`set -euo pipefail`).
2. `compose.yml` — add `FLOCI_STORAGE_MODE: hybrid` and the `floci-data` volume to the `floci`
   service; declare the top-level `floci-data` volume.
3. `compose/aws.env` — add `REFERENCE_DATA_BUCKET=mmo-cr-reference-data-service`.
4. `package.json` — add `floci:up`, `floci:down`, `floci:reset`, `floci:logs`, `floci:buckets`,
   `floci:objects`, `floci:manifest` scripts.
5. `README.md` — new "Floci S3-compatible storage" subsection (bucket, endpoints, persistence,
   object-key convention, seed-data deferral note, command table, raw AWS CLI examples).
6. This plan file.

## Relevant files

- Modified: `compose/floci/start.d/10-setup-resources.sh`, `compose.yml`, `compose/aws.env`,
  `package.json`, `README.md`.
- New: this plan file.
- Unchanged: `src/**` (no application source touched by this step), Dockerfile.

## Out of scope

Seed reference-data collections and the initial manifest (Step 23), the Persistence Module
(Step 07), any application code changes, LocalStack/MinIO, database or Redis of any kind.

## Verification (all run against the real Floci container, see completion report for full output)

- `docker compose up -d floci` — bucket created, versioned, public-access blocked, logged.
- Re-running provisioning (`docker compose down floci && up -d floci`) — idempotent, skips
  creation, no errors.
- `docker compose down floci && docker volume rm ... && up -d floci` / `npm run floci:reset` —
  wipes and cleanly reprovisions.
- Container-network (`http://floci:4566`) and host-network (`http://localhost:4566`) both
  return `200` from `/_floci/health`.
- `npm run floci:buckets` / `floci:objects` / `floci:manifest` (expected 404 pre-seed) all behave
  as documented.
- Full stack (`docker compose up -d`) starts; Floci reports healthy. The app container exits
  with an unrelated, pre-existing Node `--watch`/`.env` file-watcher crash inside the container —
  confirmed unrelated to this step (no Dockerfile, `src/`, or dev-script changes were made) and
  not fixed here per the "do not broaden scope" instruction; flagged in the completion report.
- `npm run lint`, `npm test` (308/308 passed, same coverage as before Step 06 — no source files
  changed), `npx prettier --check` on all touched formattable files — all pass.
