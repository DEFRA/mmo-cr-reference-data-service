// Supported API response representations for reference-data resources.

export const REPRESENTATIONS = Object.freeze({
  CANONICAL: 'canonical',
  MOBILE: 'mobile'
})

export function isSupportedRepresentation(value) {
  return Object.values(REPRESENTATIONS).includes(value)
}
