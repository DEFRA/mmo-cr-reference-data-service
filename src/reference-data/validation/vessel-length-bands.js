// Owner-confirmed (2026-09-16) canonical vessel-length applicability bands. No aliases
// are accepted: under-10m (<10m), 10-to-12m (>=10 and <=12m), over-12m (>12m).
export const VESSEL_LENGTH_BAND = Object.freeze({
  UNDER_10M: 'under-10m',
  TEN_TO_TWELVE_M: '10-to-12m',
  OVER_12M: 'over-12m'
})

export const VESSEL_LENGTH_BANDS = Object.freeze(
  Object.values(VESSEL_LENGTH_BAND)
)

export function isSupportedVesselLengthBand(value) {
  return VESSEL_LENGTH_BANDS.includes(value)
}
