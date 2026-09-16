import { trimStringsDeep } from '../string-trim.js'
import { createNormalisationResult } from '../normalisation-result.js'

/**
 * Gear canonical normalisation (Step 10). Whitespace trimming is the only
 * currently-applicable rule: `minValue`/`maxValue` and boolean flags (`fixed`,
 * `required`, `pairFishing`) must already be strict, correctly-typed values by the
 * time a collection reaches normalisation (Step 04 schema), so there is no legacy
 * numeric-string/boolean-string format to convert.
 */
export function normaliseGearsCollection(collection) {
  const { value, changed, changes } = trimStringsDeep(collection)
  return createNormalisationResult({ value, changed, changes })
}
