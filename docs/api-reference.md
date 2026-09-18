# Reference Data Service — API Reference

This is the authoritative API contract for the Reference Data Service, generated from the
implemented routes, controllers, and query configurations under [`src/routes`](../src/routes) and
[`src/reference-data`](../src/reference-data). It documents behaviour as implemented, not as
originally planned — see [Known limitations and deferred work](../README.md#known-limitations-and-deferred-work)
for gaps.

All routes are prefixed `/api/v1/reference-data` unless otherwise noted. All examples use
fictional, deterministic GUIDs (`00000000-0000-4000-8000-...`, the same convention used by the
committed local seed data) — never real data or credentials.

- [Authentication and permissions](#authentication-and-permissions)
- [Standard error envelope](#standard-error-envelope)
- [Conditional requests and caching](#conditional-requests-and-caching)
- [Manifest](#manifest)
- [Canonical and mobile views](#canonical-and-mobile-views)
- [Vessels](#vessels)
- [Gears](#gears)
- [Ports](#ports)
- [Species](#species)
- [Map land](#map-land)
- [Map statistical areas](#map-statistical-areas)
- [Map ports (derived)](#map-ports-derived)
- [Validation-only upload](#validation-only-upload)
- [Atomic collection replacement](#atomic-collection-replacement)

## Authentication and permissions

Every route below except the three health/operational endpoints (`/health`, `/health/ready`,
`/health/dependencies`) requires a `Bearer` token validated by the Authentication Service
integration (see [README § Security](../README.md#security)). Authentication fails **closed**.

| Route                                                                                | Permission             |
| ------------------------------------------------------------------------------------ | ---------------------- |
| `GET /health`, `/health/ready`, `/health/dependencies`                               | None (unauthenticated) |
| `GET /api/v1/reference-data/manifest`                                                | `reference-data.read`  |
| `GET .../vessels`, `.../gears`, `.../ports`, `.../species` (collection + item)       | `reference-data.read`  |
| `GET .../map/land`, `.../map/statistical-areas` (collection + item), `.../map/ports` | `reference-data.read`  |
| `PUT .../{dataset}` (validation-only or full replacement)                            | `reference-data.write` |

A missing/invalid/expired token returns `401 unauthorized`; a valid token lacking the required
permission returns `403 forbidden`; an unavailable Authentication Service returns
`503 authentication_service_unavailable`.

```text
Authorization: Bearer <token>
```

## Standard error envelope

Every error response (except a bodyless `304`) uses:

```json
{
  "error": {
    "code": "invalid_request",
    "message": "The request contains validation errors.",
    "traceId": "5b1e6e2a-6e77-4c1a-9b3a-2e6f9a7d9c11",
    "dataset": "vessels",
    "retryable": false,
    "details": [
      { "path": "limit", "message": "\"limit\" must be a positive number" }
    ]
  }
}
```

`dataset`, `retryable`, and `details` are omitted when not applicable. `traceId` echoes the
request's `x-cdp-request-id` correlation header. Stack traces, raw Joi/Boom internals, and raw AWS
SDK errors are never included (see [README § Security](../README.md#security)).

### Status code catalogue

| Status                       | Example `error.code`                                                                              | Meaning                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `400 Bad Request`            | `invalid_request`, `invalid_dataset`, `invalid_json`                                              | Malformed query/path/body input                                                                |
| `401 Unauthorized`           | `unauthorized`                                                                                    | Missing, invalid, or expired token                                                             |
| `403 Forbidden`              | `forbidden`                                                                                       | Authenticated but missing the required permission                                              |
| `404 Not Found`              | `reference_item_not_found`, `map_layer_not_found`, `route_not_found`                              | Unknown GUID or route                                                                          |
| `409 Conflict`               | `collection_version_exists`, `collection_modified`                                                | Duplicate version, or a stale `If-Match` / manifest race (this repository never returns `412`) |
| `413 Content Too Large`      | `payload_too_large`                                                                               | Upload exceeds `REFERENCE_DATA_MAX_UPLOAD_BYTES`                                               |
| `415 Unsupported Media Type` | `unsupported_media_type`                                                                          | Wrong file content type for the dataset's format                                               |
| `422 Unprocessable Entity`   | `schema_validation_failed`, `business_validation_failed`                                          | Structural or business validation failed                                                       |
| `500 Internal Server Error`  | `internal_error`                                                                                  | Unexpected failure (never exposes cause detail)                                                |
| `503 Service Unavailable`    | `authentication_service_unavailable`, `reference_store_unavailable`, `reference_data_unavailable` | A dependency is unavailable, or startup hydration has not yet produced valid active data       |

Example `404`:

```json
{
  "error": {
    "code": "reference_item_not_found",
    "message": "No vessels item was found for the supplied id.",
    "traceId": "5b1e6e2a-6e77-4c1a-9b3a-2e6f9a7d9c11",
    "dataset": "vessels",
    "retryable": false
  }
}
```

## Conditional requests and caching

Every read endpoint returns an `ETag` header and honours `If-None-Match`: a matching value
returns a bodyless `304 Not Modified` (still carrying `ETag` and `Cache-Control`). Read responses
use `Cache-Control: public, max-age=3600, stale-while-revalidate=86400`; administrative and error
responses use `Cache-Control: no-store`.

- The **manifest** ETag is derived only from the active `manifestId` + `version` — stable across
  every filtered (`?include=`) view.
- Each **collection/item** ETag is deterministic per `{collectionId, version}` (map/JSON alike) and,
  for JSON collection reads, also reflects the request's query parameters (so two different
  filtered views of the same active collection have different ETags).
- **`If-Match`** on the replacement `PUT` route is checked against the _active manifest entry's_
  deterministic `{collectionId, version}` ETag — **not** the per-request collection-read ETag.
  Compute it from a fresh `GET /manifest` response, not from a `GET` collection response.

## Manifest

```http
GET /api/v1/reference-data/manifest
GET /api/v1/reference-data/manifest?include=vessels,ports
```

Returns the active version, GUID, ETag, format, and public URL of every persisted dataset
(`vessels`, `gears`, `ports`, `species`, `map-land`, `map-statistical-areas`). `map-ports` is never
included (always derived, never independently persisted).

- `include` — optional, comma-separated, case-sensitive canonical dataset identifiers. An
  unsupported or empty value returns `400 invalid_request`.
- Returns `503 reference_data_unavailable` if startup hydration has not yet produced a valid active
  manifest.

Example response:

```json
{
  "manifestId": "00000000-0000-4000-8000-000000000001",
  "version": "2026-01-01T00:00:00Z",
  "datasets": [
    {
      "dataset": "vessels",
      "collectionId": "00000000-0000-4000-8000-000000000010",
      "version": "local-seed-1",
      "schemaVersion": "1.0",
      "format": "json",
      "itemCount": 3,
      "lastModified": "2026-01-01T00:00:00Z",
      "url": "/api/v1/reference-data/vessels"
    }
  ]
}
```

## Canonical and mobile views

Every dataset collection/item route accepts `?view=canonical` (default) or `?view=mobile`.

- **`canonical`** returns the complete, authoritative record (every legacy-aligned field, full
  GUID and business-identifier set).
- **`mobile`** returns a smaller projection generated from canonical data for the Catch Recording
  mobile app. GUIDs (`id`) and the dataset's primary business code are always preserved; internal-
  only fields (denormalised search text, lookup-index scaffolding) are always stripped. Mobile
  projections are never separately persisted — they are computed per request from the active
  canonical collection.
- An unsupported `view` value returns `400 invalid_request`.

| Dataset   | Mobile fields                                                                                                                                                                                                                                  |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vessels` | `id`, `name`, `pln`, `cfr`, `displayName`, `lengthOverallMetres`                                                                                                                                                                               |
| `gears`   | `id`, `code`, `name`, `category { id, code, name }`, `pairFishing`, `requiredMeasurementIds`, `variableMeasurementIds`, plus a collection-level `measurements` array and (when `vesselLengthMetres` was supplied) a `context.vesselLengthBand` |
| `ports`   | `id`, `code`, `name`, `displayName`, `coordinate`                                                                                                                                                                                              |
| `species` | `id`, `faoCode`, `scientificName`, `displayName` (resolved per [Species](#species) below)                                                                                                                                                      |

Example — vessel canonical vs mobile:

```json
// GET /api/v1/reference-data/vessels/00000000-0000-4000-8000-000000000011
{
  "id": "00000000-0000-4000-8000-000000000011",
  "name": "Example Vessel",
  "namePln": null,
  "identifiers": {
    "cfr": "GBR000A12345",
    "externalMark": "PZ1",
    "registrationNumber": "R12345"
  },
  "lengthOverallMetres": 9.5,
  "status": "active"
}
```

```json
// GET /api/v1/reference-data/vessels/00000000-0000-4000-8000-000000000011?view=mobile
{
  "id": "00000000-0000-4000-8000-000000000011",
  "name": "Example Vessel",
  "pln": "PZ1",
  "cfr": "GBR000A12345",
  "displayName": "Example Vessel PZ1",
  "lengthOverallMetres": 9.5
}
```

## Vessels

```http
GET /api/v1/reference-data/vessels
GET /api/v1/reference-data/vessels/{id}
```

| Query parameter                                            | Behaviour                                                              |
| ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| `query`                                                    | Free-text search across name, `namePln`, and every business identifier |
| `cfr`, `uvi`, `ircs`, `externalMark`, `registrationNumber` | Exact match, case-insensitive                                          |
| `mmsi`                                                     | Exact match, case-sensitive                                            |
| `ids`                                                      | Comma-separated list of GUIDs (max 50), deduplicated                   |
| `includeInactive`                                          | `true`/`false` (default `false`); "active" means `status === "active"` |
| `sort`                                                     | One of `name`, `namePln`, `cfr`, `externalMark`, `registrationNumber`, |
| `lengthOverallMetres`; prefix with `-` for descending      |
| `offset`, `limit`                                          | Pagination (default limit 50, max 500)                                 |
| `view`                                                     | `canonical` (default) / `mobile`                                       |

Unknown query parameters return `400 invalid_request`. Unknown `{id}` returns
`404 reference_item_not_found`.

## Gears

```http
GET /api/v1/reference-data/gears
GET /api/v1/reference-data/gears/{id}
```

| Query parameter                                                                                                              | Behaviour                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `query`                                                                                                                      | Free-text search across name, code, type, category name/code, and characteristic names/codes                                                                                                                                                                                           |
| `code`, `categoryCode`                                                                                                       | Exact match, case-insensitive                                                                                                                                                                                                                                                          |
| `categoryId`                                                                                                                 | Exact match, case-sensitive (GUID)                                                                                                                                                                                                                                                     |
| `pairFishing`                                                                                                                | `true`/`false`                                                                                                                                                                                                                                                                         |
| `vesselLengthMetres`                                                                                                         | A positive number giving mobile-view vessel-length context (bands: `under-10m` `<10`, `10-to-12m` `>=10 and <=12`, `over-12m` `>12`). Narrows which characteristics appear in the mobile `measurements`/`context.vesselLengthBand` output; it never removes a gear from the result set |
| `includeInactive`, `sort` (`name`, `code`, `type`, `categoryName`, `categoryCode`, `pairFishing`), `offset`, `limit`, `view` | As above                                                                                                                                                                                                                                                                               |

The canonical `fixed` characteristic field is preserved as-is; the mobile view's `required` vs
`variable` measurement-id split follows the documented mapping: `fixed && required` →
`requiredMeasurementIds`; anything else (including `fixed && !required`) → `variableMeasurementIds`.

## Ports

```http
GET /api/v1/reference-data/ports
GET /api/v1/reference-data/ports/{id}
```

| Query parameter                                                                      | Behaviour                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `query`                                                                              | Free-text search across name, code, country code                                                                                                                                             |
| `code`                                                                               | Exact match, **case-sensitive** (leading zeros/case never normalised)                                                                                                                        |
| `countryCode`                                                                        | Exact match, case-insensitive                                                                                                                                                                |
| `latitude`, `longitude`, `radiusKm`                                                  | Radius search — **all three or none**; `radiusKm` must be `>0` and `<=1000`; distance uses the Haversine great-circle formula, boundary is inclusive; ports with no `coordinate` never match |
| `includeInactive`, `sort` (`name`, `code`, `countryCode`), `offset`, `limit`, `view` | As above                                                                                                                                                                                     |

## Species

```http
GET /api/v1/reference-data/species
GET /api/v1/reference-data/species/{id}
```

| Query parameter                                                                    | Behaviour                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `query`                                                                            | Free-text search across FAO code, scientific name, all common names, all local names                                                                                                      |
| `faoCode`, `scientificName`                                                        | Exact match, case-insensitive                                                                                                                                                             |
| `countryCode`                                                                      | Exact match, case-insensitive; matches if **any** `commonNames[].countryCode` matches. Also supplies the "requested country" context used by mobile name resolution (below)               |
| `languageCode`                                                                     | Exact match, case-insensitive, **full tag only** (`en` does not match `en-GB`); matches if any `localNames[].languageCode` matches                                                        |
| `Accept-Language` header                                                           | First tag only (before any `;q=`), case-insensitive; supplies the "requested language" context for mobile name resolution. Absent header ⇒ no language context (never implicitly `en-GB`) |
| `includeInactive`, `sort` (`faoCode`, `scientificName`), `offset`, `limit`, `view` | As above                                                                                                                                                                                  |

Mobile `displayName` resolution order (first match wins):

1. Official local name matching the requested language (`Accept-Language`).
2. Common name matching the requested country (`countryCode`).
3. Official `en-GB` local name.
4. First available country common name.
5. Scientific name.
6. FAO code.

## Map land

```http
GET /api/v1/reference-data/map/land
```

Returns a GeoJSON `FeatureCollection` (`application/geo+json`, WGS84, longitude-first). No item
route exists (collection-only). No pagination (`offset`/`limit` are not accepted).

| Query parameter | Behaviour                                                                                                                                                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `query`         | Free-text search on feature `name` only (the only text property this dataset's schema defines)                                                                                                                                           |
| `bbox`          | `minLongitude,minLatitude,maxLongitude,maxLatitude`; true polygon/multi-polygon geometric intersection (not just an envelope check); antimeridian-crossing boxes (`minLongitude > maxLongitude`) are rejected with `400 invalid_request` |

## Map statistical areas

```http
GET /api/v1/reference-data/map/statistical-areas
GET /api/v1/reference-data/map/statistical-areas/{id}
```

GeoJSON `FeatureCollection`/`Feature` (`application/geo+json`). No pagination.

| Query parameter      | Behaviour                                                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `query`              | Free-text search across `name`, `code`, `areaType`, `parentCode`, `parentName`                                              |
| `code`, `parentCode` | Exact match, case-insensitive. `parentCode: null` never matches any filter value; there is no hierarchy expansion/recursion |
| `bbox`               | Same true-intersection/antimeridian-rejection rule as map land                                                              |

Item lookup is GUID-only (`{id}` is the feature's `id`, not its `code`).

## Map ports (derived)

```http
GET /api/v1/reference-data/map/ports
```

A derived GeoJSON `FeatureCollection` computed from the **active `ports` collection** — never
independently uploaded, persisted, or given its own manifest entry. Ports without a `coordinate`
are excluded from this layer but remain present in the canonical `ports` JSON collection.

| Query parameter                | Behaviour                                                                 |
| ------------------------------ | ------------------------------------------------------------------------- |
| `bbox`                         | Point-in-bounding-box check (ports are point geometry)                    |
| `code`, `countryCode`, `query` | Same semantics as the [Ports](#ports) JSON API, applied before projection |

## Validation-only upload

```http
PUT /api/v1/reference-data/{dataset}?validateOnly=true
Content-Type: multipart/form-data
Authorization: Bearer <token with reference-data.write>
```

- `{dataset}` — one of `vessels`, `gears`, `ports`, `species`, `map-land`,
  `map-statistical-areas`. `map-ports` is rejected (`400 invalid_dataset`) — it can never be
  uploaded.
- Multipart body: one `file` part (`application/json` or `application/geo+json` matching the
  dataset's format — a mismatch returns `415 unsupported_media_type`), plus optional text fields
  `schemaVersion`, `version`, `effectiveFrom`, `description` (cross-checked against the collection
  envelope; a mismatch returns `400 invalid_request`).
- Bounded by `REFERENCE_DATA_MAX_UPLOAD_BYTES` (25 MiB default) — exceeding it returns
  `413 payload_too_large` before the body is parsed.
- Runs the full structural → canonical normalisation → business validation pipeline and returns
  counts, `changed`, and `warnings` — **never persists, never updates the manifest, never replaces
  the in-memory active collection**.

Valid example response (`200`):

```json
{
  "dataset": "ports",
  "valid": true,
  "schemaVersion": "1.0",
  "version": "2026-02-01",
  "receivedItemCount": 42,
  "normalisedItemCount": 42,
  "changed": true,
  "warnings": []
}
```

Invalid example response (`422 business_validation_failed`):

```json
{
  "error": {
    "code": "business_validation_failed",
    "message": "The uploaded ports collection contains validation errors.",
    "traceId": "5b1e6e2a-6e77-4c1a-9b3a-2e6f9a7d9c11",
    "dataset": "ports",
    "retryable": false,
    "details": [
      {
        "code": "duplicate_business_code",
        "message": "Duplicate port code: GB007",
        "path": "items[3].code",
        "itemIndex": 3
      }
    ]
  }
}
```

## Atomic collection replacement

```http
PUT /api/v1/reference-data/{dataset}
Content-Type: multipart/form-data
Authorization: Bearer <token with reference-data.write>
If-Match: "<active manifest entry etag>"   (optional)
```

Runs the same validation/normalisation pipeline as the validation-only mode, then:

1. Writes a new, **immutable** versioned collection object (re-using the same `version` twice with
   different content is always rejected — `409 collection_version_exists`).
2. Conditionally activates the manifest (optimistic concurrency on the manifest's own ETag,
   independent of any client-supplied `If-Match`).
3. Atomically publishes the new collection into the in-memory active store.
4. Returns the new (and, on replacement, previous) collection metadata.

**Idempotency**: uploading the same `version` with the same content again succeeds with
`idempotent: true` and performs no new writes. The same `version` with _different_ content returns
`409 collection_version_exists`. A supplied `If-Match` that does not match the active manifest
entry's `{collectionId, version}` ETag returns `409 collection_modified`. A failed replacement
(validation failure, conflict, or persistence error) never modifies the active collection or
manifest — the previous version remains fully active. `map-ports` cannot be uploaded
(`400 invalid_dataset`), being always derived from `ports`.

**Multi-instance note**: this service holds active data as process-local memory (see
[README § In-Memory Data Store](../README.md#in-memory-data-store)). A successful replacement is
published immediately in the replying instance; other running instances pick it up on their own
next [cache-refresh cycle](../README.md#cache-refresh-module) (`REFERENCE_DATA_REFRESH_INTERVAL_MS`,
default 60s), not instantly.

Successful example response (`200`):

```json
{
  "dataset": "ports",
  "collectionId": "00000000-0000-4000-8000-000000000030",
  "schemaVersion": "1.0",
  "version": "2026-02-01",
  "status": "active",
  "itemCount": 42,
  "etag": "\"a3f5...\"",
  "checksum": "sha256-...",
  "sizeBytes": 18432,
  "manifest": {
    "manifestId": "00000000-0000-4000-8000-000000000001",
    "version": "2026-02-01T00:00:00Z"
  },
  "warnings": [],
  "previousCollection": {
    "version": "local-seed-1",
    "collectionId": "00000000-0000-4000-8000-000000000030"
  }
}
```

Stale-precondition example response (`409`):

```json
{
  "error": {
    "code": "collection_modified",
    "message": "The active collection changed after the upload was prepared.",
    "traceId": "5b1e6e2a-6e77-4c1a-9b3a-2e6f9a7d9c11",
    "dataset": "ports",
    "retryable": false,
    "details": [{ "code": "etag_mismatch", "providedEtag": "\"stale-etag\"" }]
  }
}
```
