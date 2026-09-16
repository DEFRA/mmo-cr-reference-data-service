const DEFAULT_LIMIT = 50
const MAX_LIMIT = 500
const DEFAULT_OFFSET = 0
const ERROR_CODE_INVALID_REQUEST = 'invalid_request'

function isValidInteger(value) {
  return Number.isInteger(value)
}

/**
 * Strictly parses shared `limit`/`offset` query conventions. Throws a plain
 * Error with `.code = 'invalid_request'` on any malformed value rather than
 * silently clamping — callers map this the same way as other domain errors.
 */
export function parsePagination(
  { limit, offset } = {},
  { defaultLimit = DEFAULT_LIMIT, maxLimit = MAX_LIMIT } = {}
) {
  const resolvedLimit = limit === undefined ? defaultLimit : limit
  const resolvedOffset = offset === undefined ? DEFAULT_OFFSET : offset

  if (
    !isValidInteger(resolvedLimit) ||
    resolvedLimit <= 0 ||
    resolvedLimit > maxLimit
  ) {
    const error = new Error(
      `limit must be an integer between 1 and ${maxLimit}.`
    )
    error.code = ERROR_CODE_INVALID_REQUEST
    throw error
  }

  if (!isValidInteger(resolvedOffset) || resolvedOffset < 0) {
    const error = new Error('offset must be a non-negative integer.')
    error.code = ERROR_CODE_INVALID_REQUEST
    throw error
  }

  return { limit: resolvedLimit, offset: resolvedOffset }
}
