// Generic intra-collection reference-resolution helper: builds an index once, then
// resolves many references in O(1) instead of repeatedly scanning the target array.
export function createReferenceIndex(items, keyFn) {
  const index = new Set()

  for (const item of items) {
    const key = keyFn(item)
    if (key !== null && key !== undefined) {
      index.add(key)
    }
  }

  return index
}

// Absent (null/undefined) references are treated as trivially resolved: whether a
// reference is required is a decision for the caller (dataset-specific business rules),
// not for this generic resolver.
export function referenceExists(index, value) {
  if (value === null || value === undefined) {
    return true
  }
  return index.has(value)
}
