import { trimStringsDeep } from '../string-trim.js'
import { createNormalisationResult } from '../normalisation-result.js'

/**
 * Map-statistical-areas canonical normalisation (Step 10). Whitespace trimming is
 * the only currently-applicable rule. `parentCode` is preserved exactly as supplied
 * (no inference); coordinates must already be strict numbers (Step 04 schema), so
 * no CRS conversion is performed.
 */
export function normaliseMapStatisticalAreasCollection(collection) {
  const { value, changed, changes } = trimStringsDeep(collection)
  return createNormalisationResult({ value, changed, changes })
}
