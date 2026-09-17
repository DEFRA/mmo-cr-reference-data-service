# mmo-cr-reference-data-service

Core delivery platform Node.js Backend Template.

- [Requirements](#requirements)
  - [Node.js](#nodejs)
- [Local development](#local-development)
  - [Setup](#setup)
  - [Development](#development)
  - [Testing](#testing)
  - [Production](#production)
  - [Npm scripts](#npm-scripts)
  - [Update dependencies](#update-dependencies)
  - [Formatting](#formatting)
    - [Windows prettier issue](#windows-prettier-issue)
- [API endpoints](#api-endpoints)
- [Development helpers](#development-helpers)
  - [Proxy](#proxy)
- [Docker](#docker)
  - [Development image](#development-image)
  - [Production image](#production-image)
  - [Docker Compose](#docker-compose)
  - [Dependabot](#dependabot)
  - [SonarCloud](#sonarcloud)
- [Licence](#licence)
  - [About the licence](#about-the-licence)

## Requirements

### Node.js

Please install [Node.js](http://nodejs.org/) `>= v24` and [npm](https://nodejs.org/) `>= v11`. You will find it
easier to use the Node Version Manager [nvm](https://github.com/creationix/nvm)

To use the correct version of Node.js for this application, via nvm:

```bash
cd mmo-cr-reference-data-service
nvm use
```

## Local development

### Setup

Install application dependencies:

```bash
npm install
```

### Git hooks

Install git hooks (optional)

```bash
npm run git:hooks
```

### Development

To run the application in `development` mode run:

```bash
npm run dev
```

### Configuration

Configuration is loaded and validated at startup from environment variables (see [src/config.js](./src/config.js)). All variables have safe local defaults, so the service runs without any `.env` file.

| Variable                                      | Purpose                                                                       | Required                                         | Local example                   | Deployed AWS behaviour                                 | Sensitive |
| --------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------- | ------------------------------------------------------ | --------- |
| `PORT`                                        | Port the server binds to                                                      | No (defaults to `3001`)                          | `3001`                          | Provided by the platform                               | No        |
| `AWS_REGION`                                  | AWS region for S3-compatible reference-data storage                           | No (defaults to `eu-west-2`)                     | `eu-west-2`                     | Set by the deployment environment                      | No        |
| `AWS_ENDPOINT_URL`                            | S3-compatible endpoint override for local development                         | No                                               | `http://floci:4566`             | Must be unset so the AWS SDK uses the default endpoint | No        |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Static credentials, consumed directly by the AWS SDK (not part of app config) | Local only                                       | `test` (via `compose/aws.env`)  | Must not be set; use the platform's IAM role instead   | **Yes**   |
| `REFERENCE_DATA_BUCKET`                       | S3-compatible bucket storing reference-data collections                       | No (defaults to `mmo-cr-reference-data-service`) | `mmo-cr-reference-data-service` | Deployed environments must set an explicit bucket name | No        |
| `S3_FORCE_PATH_STYLE`                         | Use path-style S3 addressing (required by Floci)                              | No (defaults to `false`)                         | `true`                          | Leave unset/`false` for real AWS S3                    | No        |
| `AUTHENTICATION_SERVICE_URL`                  | Base URL of the Authentication Service (not yet integrated)                   | No                                               | unset                           | Set once the Validation Module integrates with it      | No        |
| `REFERENCE_DATA_REFRESH_INTERVAL_MS`          | Interval between reference-data cache-refresh checks                          | No (defaults to `60000`)                         | `60000`                         | Same as local unless tuned                             | No        |
| `REFERENCE_DATA_MAX_UPLOAD_BYTES`             | Maximum accepted reference-data collection upload size                        | No (defaults to `26214400`)                      | `26214400`                      | Same as local unless tuned                             | No        |
| `LOG_LEVEL`                                   | Logging verbosity                                                             | No (defaults to `info`)                          | `info`                          | Same as local unless tuned                             | No        |

Invalid mandatory configuration (e.g. an out-of-range port or a malformed URL) prevents the service from starting and produces a validation error. Secret values are never logged or included in validation errors.

### Testing

To test the application run:

```bash
npm run test
```

Floci integration tests for the Persistence Module live alongside their unit tests
(`*.floci.test.js`) and are skipped automatically by `npm test` when Floci is not reachable, so
the default test run never requires Docker. To run them explicitly against a real local S3:

```bash
npm run test:floci
```

### Production

To mimic the application running in `production` mode locally run:

```bash
npm start
```

### Npm scripts

All available Npm scripts can be seen in [package.json](./package.json).
To view them in your command line run:

```bash
npm run
```

### Update dependencies

To update dependencies use [npm-check-updates](https://github.com/raineorshine/npm-check-updates):

> The following script is a good start. Check out all the options on
> the [npm-check-updates](https://github.com/raineorshine/npm-check-updates)

```bash
ncu --interactive --format group
```

### Formatting

#### Windows prettier issue

If you are having issues with formatting of line breaks on Windows update your global git config by running:

```bash
git config --global core.autocrlf false
```

## API endpoints

| Endpoint                               | Description                                      |
| :------------------------------------- | :----------------------------------------------- |
| `GET: /health`                         | Health                                           |
| `GET: /health/ready`                   | Readiness (cache-hydration state)                |
| `GET: /api/v1/reference-data/manifest` | Active dataset versions and metadata (see below) |

### Manifest API

`GET /api/v1/reference-data/manifest` returns the active version, GUID, ETag, format, and public
URL of every persisted dataset (`vessels`, `gears`, `ports`, `species`, `map-land`,
`map-statistical-areas`). It never includes `map-ports` (always derived from `ports`, never an
independent manifest entry). Requires the `reference-data.read` permission via the existing
provisional Authentication Service integration (`Authorization: Bearer <token>`).

- `?include=vessels,ports` restricts the response to the listed datasets (comma-separated,
  case-sensitive canonical identifiers only; an unsupported or empty value returns `400`).
- The response carries an `ETag` derived only from the active `manifestId`+`version` (stable
  while unchanged, and shared by every filtered view — see the saved Step 14 plan for the
  filtered-manifest ETag policy). Send `If-None-Match` to receive `304 Not Modified` with no body.
- Returns `503` (`reference_data_unavailable`) if startup hydration has not yet produced a valid
  active manifest — never an empty successful manifest.
- Reads only from the in-memory active manifest (Step 11); it never calls S3/Floci per request.

## Reference Data Domain Model

Shared domain types and contracts live under [src/common/domain](./src/common/domain) and [src/common/contracts](./src/common/contracts). They define the vocabulary and boundaries later steps implement against; none of them implement business behaviour.

### Datasets and capabilities

Seven datasets are supported (see [datasets.js](./src/common/domain/datasets.js)): `vessels`, `gears`, `ports`, `species`, `map-land`, `map-statistical-areas`, and `map-ports`. Each has explicit capabilities:

| Dataset                 | Queryable | Uploadable | Persisted | Derived            | Format  |
| ----------------------- | --------- | ---------- | --------- | ------------------ | ------- |
| `vessels`               | Yes       | Yes        | Yes       | No                 | JSON    |
| `gears`                 | Yes       | Yes        | Yes       | No                 | JSON    |
| `ports`                 | Yes       | Yes        | Yes       | No                 | JSON    |
| `species`               | Yes       | Yes        | Yes       | No                 | JSON    |
| `map-land`              | Yes       | Yes        | Yes       | No                 | GeoJSON |
| `map-statistical-areas` | Yes       | Yes        | Yes       | No                 | GeoJSON |
| `map-ports`             | Yes       | No         | No        | Yes (from `ports`) | GeoJSON |

`map-ports` is always derived from the active `ports` collection: it cannot be uploaded and has no independent manifest entry.

### Canonical vs mobile representations

Every dataset supports two representations: `canonical` (the complete authoritative model) and `mobile` (a consumer projection generated from canonical data for the Catch Recording mobile app). Mobile representations are never independently persisted.

### GUID identity vs business identifiers

Every canonical reference-data resource has a stable GUID as its technical `id`. Existing business identifiers (vessel CFR, registration number, external mark, gear code, port code, species FAO code, statistical-area code) remain separate from — and are never replaced by — the GUID.

### What a "collection" means

A reference-data `collection` is a complete, versioned JSON or GeoJSON file representing one dataset — not a database collection. Updates always replace a complete collection; there are no item-level create/update/patch/delete operations.

### Persistence and caching

- S3-compatible object storage (via Floci locally) is the durable source of truth. Only the Persistence Module accesses it.
- Active collections are held as process-local JSON objects in the In-Memory Data Store — a cache, not a database.
- There is no database and no Redis dependency anywhere in this service.

### External-boundary contracts

Four infrastructure-independent contracts define the seams later steps implement against, each substitutable with a test double via a `create*Contract(overrides)` factory: `referenceDataRepository` (Persistence Module), `inMemoryDataStore` (In-Memory Data Store), `authenticationClient` (Validation Module), and `referenceDataProjector` (canonical-to-mobile projection).

## Canonical Schemas

Versioned, machine-validatable structural schemas for every persisted collection live under [src/common/schemas](./src/common/schemas), built with [Joi](https://joi.dev) (already a repository dependency — no new schema library was introduced). They validate structure only; business validation (uniqueness, cross-record references, date ordering, etc.) belongs to later steps.

### Schema version

The only supported schema version is `1.0`, centrally defined in [schema-versions.js](./src/common/schemas/schema-versions.js). Unknown versions are rejected deterministically; there is no automatic migration. Future versions must be registered explicitly in the [schema registry](./src/common/schemas/schema-registry.js).

### Schema registry

`getCollectionSchema(dataset, schemaVersion)` and `getManifestSchema(schemaVersion)` resolve the correct schema for a dataset/version, reusing the Step 03 dataset constants. `map-ports` can never resolve as a persisted, uploadable schema because it is not in the persisted-dataset list.

### Collection envelope and manifest

Every persisted collection shares one metadata shape (`dataset`, `collectionId`, `schemaVersion`, `version`, `generatedAt`, optional `effectiveFrom`, `itemCount`) combined with dataset-specific content (`items`, or `categories`/`characteristics`/`items` for gears, or `type`/`features` for GeoJSON datasets) — see [v1/collection-envelope.js](./src/common/schemas/v1/collection-envelope.js). The active manifest ([v1/manifest.js](./src/common/schemas/v1/manifest.js)) tracks one entry per persisted dataset and never includes an independent `map-ports` entry.

### JSON vs GeoJSON

`vessels`, `gears`, `ports`, and `species` are JSON item collections. `map-land` and `map-statistical-areas` are GeoJSON `FeatureCollection`s with structurally validated `Polygon`/`MultiPolygon` geometry (coordinates must be JSON numbers, longitude-first). `map-ports` has only a reusable, non-persisted response shape ([v1/map-ports.js](./src/common/schemas/v1/map-ports.js)) since it is derived, not uploadable, and not part of the manifest.

### Structural vs business validation

This step validates required properties, types, GUID/date/timestamp formats, enumerated structural values, array/object shapes, and additional-property policy. It deliberately does **not** validate cross-record uniqueness, business-code ownership, relationship resolution, or date ordering — those belong to Steps 08 and 09.

### Fixtures

Small, synthetic, schema-valid example collections and 18 focused invalid fixtures (one per common structural failure) live under [src/common/schemas/fixtures](./src/common/schemas/fixtures), used only for tests — not production seed data.

## In-Memory Data Store

[src/reference-data/in-memory-store](./src/reference-data/in-memory-store) implements the Step 03 `inMemoryDataStore` contract. It is the only process-local cache of active canonical collections, collection metadata, and the active manifest.

- **Process-local and non-durable**: state lives only in application memory and is lost on restart. S3-compatible storage (via the Persistence Module) remains the durable source of truth; rebuilding the cache after a restart is implemented by the Step 11 Cache Refresh Module, not by this store.
- **No database, no Redis**: the store is a plain in-process `Map`, not backed by any external system.
- **Atomic per-dataset replacement**: `setCollection(dataset, collection, metadata)` both creates and replaces a dataset's active entry. The collection and metadata are defensively cloned before the internal map is mutated, so a failed clone (e.g. non-cloneable input) throws and leaves the previous entry — if any — completely unchanged. Readers never observe a collection paired with the wrong metadata.
- **Defensive access**: `structuredClone` (Node ≥24) is used on every write and every read, so callers can never mutate active store state through a reference they passed in or received back, including nested arrays/objects.
- **Loaded-state distinction**: `getCollection`/`getCollectionMetadata` return `undefined` when nothing is loaded, which is distinguishable from a validly stored `null`/empty collection. `getManifest` returns `null` when no manifest has been set. `hasCollection` reports the loaded state explicitly.
- **Stable dataset ordering**: `listLoadedDatasets()` returns loaded datasets in the canonical `DATASETS` declaration order, not Map insertion order.
- **`map-ports` cannot be stored**: it is a derived dataset (from `ports`) and `setCollection` rejects it.
- **Test isolation**: call `createInMemoryDataStore()` to get a fresh, independent instance (used throughout [in-memory-data-store.test.js](./src/reference-data/in-memory-store/in-memory-data-store.test.js)). The `inMemoryStore` singleton exported from `index.js` is the production composition root and should not be relied on for test isolation.

## Persistence Module

[src/reference-data/persistence](./src/reference-data/persistence) implements the Step 03 `referenceDataRepository` contract. It is the **only** component in this repository permitted to import `@aws-sdk/client-s3`, construct an S3 client, or talk to S3/Floci directly — enforced automatically by [src/architecture-boundaries.test.js](./src/architecture-boundaries.test.js).

- **Exclusive S3 ownership**: no other module constructs an S3 client or sends S3 commands. The domain layer, In-Memory Data Store, and every other component depend only on the `referenceDataRepository` contract.
- **Local Floci vs deployed AWS**: the S3 client (`s3-client.js`) is built from central config (`aws.region`, `aws.endpointUrl`, `aws.forcePathStyle`). Locally, `aws.endpointUrl` points at Floci (`http://floci:4566` in Compose, `http://localhost:4566` on the host) and `forcePathStyle` is `true`. In deployed AWS environments the endpoint is left unset, so the SDK uses the normal AWS S3 endpoint and its default credential provider chain — no static credentials are read from config. Constructing the client never makes a network call.
- **Object keys**: centralised in `object-keys.js`. The manifest is always `reference-data/manifest.json`; collections are `reference-data/{dataset}/{collectionVersion}.json`. Collection versions are restricted to `[A-Za-z0-9._-]+`, rejecting traversal, separators, whitespace, and URL-like content. `map-ports` and unsupported datasets are rejected before any object key is built.
- **JSON and GeoJSON**: `writeCollection` selects `application/json` or `application/geo+json` from the Step 03 dataset capabilities; the Persistence Module never inspects or normalises the content itself.
- **Checksums vs ETags**: SHA-256 is the approved checksum algorithm. Where available, the S3-native `ChecksumSHA256` (requested via `ChecksumAlgorithm`/`ChecksumMode`) is used so metadata can often be read without downloading the object body; a manual SHA-256 is computed as a fallback when reading a body directly. The S3 `ETag` is always kept as a separate field and is never assumed to be a content checksum.
- **Conflict protection**: `writeCollection` never overwrites an existing collection version; `writeManifest` supports optimistic concurrency via an `expectedEtag`. Both send the correct conditional S3 headers (`IfNoneMatch`/`IfMatch`) for real AWS S3, **and** perform an explicit existence/ETag pre-check, because Floci does not currently enforce conditional-write headers (verified empirically — see the Step 07 plan file for details). This keeps local development safe without weakening production behaviour.
- **Error translation**: AWS SDK and network failures are mapped to the existing Step 03 service-error codes (e.g. `dataset_not_found`, `collection_version_exists`, `collection_modified`, `invalid_json`, `forbidden`, `reference_store_unavailable`). Access-denied is never reported as not-found; only a confirmed missing object is. Internal causes (`error.cause`) are preserved for diagnostics but are not part of the public error shape.
- **No database, no Redis**: S3-compatible object storage is the only durable persistence mechanism this module talks to.

## Development helpers

### Proxy

We are using forward-proxy which is set up by default. Services are automatically configured with the proxy environment variables when deployed.

Node.js 24 uses these variables to route outbound HTTP(S) requests through the proxy:

NODE_USE_ENV_PROXY=1
HTTPS_PROXY=...
NO_PROXY=...

No additional proxy configuration is required in the service.

## Docker

Build:

```bash
docker build --no-cache --tag mmo-cr-reference-data-service .
```

Run:

```bash
docker run -e PORT=3001 -p 3001:3001 mmo-cr-reference-data-service
```

### Docker Compose

A local environment with:

- Floci for AWS services (S3, SQS, SNS etc)
- This service.
- A commented out frontend example.

```bash
docker compose up --build -d
```

Mock AWS resources can be created when Floci starts up by editing the scripts in `./compose/floci/start.d/`.

#### Floci S3-compatible storage

Floci provides the local S3-compatible endpoint used by the Reference Data Service; no LocalStack or MinIO is used. `AWS_ENDPOINT_URL` selects the endpoint: `http://floci:4566` for the app running inside Docker Compose (already set in [compose.yml](./compose.yml)), `http://localhost:4566` for the app running directly on the host (already set in [compose/aws.env](./compose/aws.env)).

On every start, [compose/floci/start.d/10-setup-resources.sh](./compose/floci/start.d/10-setup-resources.sh) runs automatically as a Floci startup hook and idempotently:

- creates the `REFERENCE_DATA_BUCKET` bucket (default `mmo-cr-reference-data-service`) if it does not already exist,
- enables bucket versioning,
- blocks public access.

Floci's built-in health check (`GET /_floci/health`) backs `depends_on: condition: service_healthy` for the app service. Local S3 state is kept in the `floci-data` named volume with `FLOCI_STORAGE_MODE=hybrid`, so buckets survive a normal container restart; it is not durable production storage.

The approved local object-key convention (created by the Persistence Module in a later step) is:

```text
reference-data/manifest.json
reference-data/vessels/{version}.json
reference-data/gears/{version}.json
reference-data/ports/{version}.json
reference-data/species/{version}.json
reference-data/map-land/{version}.json
reference-data/map-statistical-areas/{version}.json
```

Seed reference-data objects and the initial manifest are added later (Step 23); until then the bucket exists but is empty.

Useful commands:

| Command                  | Purpose                                                      |
| ------------------------ | ------------------------------------------------------------ |
| `npm run floci:up`       | Start Floci and wait until it reports healthy                |
| `npm run floci:down`     | Stop Floci, keeping persisted local S3 state                 |
| `npm run floci:reset`    | Remove persisted local S3 state and reprovision from scratch |
| `npm run floci:logs`     | Follow Floci's logs                                          |
| `npm run floci:buckets`  | List local buckets                                           |
| `npm run floci:objects`  | List objects in the reference-data bucket                    |
| `npm run floci:manifest` | Print the active manifest object (404 until seeded)          |

Equivalent raw AWS CLI (from the host, with the CLI installed and pointed at the local endpoint):

```bash
aws --endpoint-url http://localhost:4566 --region eu-west-2 s3api list-buckets
aws --endpoint-url http://localhost:4566 --region eu-west-2 s3api list-objects-v2 --bucket mmo-cr-reference-data-service
```

### Dependabot

We have added an example dependabot configuration file to the repository. You can enable it by renaming
the [.github/example.dependabot.yml](.github/example.dependabot.yml) to `.github/dependabot.yml`

### SonarCloud

Instructions for setting up SonarCloud can be found in [sonar-project.properties](./sonar-project.properties)

## Licence

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>

The following attribution statement MUST be cited in your products and applications when using this information.

> Contains public sector information licensed under the Open Government license v3

### About the licence

The Open Government Licence (OGL) was developed by the Controller of Her Majesty's Stationery Office (HMSO) to enable
information providers in the public sector to license the use and re-use of their information under a common open
licence.

It is designed to encourage use and re-use of information freely and flexibly, with only a few conditions.
