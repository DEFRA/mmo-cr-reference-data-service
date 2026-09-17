// Step 19: exact, locked mobile species name-resolution order (owner-approved,
// 2026-09-16). Pure; never mutates the canonical species or its nested arrays; never
// sorts them — canonical source-array order is the deterministic tie-breaker.

const OFFICIAL_FALLBACK_LANGUAGE_TAG = 'en-gb'

function findOfficialLocalNameForTag(localNames, languageTag) {
  const target = languageTag.toLowerCase()
  return localNames.find(
    (localName) =>
      localName.official && localName.languageCode.toLowerCase() === target
  )
}

function findCommonNameForCountry(commonNames, countryCode) {
  const target = countryCode.toLowerCase()
  return commonNames.find(
    (commonName) => commonName.countryCode.toLowerCase() === target
  )
}

/**
 * @param {object} species canonical species record
 * @param {{requestedLanguageTag?: string|null, countryCode?: string|null}} [context]
 * @returns {string} the resolved display name (never null/empty)
 */
export function resolveSpeciesDisplayName(species, context = {}) {
  const { requestedLanguageTag, countryCode } = context

  // Rule 1: official local name matching the requested language tag.
  if (requestedLanguageTag) {
    const match = findOfficialLocalNameForTag(
      species.localNames,
      requestedLanguageTag
    )
    if (match) {
      return match.name
    }
  }

  // Rule 2: common name matching the requested country code.
  if (countryCode) {
    const match = findCommonNameForCountry(species.commonNames, countryCode)
    if (match) {
      return match.name
    }
  }

  // Rule 3: official en-GB local name.
  const officialEnGb = findOfficialLocalNameForTag(
    species.localNames,
    OFFICIAL_FALLBACK_LANGUAGE_TAG
  )
  if (officialEnGb) {
    return officialEnGb.name
  }

  // Rule 4: first available country common name, canonical source order.
  if (species.commonNames.length > 0) {
    return species.commonNames[0].name
  }

  // Rule 5: scientific name.
  if (species.scientificName) {
    return species.scientificName
  }

  // Rule 6: FAO code.
  return species.faoCode
}
