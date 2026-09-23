# Manual Local Testing — Terminal Commands

A copy-paste terminal walkthrough for exercising every endpoint of the Reference Data Service
against real local storage (Floci) and real local seed data. See
[api-reference.md](./api-reference.md) for the full contract these commands exercise.

All commands assume `bash`/`zsh` and are run from the repository root. GUIDs below are taken
from the committed local seed data under
[resources/reference-data/seed](../resources/reference-data/seed).

- [1. Start the service](#1-start-the-service)
- [1a. Configuring .env for manual testing](#1a-configuring-env-for-manual-testing)
- [2. Start a local authentication stub (required for authenticated routes)](#2-start-a-local-authentication-stub-required-for-authenticated-routes)
- [3. Health and readiness (no auth)](#3-health-and-readiness-no-auth)
- [4. Manifest](#4-manifest)
- [5. Vessels](#5-vessels)
- [6. Gears](#6-gears)
- [7. Ports](#7-ports)
- [8. Species](#8-species)
- [9. Map land](#9-map-land)
- [10. Map statistical areas](#10-map-statistical-areas)
- [11. Map ports (derived)](#11-map-ports-derived)
- [12. Validation-only upload](#12-validation-only-upload)
- [13. Atomic collection replacement](#13-atomic-collection-replacement)
- [14. Error-path checks](#14-error-path-checks)
- [15. Shut everything down](#15-shut-everything-down)

## 1. Start the service

Start Floci (the local S3-compatible emulator) and wait for it to be healthy, then bootstrap the
committed seed data into it, then start the app:

```bash
# 1a. Start Floci (S3 emulator) in the background
npm run floci:up

# 1b. Load the committed seed collections + manifest into Floci
npm run reference-data:bootstrap

# 1c. Start the app (separate terminal, stays in the foreground)
npm run dev
```

The app listens on `http://localhost:3001`. Confirm the manifest was bootstrapped:

```bash
npm run floci:manifest
```

## 1a. Configuring .env for manual testing

Copy [.env.sample](../.env.sample) to `.env` at the repository root, then change only the values
below — everything else in `.env.sample` already matches Floci/local defaults and doesn't need to
change:

| Variable                     | `.env.sample` value             | Change to (manual testing) | Why                                                                                                                                                       |
| ---------------------------- | ------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AWS_ACCESS_KEY_ID`          | `required`                      | `test`                     | Floci accepts any static credential; `test` matches [compose/aws.env](../compose/aws.env)                                                                 |
| `AWS_SECRET_ACCESS_KEY`      | `required`                      | `test`                     | Same as above                                                                                                                                             |
| `AUTHENTICATION_SERVICE_URL` | _(empty)_                       | `http://localhost:4599`    | Must point at the local auth stub from [§2](#2-start-a-local-authentication-stub-required-for-authenticated-routes), or every authenticated request fails |
| `AWS_ENDPOINT_URL`           | `http://localhost:4566`         | _(no change)_              | Matches Floci's exposed port in [compose.yml](../compose.yml)                                                                                             |
| `S3_FORCE_PATH_STYLE`        | `true`                          | _(no change)_              | Required by Floci                                                                                                                                         |
| `AWS_REGION`                 | `eu-west-2`                     | _(no change)_              | Matches `compose/aws.env`                                                                                                                                 |
| `REFERENCE_DATA_BUCKET`      | `mmo-cr-reference-data-service` | _(no change)_              | Matches the default the `floci:*`/bootstrap scripts use                                                                                                   |
| `PORT` / `HOST`              | `3001` / `0.0.0.0`              | _(no change)_              | Matches `npm run dev` and the `$BASE_URL` used throughout this document                                                                                   |
| Everything else              | defaults                        | _(no change)_              | `LOG_*`, `REFERENCE_DATA_REFRESH_*`, `HEALTH_*`, `METRICS_ENABLED`, `AUDIT_ENABLED` are all fine as-is                                                    |

`node --env-file-if-exists=.env` (used by `npm run dev`/`server:watch`) picks up `.env`
automatically — no extra flag or export needed once it's in place.

## 2. Start a local authentication stub (required for authenticated routes)

Every route except `/health*` requires a `Bearer` token validated against
`AUTHENTICATION_SERVICE_URL` (`POST {url}/validate`) — there is no built-in auth bypass. For
manual local testing, run a tiny stub server implementing that same contract with three fixed
tokens (read, write, no-permission), then point the app at it and restart:

```bash
# 2a. In a separate terminal: start the stub auth server on port 4599
node --input-type=module -e "
import { createServer } from 'node:http'
const IDENTITIES = {
  'read-token': { actorId: 'local-reader', permissions: ['reference-data.read'] },
  'write-token': { actorId: 'local-writer', permissions: ['reference-data.read', 'reference-data.write'] },
  'no-permission-token': { actorId: 'local-none', permissions: [] }
}
createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/validate') { res.writeHead(404).end(); return }
  const auth = req.headers.authorization ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  const identity = token ? IDENTITIES[token] : undefined
  if (!identity) { res.writeHead(401, { 'content-type': 'application/json' }); res.end(JSON.stringify({ message: 'invalid token' })); return }
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify(identity))
}).listen(4599, () => console.log('auth stub listening on 4599'))
"

# 2b. In the terminal where the app runs: point it at the stub and (re)start
export AUTHENTICATION_SERVICE_URL=http://localhost:4599
npm run dev
```

Export the three tokens once per terminal session so the commands below can reuse them:

```bash
export READ_TOKEN=read-token
export WRITE_TOKEN=write-token
export NO_PERMISSION_TOKEN=no-permission-token
export BASE_URL=http://localhost:3001
```

## 3. Health and readiness (no auth)

```bash
curl -s "$BASE_URL/health" | jq
curl -s "$BASE_URL/health/ready" | jq
curl -s "$BASE_URL/health/dependencies" | jq
```

## 4. Manifest

```bash
# All datasets
curl -s "$BASE_URL/api/v1/reference-data/manifest" \
  -H "Authorization: Bearer $READ_TOKEN" | jq

# Filtered by include
curl -s "$BASE_URL/api/v1/reference-data/manifest?include=vessels,ports" \
  -H "Authorization: Bearer $READ_TOKEN" | jq

# Conditional request (re-run with the ETag from the previous response)
ETAG=$(curl -s -D - -o /dev/null "$BASE_URL/api/v1/reference-data/manifest" \
  -H "Authorization: Bearer $READ_TOKEN" | grep -i '^etag:' | cut -d' ' -f2 | tr -d '\r')
curl -s -D - -o /dev/null "$BASE_URL/api/v1/reference-data/manifest" \
  -H "Authorization: Bearer $READ_TOKEN" \
  -H "If-None-Match: $ETAG"   # expect 304
```

## 5. Vessels

```bash
VESSEL_ID=00000000-0000-4000-8000-000000000011

# Collection, default view
curl -s "$BASE_URL/api/v1/reference-data/vessels" \
  -H "Authorization: Bearer $READ_TOKEN" | jq

# Item, canonical vs mobile
curl -s "$BASE_URL/api/v1/reference-data/vessels/$VESSEL_ID" \
  -H "Authorization: Bearer $READ_TOKEN" | jq
curl -s "$BASE_URL/api/v1/reference-data/vessels/$VESSEL_ID?view=mobile" \
  -H "Authorization: Bearer $READ_TOKEN" | jq

# Free-text search
curl -s "$BASE_URL/api/v1/reference-data/vessels?query=achilles" \
  -H "Authorization: Bearer $READ_TOKEN" | jq

# Exact-match filters
curl -s "$BASE_URL/api/v1/reference-data/vessels?cfr=GBR000A1234" \
  -H "Authorization: Bearer $READ_TOKEN" | jq
curl -s "$BASE_URL/api/v1/reference-data/vessels?mmsi=232001234" \
  -H "Authorization: Bearer $READ_TOKEN" | jq
curl -s "$BASE_URL/api/v1/reference-data/vessels?ids=$VESSEL_ID" \
  -H "Authorization: Bearer $READ_TOKEN" | jq

# Inactive, sorting, pagination
curl -s "$BASE_URL/api/v1/reference-data/vessels?includeInactive=true" \
  -H "Authorization: Bearer $READ_TOKEN" | jq
curl -s "$BASE_URL/api/v1/reference-data/vessels?sort=-lengthOverallMetres" \
  -H "Authorization: Bearer $READ_TOKEN" | jq
curl -s "$BASE_URL/api/v1/reference-data/vessels?offset=0&limit=1" \
  -H "Authorization: Bearer $READ_TOKEN" | jq
```

## 6. Gears

```bash
GEAR_ID=00000000-0000-4000-8000-000000000020

curl -s "$BASE_URL/api/v1/reference-data/gears" \
  -H "Authorization: Bearer $READ_TOKEN" | jq
curl -s "$BASE_URL/api/v1/reference-data/gears?query=trawl" \
  -H "Authorization: Bearer $READ_TOKEN" | jq
curl -s "$BASE_URL/api/v1/reference-data/gears?code=OTB" \
  -H "Authorization: Bearer $READ_TOKEN" | jq
curl -s "$BASE_URL/api/v1/reference-data/gears?categoryCode=TOWED" \
  -H "Authorization: Bearer $READ_TOKEN" | jq
curl -s "$BASE_URL/api/v1/reference-data/gears?categoryId=00000000-0000-4000-8000-000000000021" \
  -H "Authorization: Bearer $READ_TOKEN" | jq
curl -s "$BASE_URL/api/v1/reference-data/gears?pairFishing=false" \
  -H "Authorization: Bearer $READ_TOKEN" | jq

# Mobile view + vessel-length band context
curl -s "$BASE_URL/api/v1/reference-data/gears?view=mobile&vesselLengthMetres=9.5" \
  -H "Authorization: Bearer $READ_TOKEN" | jq

curl -s "$BASE_URL/api/v1/reference-data/gears?sort=categoryCode&offset=0&limit=10" \
  -H "Authorization: Bearer $READ_TOKEN" | jq
```

## 7. Ports

```bash
PORT_ID=00000000-0000-4000-8000-000000000031

curl -s "$BASE_URL/api/v1/reference-data/ports" \
  -H "Authorization: Bearer $READ_TOKEN" | jq
curl -s "$BASE_URL/api/v1/reference-data/ports/$PORT_ID" \
  -H "Authorization: Bearer $READ_TOKEN" | jq

curl -s "$BASE_URL/api/v1/reference-data/ports?query=plymouth" \
  -H "Authorization: Bearer $READ_TOKEN" | jq
curl -s "$BASE_URL/api/v1/reference-data/ports?code=GB007" \
  -H "Authorization: Bearer $READ_TOKEN" | jq
curl -s "$BASE_URL/api/v1/reference-data/ports?countryCode=GBR" \
  -H "Authorization: Bearer $READ_TOKEN" | jq

# Radius search (all three of latitude/longitude/radiusKm together)
curl -s "$BASE_URL/api/v1/reference-data/ports?latitude=50.3&longitude=-4.2&radiusKm=10" \
  -H "Authorization: Bearer $READ_TOKEN" | jq

curl -s "$BASE_URL/api/v1/reference-data/ports?sort=name&includeInactive=true" \
  -H "Authorization: Bearer $READ_TOKEN" | jq
```

## 8. Species

```bash
SPECIES_ID=00000000-0000-4000-8000-000000000041

curl -s "$BASE_URL/api/v1/reference-data/species" \
  -H "Authorization: Bearer $READ_TOKEN" | jq
curl -s "$BASE_URL/api/v1/reference-data/species/$SPECIES_ID" \
  -H "Authorization: Bearer $READ_TOKEN" | jq

curl -s "$BASE_URL/api/v1/reference-data/species?query=cod" \
  -H "Authorization: Bearer $READ_TOKEN" | jq
curl -s "$BASE_URL/api/v1/reference-data/species?faoCode=COD" \
  -H "Authorization: Bearer $READ_TOKEN" | jq
curl -s "$BASE_URL/api/v1/reference-data/species?scientificName=Gadus%20morhua" \
  -H "Authorization: Bearer $READ_TOKEN" | jq
curl -s "$BASE_URL/api/v1/reference-data/species?countryCode=GBR" \
  -H "Authorization: Bearer $READ_TOKEN" | jq
curl -s "$BASE_URL/api/v1/reference-data/species?languageCode=cy" \
  -H "Authorization: Bearer $READ_TOKEN" | jq

# Mobile view with Accept-Language driving displayName resolution
curl -s "$BASE_URL/api/v1/reference-data/species/$SPECIES_ID?view=mobile" \
  -H "Authorization: Bearer $READ_TOKEN" \
  -H "Accept-Language: cy" | jq
```

## 9. Map land

```bash
curl -s "$BASE_URL/api/v1/reference-data/map/land" \
  -H "Authorization: Bearer $READ_TOKEN" | jq
curl -s "$BASE_URL/api/v1/reference-data/map/land?query=cornwall" \
  -H "Authorization: Bearer $READ_TOKEN" | jq
curl -s "$BASE_URL/api/v1/reference-data/map/land?bbox=-6,49,-3,51" \
  -H "Authorization: Bearer $READ_TOKEN" | jq
```

## 10. Map statistical areas

```bash
AREA_ID=00000000-0000-4000-8000-000000000061

curl -s "$BASE_URL/api/v1/reference-data/map/statistical-areas" \
  -H "Authorization: Bearer $READ_TOKEN" | jq
curl -s "$BASE_URL/api/v1/reference-data/map/statistical-areas/$AREA_ID" \
  -H "Authorization: Bearer $READ_TOKEN" | jq
curl -s "$BASE_URL/api/v1/reference-data/map/statistical-areas?query=ICES" \
  -H "Authorization: Bearer $READ_TOKEN" | jq
curl -s "$BASE_URL/api/v1/reference-data/map/statistical-areas?code=27D8" \
  -H "Authorization: Bearer $READ_TOKEN" | jq
curl -s "$BASE_URL/api/v1/reference-data/map/statistical-areas?bbox=-5,50,-4,50.5" \
  -H "Authorization: Bearer $READ_TOKEN" | jq
```

## 11. Map ports (derived)

```bash
curl -s "$BASE_URL/api/v1/reference-data/map/ports" \
  -H "Authorization: Bearer $READ_TOKEN" | jq
curl -s "$BASE_URL/api/v1/reference-data/map/ports?code=GBPLY" \
  -H "Authorization: Bearer $READ_TOKEN" | jq
curl -s "$BASE_URL/api/v1/reference-data/map/ports?countryCode=GBR" \
  -H "Authorization: Bearer $READ_TOKEN" | jq
curl -s "$BASE_URL/api/v1/reference-data/map/ports?bbox=-6,49,-3,51" \
  -H "Authorization: Bearer $READ_TOKEN" | jq
```

## 12. Validation-only upload

Requires `reference-data.write`. Copy a seed collection to a scratch file, tweak it if you want to
see a validation failure, then upload with `validateOnly=true` (never persists):

```bash
cp resources/reference-data/seed/ports.json /tmp/ports-upload.json

curl -s -X PUT "$BASE_URL/api/v1/reference-data/ports?validateOnly=true" \
  -H "Authorization: Bearer $WRITE_TOKEN" \
  -F "file=@/tmp/ports-upload.json;type=application/json" \
  -F "schemaVersion=1.0" \
  -F "version=manual-test-1" | jq

# map-ports can never be uploaded — expect 400 invalid_dataset
curl -s -X PUT "$BASE_URL/api/v1/reference-data/map-ports?validateOnly=true" \
  -H "Authorization: Bearer $WRITE_TOKEN" \
  -F "file=@/tmp/ports-upload.json;type=application/json" | jq
```

## 13. Atomic collection replacement

```bash
# Bump the version so it's accepted as a new immutable collection
jq '.version = "manual-test-1"' resources/reference-data/seed/ports.json > /tmp/ports-replace.json

curl -s -X PUT "$BASE_URL/api/v1/reference-data/ports" \
  -H "Authorization: Bearer $WRITE_TOKEN" \
  -F "file=@/tmp/ports-replace.json;type=application/json" \
  -F "schemaVersion=1.0" \
  -F "version=manual-test-1" | jq

# Re-uploading the same version + same content again succeeds idempotently
curl -s -X PUT "$BASE_URL/api/v1/reference-data/ports" \
  -H "Authorization: Bearer $WRITE_TOKEN" \
  -F "file=@/tmp/ports-replace.json;type=application/json" \
  -F "schemaVersion=1.0" \
  -F "version=manual-test-1" | jq   # expect "idempotent": true

# Same version + different content -> 409 collection_version_exists
jq '.version = "manual-test-1" | .items[0].name = "CHANGED NAME"' \
  resources/reference-data/seed/ports.json > /tmp/ports-replace-conflict.json
curl -s -X PUT "$BASE_URL/api/v1/reference-data/ports" \
  -H "Authorization: Bearer $WRITE_TOKEN" \
  -F "file=@/tmp/ports-replace-conflict.json;type=application/json" \
  -F "schemaVersion=1.0" \
  -F "version=manual-test-1" | jq

# Optional If-Match precondition (fetch a fresh manifest ETag first)
curl -s "$BASE_URL/api/v1/reference-data/manifest" \
  -H "Authorization: Bearer $READ_TOKEN" | jq '.datasets[] | select(.dataset=="ports")'

# Verify the replacement is now reflected on read + on the derived map-ports layer
curl -s "$BASE_URL/api/v1/reference-data/ports" \
  -H "Authorization: Bearer $READ_TOKEN" | jq
curl -s "$BASE_URL/api/v1/reference-data/map/ports" \
  -H "Authorization: Bearer $READ_TOKEN" | jq
```

## 14. Error-path checks

```bash
# 401 — missing token
curl -s -o /dev/null -w "%{http_code}\n" "$BASE_URL/api/v1/reference-data/vessels"

# 401 — invalid token
curl -s -o /dev/null -w "%{http_code}\n" "$BASE_URL/api/v1/reference-data/vessels" \
  -H "Authorization: Bearer not-a-real-token"

# 403 — valid token, missing permission
curl -s -o /dev/null -w "%{http_code}\n" "$BASE_URL/api/v1/reference-data/vessels" \
  -H "Authorization: Bearer $NO_PERMISSION_TOKEN"

# 404 — unknown GUID
curl -s "$BASE_URL/api/v1/reference-data/vessels/00000000-0000-4000-8000-00000000ffff" \
  -H "Authorization: Bearer $READ_TOKEN" | jq

# 404 — unknown route
curl -s -o /dev/null -w "%{http_code}\n" "$BASE_URL/api/v1/reference-data/not-a-route"

# 400 — unknown query parameter
curl -s "$BASE_URL/api/v1/reference-data/vessels?notAParam=1" \
  -H "Authorization: Bearer $READ_TOKEN" | jq

# 400 — unsupported view
curl -s "$BASE_URL/api/v1/reference-data/vessels?view=bogus" \
  -H "Authorization: Bearer $READ_TOKEN" | jq

# 400 — invalid dataset on the write route
curl -s -X PUT "$BASE_URL/api/v1/reference-data/not-a-dataset" \
  -H "Authorization: Bearer $WRITE_TOKEN" \
  -F "file=@/tmp/ports-upload.json;type=application/json" | jq
```

## 15. Shut everything down

```bash
# Stop the app with Ctrl+C in its terminal, then:
npm run floci:down

# Or, to also wipe persisted Floci state:
npm run floci:reset
```
