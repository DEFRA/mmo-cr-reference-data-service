import { trimStringsDeep } from '../string-trim.js'
import { createNormalisationResult } from '../normalisation-result.js'

/**
 * Species canonical normalisation (Step 10). Whitespace trimming is the only
 * currently-applicable rule. Names are never translated, flattened, or resolved to
 * a single display name here (that is Step 19's mobile projection concern), and no
 * official name is ever selected or removed.
 */
export function normaliseSpeciesCollection(collection) {
  const { value, changed, changes } = trimStringsDeep(collection)
  return createNormalisationResult({ value, changed, changes })
}
