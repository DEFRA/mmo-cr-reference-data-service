// Query Module manifest retrieval use case (Step 14). Reads active state only
// through the injected In-Memory Data Store — never persistence, never the
// authentication client, never the Cache Refresh Module.

import { SERVICE_ERROR_CODES } from '#/common/domain/errors.js'
import { parseIncludeFilter } from './manifest-include-filter.js'
import { projectManifest } from './manifest-projection.js'

function raiseUnavailable() {
  const error = new Error(
    'Reference data is not yet available. Startup hydration may still be in progress.'
  )
  error.code = SERVICE_ERROR_CODES.REFERENCE_DATA_UNAVAILABLE
  error.retryable = true
  throw error
}

/**
 * Creates an isolated Query Module instance.
 * @param {{ store: import('#/common/contracts/in-memory-data-store.js').InMemoryDataStore }} deps
 */
export function createQueryService({ store }) {
  /**
   * @param {{ include?: string }} [request]
   * @returns {{ etag: string, body: object }}
   */
  function getManifest({ include } = {}) {
    const includeFilter = parseIncludeFilter(include)

    // A null manifest covers both "hydration not yet complete" and "no valid
    // manifest was ever successfully hydrated" — the In-Memory Data Store only
    // ever holds a manifest once the Cache Refresh Module has validated one.
    const manifest = store.getManifest()
    if (!manifest) {
      raiseUnavailable()
    }

    return projectManifest(manifest, { include: includeFilter })
  }

  return { getManifest }
}
