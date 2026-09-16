const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

// Date-only values (no time component) are unambiguous, so they are anchored to UTC
// midnight for comparison purposes only — this never alters the value returned to a
// caller, it is used solely to compare two dates without depending on the server's
// local timezone.
function toComparableTimestamp(value) {
  return DATE_ONLY_PATTERN.test(value) ? `${value}T00:00:00.000Z` : value
}

/**
 * Returns whether an optional end date does not precede its start date. Malformed or
 * absent values are treated as "nothing to compare" — reporting malformed dates is the
 * responsibility of structural (schema) validation, not this business-rule utility.
 */
export function isValidDateOrder({ startValue, endValue }) {
  if (
    startValue === null ||
    startValue === undefined ||
    endValue === null ||
    endValue === undefined
  ) {
    return true
  }

  const start = new Date(toComparableTimestamp(startValue))
  const end = new Date(toComparableTimestamp(endValue))

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return true
  }

  return end.getTime() >= start.getTime()
}
