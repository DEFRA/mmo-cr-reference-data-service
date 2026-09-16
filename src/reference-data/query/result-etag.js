// Shared deterministic ETag helper (extracted from collection-query-service.js, Step
// 18) so the dedicated map-ports query path can reuse the same, well-tested hashing
// approach without depending on the generic collection engine.

import { createHash } from 'node:crypto'

/**
 * @param {object} payload any JSON-serialisable, deterministically-ordered object
 *   (e.g. `{ collectionId, version, request }`) — never request time or a
 *   correlation id.
 */
export function calculateDeterministicEtag(payload) {
  const digest = createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('base64')
  return `"sha256-${digest}"`
}
