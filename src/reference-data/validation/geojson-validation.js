import { VALIDATION_ISSUE_CODE } from './error-codes.js'

const MIN_LATITUDE = -90
const MAX_LATITUDE = 90
const MIN_LONGITUDE = -180
const MAX_LONGITUDE = 180

function isOutOfWgs84Range([longitude, latitude]) {
  return (
    longitude < MIN_LONGITUDE ||
    longitude > MAX_LONGITUDE ||
    latitude < MIN_LATITUDE ||
    latitude > MAX_LATITUDE
  )
}

function positionsEqual(a, b) {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

function validateRing(ring, path, itemIndex, issues, { checkWgs84Range }) {
  ring.forEach((position, positionIndex) => {
    if (checkWgs84Range && isOutOfWgs84Range(position)) {
      issues.push({
        code: VALIDATION_ISSUE_CODE.INVALID_COORDINATE,
        message: 'Coordinate is outside the WGS84 range.',
        path: `${path}[${positionIndex}]`,
        itemIndex
      })
    }
  })

  if (ring.length > 0 && !positionsEqual(ring[0], ring[ring.length - 1])) {
    issues.push({
      code: VALIDATION_ISSUE_CODE.OPEN_POLYGON_RING,
      message:
        'Polygon ring is not closed: the first and last positions must match.',
      path,
      itemIndex
    })
  }
}

function validatePolygonCoordinates(
  coordinates,
  path,
  itemIndex,
  issues,
  options
) {
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    issues.push({
      code: VALIDATION_ISSUE_CODE.EMPTY_GEOMETRY,
      message: 'Polygon geometry has no rings.',
      path,
      itemIndex
    })
    return
  }

  coordinates.forEach((ring, ringIndex) =>
    validateRing(ring, `${path}[${ringIndex}]`, itemIndex, issues, options)
  )
}

function validateMultiPolygonCoordinates(
  coordinates,
  path,
  itemIndex,
  issues,
  options
) {
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    issues.push({
      code: VALIDATION_ISSUE_CODE.EMPTY_GEOMETRY,
      message: 'MultiPolygon geometry has no polygons.',
      path,
      itemIndex
    })
    return
  }

  coordinates.forEach((polygonCoordinates, polygonIndex) =>
    validatePolygonCoordinates(
      polygonCoordinates,
      `${path}[${polygonIndex}]`,
      itemIndex,
      issues,
      options
    )
  )
}

function validateGeometry(geometry, path, itemIndex, issues, options) {
  if (!geometry) {
    return
  }

  if (geometry.type === 'Polygon') {
    validatePolygonCoordinates(
      geometry.coordinates,
      `${path}.coordinates`,
      itemIndex,
      issues,
      options
    )
  } else if (geometry.type === 'MultiPolygon') {
    validateMultiPolygonCoordinates(
      geometry.coordinates,
      `${path}.coordinates`,
      itemIndex,
      issues,
      options
    )
  } else {
    // Unreachable once structural validation has run: geometrySchema only permits
    // Polygon/MultiPolygon. No-op here rather than throwing, since this module must
    // stay usable independently of structural validation having already run.
  }
}

/**
 * Dataset-agnostic GeoJSON business-rule foundation: closed polygon rings and
 * non-empty geometry are always checked; the WGS84 coordinate-range check is
 * additionally applied unless `checkWgs84Range` is explicitly set to `false` — used
 * by map-statistical-areas (see
 * docs/adr/0001-map-statistical-areas-raw-epsg3857-contract.md), which serves raw
 * EPSG:3857 metre coordinates rather than WGS84 degrees. Every other GeoJSON dataset
 * (map-land, map-ports) keeps the default `true` and is unaffected. Reused by every
 * GeoJSON dataset's dataset-specific validator. Read-only: never repairs, closes, or
 * simplifies a geometry.
 */
export function validateFeatureCollectionGeometries(
  collection,
  { checkWgs84Range = true } = {}
) {
  const issues = []
  const features = Array.isArray(collection?.features)
    ? collection.features
    : []

  features.forEach((feature, itemIndex) => {
    validateGeometry(
      feature?.geometry,
      `features[${itemIndex}].geometry`,
      itemIndex,
      issues,
      { checkWgs84Range }
    )
  })

  return issues
}
