// Change-detection precedence: checksum, then ETag, then declared collection version,
// then last-modified timestamp as the final fallback. A dataset with no stored entry
// is always treated as changed (first hydration / newly added dataset).
export function hasManifestEntryChanged(candidateEntry, storedEntry) {
  if (!storedEntry) {
    return true
  }
  if (candidateEntry.checksum && storedEntry.checksum) {
    return candidateEntry.checksum !== storedEntry.checksum
  }
  if (candidateEntry.etag && storedEntry.etag) {
    return candidateEntry.etag !== storedEntry.etag
  }
  if (candidateEntry.version && storedEntry.version) {
    return candidateEntry.version !== storedEntry.version
  }
  return candidateEntry.lastModified !== storedEntry.lastModified
}
