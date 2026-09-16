// Recursively trims leading/trailing whitespace from every string leaf value in a
// JSON-compatible structure. Immutable (always rebuilds arrays/objects) and
// idempotent (a second pass finds nothing left to trim). Numbers, booleans, null,
// and already-trimmed strings pass through unchanged.
export function trimStringsDeep(value, path = '') {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === value) {
      return { value, changed: false, changes: [] }
    }
    return {
      value: trimmed,
      changed: true,
      changes: [{ path, originalValue: value, normalisedValue: trimmed }]
    }
  }

  if (Array.isArray(value)) {
    const results = value.map((item, index) =>
      trimStringsDeep(item, `${path}[${index}]`)
    )
    return {
      value: results.map((result) => result.value),
      changed: results.some((result) => result.changed),
      changes: results.flatMap((result) => result.changes)
    }
  }

  if (value !== null && typeof value === 'object') {
    const results = Object.entries(value).map(([key, entryValue]) => [
      key,
      trimStringsDeep(entryValue, path ? `${path}.${key}` : key)
    ])
    return {
      value: Object.fromEntries(
        results.map(([key, result]) => [key, result.value])
      ),
      changed: results.some(([, result]) => result.changed),
      changes: results.flatMap(([, result]) => result.changes)
    }
  }

  return { value, changed: false, changes: [] }
}
