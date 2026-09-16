import { trimStringsDeep } from '../string-trim.js'
import { createNormalisationResult } from '../normalisation-result.js'

/**
 * Port canonical normalisation (Step 10). Whitespace trimming is the only
 * currently-applicable rule: `coordinate.latitude`/`longitude` must already be
 * strict numbers by the time a collection reaches normalisation (Step 04 schema),
 * so there is no legacy numeric-string coordinate format to convert, and no
 * coordinate inference, swapping, or clamping is performed.
 */
export function normalisePortsCollection(collection) {
  const { value, changed, changes } = trimStringsDeep(collection)
  return createNormalisationResult({ value, changed, changes })
}
