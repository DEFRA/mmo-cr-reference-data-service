// Shared bounding-box parsing and point-containment utility (Step 18: map-ports;
// reused unmodified by Step 20 for map-land/map-statistical-areas). Antimeridian-
// crossing boxes are rejected for now (owner decision, 2026-09-16).

import { SERVICE_ERROR_CODES } from '#/common/domain/errors.js'

const MIN_LATITUDE = -90
const MAX_LATITUDE = 90
const MIN_LONGITUDE = -180
const MAX_LONGITUDE = 180
const BBOX_VALUE_COUNT = 4
const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/

function raiseInvalid(message) {
  const error = new Error(message)
  error.code = SERVICE_ERROR_CODES.INVALID_REQUEST
  error.retryable = false
  throw error
}

function parseStrictDecimal(rawValue, label) {
  if (!DECIMAL_PATTERN.test(rawValue.trim())) {
    raiseInvalid(`${label} must be a decimal number`)
  }
  const value = Number(rawValue.trim())
  if (!Number.isFinite(value)) {
    raiseInvalid(`${label} must be a finite number`)
  }
  return value
}

/**
 * @param {string} rawBbox `minLongitude,minLatitude,maxLongitude,maxLatitude`
 * @returns {{minLongitude:number, minLatitude:number, maxLongitude:number, maxLatitude:number}}
 */
export function parseBoundingBox(rawBbox) {
  if (typeof rawBbox !== 'string' || rawBbox.trim().length === 0) {
    raiseInvalid('bbox must be a non-empty string')
  }
  const parts = rawBbox.split(',').map((value) => value.trim())
  if (
    parts.length !== BBOX_VALUE_COUNT ||
    parts.some((part) => part.length === 0)
  ) {
    raiseInvalid('bbox must contain exactly four comma-separated values')
  }

  const [minLongitude, minLatitude, maxLongitude, maxLatitude] = [
    parseStrictDecimal(parts[0], 'bbox minLongitude'),
    parseStrictDecimal(parts[1], 'bbox minLatitude'),
    parseStrictDecimal(parts[2], 'bbox maxLongitude'),
    parseStrictDecimal(parts[3], 'bbox maxLatitude')
  ]

  for (const [label, value] of [
    ['minLongitude', minLongitude],
    ['maxLongitude', maxLongitude]
  ]) {
    if (value < MIN_LONGITUDE || value > MAX_LONGITUDE) {
      raiseInvalid(
        `bbox ${label} must be between ${MIN_LONGITUDE} and ${MAX_LONGITUDE}`
      )
    }
  }
  for (const [label, value] of [
    ['minLatitude', minLatitude],
    ['maxLatitude', maxLatitude]
  ]) {
    if (value < MIN_LATITUDE || value > MAX_LATITUDE) {
      raiseInvalid(
        `bbox ${label} must be between ${MIN_LATITUDE} and ${MAX_LATITUDE}`
      )
    }
  }
  if (minLatitude > maxLatitude) {
    raiseInvalid('bbox minLatitude must not exceed maxLatitude')
  }
  // Antimeridian-crossing boxes are explicitly rejected for now (owner decision).
  if (minLongitude > maxLongitude) {
    raiseInvalid('bbox must not cross the antimeridian')
  }

  return { minLongitude, minLatitude, maxLongitude, maxLatitude }
}

/**
 * Inclusive point-in-bounding-box containment test.
 */
export function isPointInBoundingBox(longitude, latitude, bbox) {
  return (
    longitude >= bbox.minLongitude &&
    longitude <= bbox.maxLongitude &&
    latitude >= bbox.minLatitude &&
    latitude <= bbox.maxLatitude
  )
}
