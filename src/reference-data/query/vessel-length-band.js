// Step 17: resolves a numeric vessel length (metres) to the canonical Step 09
// vessel-length applicability band. No aliases; boundaries are inclusive per the
// owner-confirmed band definitions.

import { SERVICE_ERROR_CODES } from '#/common/domain/errors.js'
import { VESSEL_LENGTH_BAND } from '#/reference-data/validation/vessel-length-bands.js'

const UNDER_10_THRESHOLD = 10
const OVER_12_THRESHOLD = 12

function raiseInvalid(message) {
  const error = new Error(message)
  error.code = SERVICE_ERROR_CODES.INVALID_REQUEST
  error.retryable = false
  throw error
}

/**
 * @param {number} vesselLengthMetres a strict, finite, positive number
 * @returns {string} one of VESSEL_LENGTH_BAND
 */
export function resolveVesselLengthBand(vesselLengthMetres) {
  if (
    typeof vesselLengthMetres !== 'number' ||
    !Number.isFinite(vesselLengthMetres) ||
    vesselLengthMetres <= 0
  ) {
    raiseInvalid('vesselLengthMetres must be a finite positive number')
  }
  if (vesselLengthMetres < UNDER_10_THRESHOLD) {
    return VESSEL_LENGTH_BAND.UNDER_10M
  }
  if (vesselLengthMetres <= OVER_12_THRESHOLD) {
    return VESSEL_LENGTH_BAND.TEN_TO_TWELVE_M
  }
  return VESSEL_LENGTH_BAND.OVER_12M
}

/**
 * Parses the `vesselLengthMetres` query parameter into a strict finite number,
 * rejecting units, partial numerics, and non-numeric strings.
 */
export function parseVesselLengthMetres(rawValue) {
  if (typeof rawValue !== 'string' || !/^\d+(\.\d+)?$/.test(rawValue.trim())) {
    raiseInvalid('vesselLengthMetres must be a positive decimal number')
  }
  const value = Number(rawValue.trim())
  if (!Number.isFinite(value) || value <= 0) {
    raiseInvalid('vesselLengthMetres must be a finite positive number')
  }
  return value
}
