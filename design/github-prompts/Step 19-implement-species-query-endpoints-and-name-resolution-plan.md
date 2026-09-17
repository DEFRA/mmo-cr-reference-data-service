# Step 19 — Implementation Plan: Species Query Endpoints and Name Resolution

Treated as already approved per the owner's explicit decisions (2026-09-16), recorded
verbatim below. These decisions resolve every ambiguity previously identified and
raised for clarification; none are inferred from schema/duplicate-detection
conventions or other datasets.

## 1. Owner-approved decisions (authoritative for this step)

1. **General text search fields**: `query` searches FAO code, scientific name, every
   `commonNames[].name`, and every `localNames[].name` — using the unmodified Step 15
   free-text matching behaviour (case-insensitive substring). Never searches GUIDs,
   country codes alone, language codes alone, `official` booleans, or serialised
   objects.
2. **`faoCode` filter**: exact, case-insensitive match against canonical `faoCode`.
   Canonical value never mutated. Never accepted as the `{id}` route value.
3. **`scientificName` filter**: exact, case-insensitive match against canonical
   `scientificName`. Partial matching is only available via `query`. Canonical value
   never mutated.
4. **`countryCode` filter**: exact, case-insensitive match against at least one
   `commonNames[].countryCode` entry. No external country lookup. Canonical value
   never mutated.
5. **`languageCode` filter**: exact, case-insensitive match of the _complete_ tag
   against at least one `localNames[].languageCode` entry (no regional fallback:
   `en` does not match `en-GB`). Canonical value never mutated.
6. **Country context for mobile resolution**: `countryCode` is dual-purpose — the
   same parsed value is used both as the species filter and as Rule 2's requested-
   country context (via the existing Step 15 `customFilterValues` → projection-context
   merge already built for gears in Step 17 — no new plumbing required). Absent
   `countryCode` ⇒ no requested-country context ⇒ Rule 2 never matches. Never
   inferred from `Accept-Language`, authentication, IP, or deployment region.
7. **`Accept-Language` parsing**: first syntactically valid tag only (split on `,`,
   take the first entry, strip any `;q=...` suffix, trim, validate). Quality weights
   ignored for selection. No regional fallback. Absent header ⇒ no requested-language
   context (Rule 1 never matches; resolution continues). Header present but no valid
   tag ⇒ standard `invalid_request` (400). Comparison is case-insensitive against the
   complete tag. Raw header never logged or echoed in errors.
8. **Filter combination**: unmodified Step 15 AND semantics; no species-specific OR
   logic.
9. **Mobile name-resolution order** (locked, implemented exactly, no reordering):
   1. Official local name matching the requested language tag (case-insensitive).
   2. Common name matching the requested country code (case-insensitive).
   3. Official `en-GB` local name (case-insensitive tag comparison).
   4. First available country common name, in canonical source order.
   5. `scientificName`.
   6. `faoCode`.
10. **Tie-breaking**: canonical source-array order (no sorting, no mutation). The
    resolver is deterministic even against malformed canonical data (Step 09
    validation should prevent conflicts, but the resolver does not assume this).

## 2. Repository state discovered

- No Step 19 code exists yet (fresh implementation).
- Canonical species schema (Step 04, unchanged): `{ id, faoCode, scientificName,
commonNames: [{id, countryCode, name}], localNames: [{id, languageCode, name,
official}], active }`.
- Step 15's `createQueryConfiguration` already supports `exactFilters` (scalar,
  case-insensitive option), `customFilters` (arbitrary parse/predicate, used here for
  the two nested-array filters), `prepareRecords` (per-request enrichment, already
  used by gears for denormalised search text), and automatic merging of
  `customFilterValues` into the mobile-projection context (`collection-query-service.js`
  `buildProjectionContext`) — all reused unmodified.
- `createCollectionRouteController`'s existing `getProjectionContext(request)` hook
  (already used generically) is reused to inject the parsed `Accept-Language` tag,
  which cannot come through a query-string custom filter since it is a header.

## 3. Design

### 3.1 `species-name-resolver.js`

`resolveSpeciesDisplayName(species, { requestedLanguageTag, countryCode } = {})` —
pure function implementing decisions 9-10 exactly. Case-insensitive comparisons only;
never mutates `species` or its nested arrays; never sorts.

### 3.2 `species-accept-language.js`

`parseAcceptLanguageTag(headerValue)` — implements decision 7. Returns `null` when
the header is absent; throws `invalid_request` when present with no valid tag.

### 3.3 `species-mobile-projector.js`

`projectSpeciesToMobile(species, context)` → `{ id, faoCode, scientificName,
displayName: resolveSpeciesDisplayName(species, context) }`.

### 3.4 `species-query-configuration.js`

- `prepareRecords`: denormalises `_commonNamesText`/`_localNamesText` (joined name
  strings) so `textSearchFields` can use plain accessors without embedding
  array-search logic in the shared engine (same established pattern as gears).
- `exactFilters`: `faoCode`, `scientificName` (both case-insensitive).
- `customFilters`: `countryCode`, `languageCode` (nested-array "at least one entry
  matches" predicates; each validates/trims/bounds its raw string the same way the
  shared exact-filter path already does, since custom filters own their own input
  validation).
- `textSearchFields`: faoCode, scientificName, denormalised common/local name text.
- `sortFields`: `faoCode`, `scientificName` (not an owner-flagged ambiguity; a minimal,
  low-risk addition required by the shared engine's sort allow-list mechanism,
  consistent with every other dataset step).
- `activeField`: `species.active`.
- `mobileProjector`: delegates to `projectSpeciesToMobile`.

### 3.5 `src/routes/species.js`

Built via the existing `createCollectionRouteController`, with
`getProjectionContext: (request) => ({ requestedLanguageTag:
parseAcceptLanguageTag(request.headers['accept-language']) })`. No other
species-specific controller code is required — the `countryCode` dual-use context
and canonical/mobile view selection are already handled by existing, unmodified
shared infrastructure.

## 4. Files created

- `src/reference-data/query/species-name-resolver.js` (+ test)
- `src/reference-data/query/species-accept-language.js` (+ test)
- `src/reference-data/query/species-mobile-projector.js` (+ test)
- `src/reference-data/query/species-query-configuration.js` (+ test)
- `src/routes/species.js` (+ test)

## 5. Files modified

- `src/plugins/router.js` — registers the species routes.

## 6. Explicitly not changed

Canonical schemas, Step 09 validation, Step 10 normalisation, the Step 15 query
engine/configuration/parser (no shared-file change is required — every mechanism
needed already exists from Steps 15/17), map-location endpoints (Step 20).

## 7. Test approach

Unit: name-resolver (all 6 rules + tie-breaking + immutability + malformed-data
determinism), Accept-Language parser (valid/invalid/absent/quality-weight-stripping/
case-insensitive comparison/no regional fallback), mobile projector, query
configuration (exact filters, nested-array custom filters, text search, sort,
active-state, mobile view with/without language+country context). Integration:
`species.test.js` following the `ports.test.js`/`gears.test.js` convention (stub auth

- real in-memory store + real query wiring through a real Hapi server), covering
  canonical/mobile views, every filter, every resolution rule via HTTP, GUID/404/400,
  401, ETag/304. Docker-free throughout.

## 8. Deferred

Map-location endpoints (Step 20).
