# 1. Serve map-statistical-areas as the raw EPSG:3857 ArcGIS export

Date: 2026-10-12

## Status

Accepted

## Context

The `map-statistical-areas` dataset (ICES statistical rectangles/subrectangles) is sourced from an
upstream ArcGIS/shapefile export. That export uses ArcGIS's own property names (`OBJECTID`, `ICESNAME`,
`sub_code`, `SOUTH`/`WEST`/`NORTH`/`EAST`, `AREA_KM2`, `stat_x`/`stat_y`, `sub_str`, `sub_x`/`sub_y`,
`Shape_Leng`, `Shape_Area`), `MultiPolygon` geometry projected in **EPSG:3857 (Web Mercator, metres)**,
**no per-feature `id`**, and a top-level GeoJSON `crs` member naming EPSG:3857.

The service's previous v1 schema for this dataset instead defined a transformed, canonical shape:
WGS84 (EPSG:4326) longitude/latitude degrees, a required GUID `Feature.id`/`properties.id`, and
business fields renamed to `code`/`name`/`areaType`/`parentCode`/`parentName`/`areaKm2`/`centroid`.
Producing that shape from the raw export requires reprojection (EPSG:3857 → EPSG:4326) and field
renaming/inference that the data owner has decided, as a deliberate product decision, **not to
perform** — maintaining a transformation step is judged to introduce drift risk and ongoing
maintenance cost disproportionate to the dataset's consumers' needs.

Constraints considered:

- **RFC 7946 (GeoJSON)** §4 specifies WGS84 as the only CRS for conformant GeoJSON and states that
  interchange GeoJSON text **SHOULD NOT** contain a `crs` member (removed from the 2008 draft).
  §6.1 ("Foreign Members") tolerates extra members; processors **MAY** ignore them. §3.2 states
  `Feature.id` is optional (SHOULD, not MUST) — an id-less feature is structurally legal GeoJSON.
- **EPSG:3857** (Web Mercator, metres) is not interchangeable with **EPSG:4326** (WGS84, degrees)
  without a reprojection step; a WGS84-degree bounding box cannot be applied to EPSG:3857 metre
  coordinates without that step.
- The service's own documented contract (`docs/api-reference.md`) and shared query engine assumed
  WGS84 degrees, a required GUID identifier, and a fixed `EPSG:4326` CRS label for every GeoJSON
  dataset.
- DEFRA Software Development Standards and this repository's API-contract-stability rule require
  published breaking changes to be recorded and versioned, and require a formal exception where a
  decision deviates from an otherwise-applicable standard (RFC 7946 WGS84-only convention, in this
  case), routed via the Delivery Architecture function.

Alternatives considered and rejected by the data owner:

- **Reproject to WGS84 and keep the canonical shape** — rejected: ongoing transformation/maintenance
  cost, and risk of subtle reprojection drift versus the upstream source of truth.
- **Dual-serve both shapes (e.g. a view parameter or a second endpoint)** — rejected: adds surface
  area and ambiguity for a single, intentionally simple reference dataset; out of scope for this
  change.

## Decision

Serve `map-statistical-areas` as the **raw upstream ArcGIS export, unchanged, end-to-end** — from the
committed seed file, through S3 persistence, canonical schema validation, normalisation, business
validation, querying, and the published API response.

Specifically:

- **Identifier:** the item identifier is the ArcGIS system-managed `properties.OBJECTID` (surfaced as
  a string via `getGuid`). `OBJECTID_1` is retained in the payload but is not the identifier.
- **Business uniqueness key:** `properties.sub_code` (unique per feature); `ICESNAME` is **not** the
  uniqueness key because it legitimately repeats across subrectangles of the same parent rectangle.
- **Geometry/CRS:** `MultiPolygon`, EPSG:3857 metres, coordinates and field names **unchanged** (no
  reprojection, no renaming). The collection envelope exposes `metadata.crs: "EPSG:3857"` and the
  stored/served collection also passes through the raw top-level GeoJSON `crs` member unchanged.
- **Filters:** exact filters on `sub_code` and `ICESNAME` (replacing `code`/`parentCode`, which have
  no analogue in the raw shape); free-text search on `ICESNAME` and `sub_code`.
- **`bbox` is removed** for this dataset: a WGS84-degree bounding box cannot be meaningfully applied
  to EPSG:3857 metre coordinates without reprojection, which this decision explicitly avoids. An
  unrecognised `bbox` query parameter now returns `400 invalid_request`.
- **Sort:** `OBJECTID` (default, ascending) and `sub_code`. Pagination stays off (unchanged).
- **`schemaVersion` stays at `1.0`** for this dataset — the breaking change is recorded via this ADR
  and the `docs/api-reference.md` breaking-change callout rather than by minting a new schema-version
  value, since the published route (`/api/v1`) and the schema-version registry are otherwise
  unaffected; this is a deliberate, scoped exception to a version-bump-per-breaking-change norm,
  accepted by the data owner for this single dataset.
- **No `/api/v2`** — only this dataset's shape changes; every other dataset's `/api/v1` contract is
  unaffected.
- **Schema strictness:** the raw ArcGIS property set is enumerated explicitly in the Joi schema;
  unrecognised/unknown properties are rejected (not tolerated via `.unknown(true)`), so upstream
  column drift fails validation loudly rather than being silently accepted.

This aligns with DEFRA precedence (DEFRA > GDS > community) by recording the breaking change formally
(this ADR + the API reference) rather than silently changing behaviour, and by scoping a deliberate,
documented governance exception for the RFC 7946 deviation rather than treating it as an oversight.

Shared code touched by this decision (`src/common/schemas/fragments/geojson.js`'s new
`createFeatureSchemaWithoutId` factory, the per-configuration `idSchema` seam in
`query-configuration.js`/`query-request-parser.js`, and the per-dataset `crs` config read by
`geojson-collection-route-controller.js`) is additive, with safe defaults preserving `map-land`'s and
`map-ports`'s existing WGS84/GUID/`EPSG:4326` behaviour unchanged.

## Consequences

### Positive

- Zero-transformation fidelity to the upstream source: no reprojection drift, no field-renaming
  inference to get wrong, simpler ingestion.
- The schema enumerates (rather than blanket-permits) the raw ArcGIS columns, so upstream column
  drift is caught at validation time instead of silently passing through.
- The shared query-engine/controller changes are additive and leave every other dataset's behaviour
  unchanged (regression-tested for `map-land`).

### Negative / Trade-offs

- **RFC 7946 non-conformance**: EPSG:3857 (not WGS84) coordinates plus a `crs` member plus id-less
  features. Mitigated by: this ADR recording the deviation as a deliberate, documented governance
  exception (to be confirmed with `delivery.architecture@defra.gov.uk` per DEFRA standards
  precedence); RFC 7946 §6.1 tolerates foreign members, so consumers that ignore unrecognised members
  remain unaffected; consumers that assume WGS84 degrees must be migrated (documented as a breaking
  change in `docs/api-reference.md`).
- **Loss of `bbox`, `code`, `parentCode` filtering** for this dataset only — accepted by the data
  owner; documented as a known limitation, not silently dropped.
- **Consumers must adopt EPSG:3857 and ArcGIS field names** — mitigated by the `docs/api-reference.md`
  breaking-change callout, since the `schemaVersion` is not bumped for this change.
- **The persistence manifest's `crs` projection** (`manifest-projection.js`) still unconditionally
  reports `EPSG:4326` for every GeoJSON dataset, including this one — out of scope for this change (no
  S3/manifest-mechanics changes were made), but is a known inconsistency between the manifest's
  advertised CRS and this dataset's actual collection CRS; tracked as deferred follow-up work.

### Compliance & Governance

- DEFRA standard(s) referenced: DEFRA Software Development Standards (API contract stability,
  versioning and recording of breaking changes); `.github/copilot-instructions.md` §3 working
  framework (ADR required before an architecture/query-pattern/API-contract change) and §API contract
  stability.
- Governance exception required: **yes** — this decision deviates from RFC 7946's WGS84-only CRS
  convention and from the service's own previously-documented WGS84 convention for GeoJSON datasets.
  This exception is recorded here and must be confirmed with the Delivery Architecture function
  (`delivery.architecture@defra.gov.uk`) per the DEFRA standards precedence in
  `.github/copilot-instructions.md`.
