import { NORMALISATION_WARNING_CODE } from './warning-codes.js'

// Bounds the number of warnings a single normalisation run can report; protects
// against a pathological collection producing an unbounded response.
export const MAX_NORMALISATION_WARNINGS = 200

function isSafeValue(value) {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
}

function toWarning({ path, originalValue, normalisedValue }) {
  return {
    code: NORMALISATION_WARNING_CODE.WHITESPACE_TRIMMED,
    message: `Trimmed leading/trailing whitespace at "${path}".`,
    path,
    ...(isSafeValue(originalValue) ? { originalValue } : {}),
    ...(isSafeValue(normalisedValue) ? { normalisedValue } : {})
  }
}

/**
 * Builds the framework-neutral { value, changed, warnings } normalisation result,
 * bounding and safely redacting the reported changes.
 */
export function createNormalisationResult({
  value,
  changed,
  changes,
  maxWarnings = MAX_NORMALISATION_WARNINGS
}) {
  const bounded = changes.slice(0, maxWarnings)
  const warnings = bounded.map(toWarning)

  if (changes.length > maxWarnings) {
    warnings.push({
      code: NORMALISATION_WARNING_CODE.NORMALISATION_WARNINGS_TRUNCATED,
      message: `Normalisation stopped collecting warnings after ${maxWarnings} entries.`
    })
  }

  return { value, changed, warnings }
}
