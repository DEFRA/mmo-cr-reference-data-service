// Reusable ETag / conditional-request helpers for future read/write routes.
// ETags are treated as opaque values; quoting is normalised but never reinterpreted.

function normaliseQuoted(value) {
  return value?.trim().replace(/^W\//, '')
}

function splitCommaSeparated(headerValue) {
  return headerValue
    .split(',')
    .map((value) => normaliseQuoted(value))
    .filter((value) => value.length > 0)
}

/**
 * Returns true when the supplied `If-None-Match` header value matches the
 * current resource ETag (wildcard `*` always matches). Malformed/absent
 * headers never match.
 */
export function matchesIfNoneMatch(etag, ifNoneMatchHeader) {
  if (!etag || !ifNoneMatchHeader) {
    return false
  }
  if (ifNoneMatchHeader.trim() === '*') {
    return true
  }
  return splitCommaSeparated(ifNoneMatchHeader).includes(normaliseQuoted(etag))
}

/**
 * Returns true when the supplied `If-Match` header value matches the current
 * resource ETag (wildcard `*` always matches an existing resource). A
 * missing/malformed header never matches — callers must decide whether a
 * missing header is required or optional for their route.
 */
export function matchesIfMatch(etag, ifMatchHeader) {
  return matchesIfNoneMatch(etag, ifMatchHeader)
}

export function parseIfMatchCandidates(ifMatchHeader) {
  if (!ifMatchHeader) {
    return []
  }
  return splitCommaSeparated(ifMatchHeader)
}
