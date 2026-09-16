import { trimStringsDeep } from '../string-trim.js'
import { createNormalisationResult } from '../normalisation-result.js'

/**
 * Map-land canonical normalisation (Step 10). Whitespace trimming is the only
 * currently-applicable rule (feature `properties.name`). Coordinates must already
 * be strict numbers (Step 04 schema); no CRS conversion, simplification, or
 * topology repair is performed since no source CRS is ever supplied.
 */
export function normaliseMapLandCollection(collection) {
  const { value, changed, changes } = trimStringsDeep(collection)
  return createNormalisationResult({ value, changed, changes })
}
