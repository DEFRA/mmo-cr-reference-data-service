import { trimStringsDeep } from '../string-trim.js'
import { createNormalisationResult } from '../normalisation-result.js'

/**
 * Vessel canonical normalisation (Step 10). Whitespace trimming is the only
 * currently-applicable rule: `lengthOverallMetres` and the active dates must already
 * be strict, correctly-typed values by the time a collection reaches normalisation
 * (Step 04 schema), so there is no legacy numeric-string/date format to convert.
 */
export function normaliseVesselsCollection(collection) {
  const { value, changed, changes } = trimStringsDeep(collection)
  return createNormalisationResult({ value, changed, changes })
}
