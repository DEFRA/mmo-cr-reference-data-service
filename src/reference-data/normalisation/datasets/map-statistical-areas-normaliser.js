import { trimStringsDeep } from '../string-trim.js'
import { createNormalisationResult } from '../normalisation-result.js'

/**
 * Map-statistical-areas canonical normalisation. Whitespace trimming is the only
 * currently-applicable rule. Per docs/adr/0001-map-statistical-areas-raw-epsg3857-
 * contract.md, coordinates are the raw upstream EPSG:3857 (Web Mercator) metre
 * values served verbatim — no CRS conversion and no field renaming/inference are
 * performed here or anywhere else in the pipeline.
 */
export function normaliseMapStatisticalAreasCollection(collection) {
  const { value, changed, changes } = trimStringsDeep(collection)
  return createNormalisationResult({ value, changed, changes })
}
