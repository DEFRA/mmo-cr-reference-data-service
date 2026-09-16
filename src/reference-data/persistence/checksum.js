// Deterministic content checksums, kept conceptually separate from the S3 ETag.

import { createHash } from 'node:crypto'

export const CHECKSUM_ALGORITHM = 'sha256'

/**
 * @param {string} serialisedContent canonical JSON string
 */
export function calculateChecksum(serialisedContent) {
  return createHash(CHECKSUM_ALGORITHM)
    .update(serialisedContent)
    .digest('base64')
}

// S3 ETags are quoted; normalise for comparison/storage without assuming they are a content checksum.
export function normaliseEtag(etag) {
  if (typeof etag !== 'string') {
    return null
  }
  return etag.replaceAll('"', '')
}
