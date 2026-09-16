# Step 15 — Completion Summary: Common Collection Query Engine

## Plan

[Step 15-implement-common-collection-query-engine-plan.md](./Step%2015-implement-common-collection-query-engine-plan.md)

## Delivered

- `query-configuration.js` — `createQueryConfiguration(...)`: validates and freezes a
  dataset query configuration (GUID accessor, exact filters, text-search fields, custom
  filters, sort fields/default sort, active-state accessor, mobile projector, pagination
  overrides). Rejects duplicate filter names and exact/custom filter param collisions at
  construction.
- `query-request-parser.js` — `parseCollectionQuery(rawQuery, config)`: strict parsing of
  `view`, `query`, `ids`, exact-filter params, custom-filter params, `includeInactive`,
  `sort` (`field`/`-field`), `offset`/`limit`. Rejects any unrecognised query parameter.
  Determines `isFullCollectionRequest` (true only when no non-`view` parameter is present).
- `collection-query-engine.js` — `runCollectionQuery(...)`: pure pipeline (active-state →
  ids → exact filters → custom filters → free text → sort → paginate), AND semantics
  throughout, never mutates its inputs, always appends a GUID tie-break to sorting.
- `collection-query-service.js` — `createCollectionQueryService({ store })` →
  `{ queryCollection, getItemById }`: the Query Module's shared use cases, reading one
  snapshot per call from the In-Memory Data Store, applying the engine and the optional
  mobile projector, and computing a deterministic per-request ETag.
- `query/index.js` updated to compose these into the production `query` singleton
  alongside the existing Step 14 manifest use case.

## Key decisions

- Reused `SERVICE_ERROR_CODES.INVALID_REQUEST` for every query-validation failure (no new
  error code), consistent with the Step 14 precedent.
- Free-text search: case-insensitive substring match. Multiple filters combine with AND.
- Unknown query parameters are rejected (400), not silently ignored.
- `ids`: silently de-duplicated; unknown ids silently produce fewer results (no error);
  bounded to 50 entries.
- Pagination: default limit 50, max limit 500 (rejected above, not clamped); default
  offset 0.
- "Full collection request" = raw query contains no recognised parameter other than
  `view`. Only then is pagination skipped entirely.

## Tests

97 new tests across configuration, parser, engine, service (unit + integration against a
real `createInMemoryDataStore()`). Full suite: 883 passed / 6 skipped, 0 regressions.

## Verification

```
npm run lint   # pass
npm test        # 883 passed, 6 skipped
```

## Deferred

All dataset-specific query configurations, projectors, and endpoints (Steps 16-20).
