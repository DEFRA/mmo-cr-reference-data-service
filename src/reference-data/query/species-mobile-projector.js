// Step 19: mobile species projection. Pure; never mutates the canonical species.

import { resolveSpeciesDisplayName } from './species-name-resolver.js'

export function projectSpeciesToMobile(species, context = {}) {
  return {
    id: species.id,
    faoCode: species.faoCode,
    scientificName: species.scientificName,
    displayName: resolveSpeciesDisplayName(species, context)
  }
}
