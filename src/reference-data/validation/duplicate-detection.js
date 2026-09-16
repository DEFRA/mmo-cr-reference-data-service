// Generic, linear-time duplicate detector reused by common envelope validation (GUIDs)
// and by dataset-specific business validators (business codes). Absent values (null,
// undefined, empty string) are never treated as duplicates of each other.
export function findDuplicates(entries, { caseInsensitive = false } = {}) {
  const groups = new Map()

  for (const entry of entries) {
    const { value } = entry
    if (value === null || value === undefined || value === '') {
      continue
    }

    const key =
      caseInsensitive && typeof value === 'string' ? value.toLowerCase() : value

    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key).push(entry)
  }

  const duplicates = []
  for (const group of groups.values()) {
    if (group.length > 1) {
      duplicates.push({ value: group[0].value, entries: group })
    }
  }

  return duplicates
}
