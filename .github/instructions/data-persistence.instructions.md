---
description: 'Data persistence and reference data pipeline standards for the MMO Catch Recording Reference Data Service: in-memory data store, AWS S3 persistence, dataset validation and normalisation pipeline, atomic collection replacement, cache refresh lifecycle, FLOCI local S3 emulation, and architecture boundaries. Use when designing, updating, or testing reference data persistence and queries.'
applyTo: 'src/**/*.js'
---

# Data persistence & Reference Data pipeline

Precedence: DEFRA standards > community S3/storage guidance. Persistence is where data integrity, low-latency
query performance and architecture boundaries meet.

## Architecture boundaries (mandatory)

Enforced by `src/architecture-boundaries.test.js`:

- **`@aws-sdk/client-s3` may ONLY be imported inside `src/reference-data/persistence/`**. No other module
  (controllers, routes, query engine, validation, normalisation) may import or use S3 SDK classes.
- **The concrete Authentication Service client may ONLY be imported in `src/reference-data/validation/authentication/`**.
- Any new dependency or module must honour these boundary guardrails.

## Reference data pipeline lifecycle

The service maintains five canonical reference datasets (vessels, gears, ports, species, map locations):

1. **Canonical Schemas (`src/common/schemas/`):** Joi schemas defining canonical dataset structure.
2. **Validation (`src/reference-data/validation/`):**
   - Structural validation against canonical schemas.
   - Domain validation (e.g. valid FAO codes, vessel dimensions, port coordinates).
   - Referential integrity checks across datasets.
3. **Normalisation (`src/reference-data/normalisation/`):** transforms raw source records into standard
   canonical models.
4. **In-Memory Store (`src/reference-data/in-memory-store/`):**
   - Holds loaded collections in-memory for low-latency queries (`<10ms`).
   - Thread-safe, atomic reference replacement: swapping a collection in memory never exposes a partial or
     inconsistent state during updates.
5. **Persistence Module (`src/reference-data/persistence/`):**
   - Stores raw snapshots and canonical JSON objects in AWS S3 (or FLOCI local bucket).
   - Manages `manifest.json` recording dataset versions, ETags, timestamps and record counts.
6. **Cache Refresh Lifecycle (`src/reference-data/cache-refresh/`):**
   - Hydrates the in-memory store from S3 on startup.
   - Background periodic polling detects manifest changes and refreshes changed collections atomically.

## Query engine & projection models

- **Query Engine (`src/reference-data/query/`):** performs filtering, searching, prefix matching and
  sorting directly against in-memory collections without external network calls.
- **Projection models:**
  - Standard JSON response: full canonical entity.
  - Mobile projection (`/vessels/mobile`, etc.): compact payload for mobile sync.
  - Map projection (`/ports/map`, `/map-locations`): geo-optimised coordinate records.

## Local development with FLOCI S3 emulation

Local development and integration tests use FLOCI for local S3 bucket emulation.

### FLOCI Commands

- **Start FLOCI:** `npm run floci:up` (runs `docker compose up -d --wait floci`)
- **Stop FLOCI:** `npm run floci:down`
- **Reset FLOCI:** `npm run floci:reset` (wipes volume and restarts)
- **View Logs:** `npm run floci:logs`
- **Inspect Buckets:** `npm run floci:buckets`
- **List S3 Objects:** `npm run floci:objects`
- **Inspect Manifest:** `npm run floci:manifest`
- **Bootstrap Seed Data:** `npm run reference-data:bootstrap`

### Common FLOCI failure modes & fixes

- `ECONNREFUSED` on port 4566 / FLOCI port: FLOCI is not running. Run `npm run floci:up`.
- `NoSuchBucket`: bucket not initialized. Run `npm run reference-data:bootstrap` or `npm run floci:reset`.
- Stale test state: run `npm run floci:reset && npm run reference-data:bootstrap`.

## Testing persistence & pipeline

- Run FLOCI integration tests: `npm run test:floci` (verifies repository, bootstrap, cache-refresh and
  collection replacement).
- Run full end-to-end tests: `npm run test:e2e`.
- Run unit tests and boundary assertions: `npm test`.
