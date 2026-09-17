// Step 18: radius/location-search parsing and the Haversine distance predicate used
// by the ports composite filter. Pure; never mutates the coordinates it is given.

import { SERVICE_ERROR_CODES } from '#/common/domain/errors.js'

const MIN_LATITUDE = -90
const MAX_LATITUDE = 90
const MIN_LONGITUDE = -180
const MAX_LONGITUDE = 180
const MAX_RADIUS_KM = 1000
const EARTH_RADIUS_KM = 6371
const DEGREES_PER_HALF_TURN = 180
const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/

function raiseInvalid(message) {
  const error = new Error(message)
  error.code = SERVICE_ERROR_CODES.INVALID_REQUEST
  error.retryable = false
  throw error
}

function parseStrictDecimal(rawValue, label) {
  if (typeof rawValue !== 'string' || !DECIMAL_PATTERN.test(rawValue.trim())) {
    raiseInvalid(`${label} must be a decimal number`)
  }
  const value = Number(rawValue.trim())
  if (!Number.isFinite(value)) {
    raiseInvalid(`${label} must be a finite number`)
  }
  return value
}

export function parseLatitude(rawValue) {
  const value = parseStrictDecimal(rawValue, 'latitude')
  if (value < MIN_LATITUDE || value > MAX_LATITUDE) {
    raiseInvalid(`latitude must be between ${MIN_LATITUDE} and ${MAX_LATITUDE}`)
  }
  return value
}

export function parseLongitude(rawValue) {
  const value = parseStrictDecimal(rawValue, 'longitude')
  if (value < MIN_LONGITUDE || value > MAX_LONGITUDE) {
    raiseInvalid(
      `longitude must be between ${MIN_LONGITUDE} and ${MAX_LONGITUDE}`
    )
  }
  return value
}

// No approved requirement defines zero-radius behaviour; rejecting it (rather than
// treating it as "same point only") is the smallest safe default, consistent with
// how limit=0 and vesselLengthMetres<=0 are already rejected elsewhere.
export function parseRadiusKm(rawValue) {
  const value = parseStrictDecimal(rawValue, 'radiusKm')
  if (value <= 0 || value > MAX_RADIUS_KM) {
    raiseInvalid(`radiusKm must be greater than 0 and at most ${MAX_RADIUS_KM}`)
  }
  return value
}

function toRadians(degrees) {
  return (degrees * Math.PI) / DEGREES_PER_HALF_TURN
}

/**
 * @param {{latitude:number, longitude:number}} a
 * @param {{latitude:number, longitude:number}} b
 * @returns {number} great-circle distance in kilometres
 */
export function calculateHaversineDistanceKm(a, b) {
  const deltaLatitude = toRadians(b.latitude - a.latitude)
  const deltaLongitude = toRadians(b.longitude - a.longitude)
  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) *
      Math.cos(toRadians(b.latitude)) *
      Math.sin(deltaLongitude / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(haversine)))
}

/**
 * @param {{latitude:number, longitude:number}|null|undefined} coordinate
 * @param {{latitude:number, longitude:number, radiusKm:number}} location
 * @returns {boolean} true when `coordinate` is within `radiusKm` (inclusive) of the
 *   requested location; false when `coordinate` is absent.
 */
export function matchesLocationSearch(coordinate, location) {
  if (!coordinate) {
    return false
  }
  return calculateHaversineDistanceKm(coordinate, location) <= location.radiusKm
}

/**
 * Builds one `{ latitude, longitude, radiusKm }` location-search object from a raw
 * query object. Intended as the `parse` function of a Step 15 composite filter.
 */
export function parseLocationSearch(rawQuery) {
  return {
    latitude: parseLatitude(rawQuery.latitude),
    longitude: parseLongitude(rawQuery.longitude),
    radiusKm: parseRadiusKm(rawQuery.radiusKm)
  }
}
