// Step 20: pure geometric intersection utilities (Polygon/MultiPolygon vs a
// bounding box). No dependency added — a bounded, focused implementation of the
// standard even-odd ray-casting and segment-orientation algorithms. Never mutates
// its inputs. Malformed geometry raises the shared internal-error model rather than
// silently excluding the feature (owner decision, 2026-09-16).

import { SERVICE_ERROR_CODES } from '#/common/domain/errors.js'
import { isPointInBoundingBox } from './bounding-box.js'

const EPSILON = 1e-9
const MIN_RING_POSITIONS = 4
const COLLINEAR = 0

function raiseMalformedGeometry(message) {
  const error = new Error(message)
  error.code = SERVICE_ERROR_CODES.INTERNAL_ERROR
  error.retryable = false
  throw error
}

function assertFinitePosition(position) {
  if (
    !Array.isArray(position) ||
    position.length < 2 ||
    !Number.isFinite(position[0]) ||
    !Number.isFinite(position[1])
  ) {
    raiseMalformedGeometry(
      'Malformed GeoJSON position encountered during a map query.'
    )
  }
}

function assertValidRing(ring) {
  if (!Array.isArray(ring) || ring.length < MIN_RING_POSITIONS) {
    raiseMalformedGeometry(
      'Malformed GeoJSON ring encountered during a map query.'
    )
  }
  ring.forEach(assertFinitePosition)
}

export function pointInOrOnBoundingBox(point, bbox) {
  return isPointInBoundingBox(point[0], point[1], bbox)
}

export function boundingBoxCorners(bbox) {
  return [
    [bbox.minLongitude, bbox.minLatitude],
    [bbox.maxLongitude, bbox.minLatitude],
    [bbox.maxLongitude, bbox.maxLatitude],
    [bbox.minLongitude, bbox.maxLatitude]
  ]
}

function orientation(p, q, r) {
  const value = (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1])
  if (Math.abs(value) < EPSILON) {
    return COLLINEAR
  }
  return value > 0 ? 1 : 2
}

function isWithinSegmentBounds(point, a, b) {
  return (
    point[0] >= Math.min(a[0], b[0]) - EPSILON &&
    point[0] <= Math.max(a[0], b[0]) + EPSILON &&
    point[1] >= Math.min(a[1], b[1]) - EPSILON &&
    point[1] <= Math.max(a[1], b[1]) + EPSILON
  )
}

/**
 * Robust segment-intersection test (orientation-based), including collinear
 * boundary-touch cases — boundary contact counts as intersection.
 */
export function segmentsIntersect(p1, p2, p3, p4) {
  const o1 = orientation(p1, p2, p3)
  const o2 = orientation(p1, p2, p4)
  const o3 = orientation(p3, p4, p1)
  const o4 = orientation(p3, p4, p2)

  if (o1 !== o2 && o3 !== o4) {
    return true
  }
  if (o1 === COLLINEAR && isWithinSegmentBounds(p3, p1, p2)) {
    return true
  }
  if (o2 === COLLINEAR && isWithinSegmentBounds(p4, p1, p2)) {
    return true
  }
  if (o3 === COLLINEAR && isWithinSegmentBounds(p1, p3, p4)) {
    return true
  }
  return o4 === COLLINEAR && isWithinSegmentBounds(p2, p3, p4)
}

export function isPointOnRingBoundary(point, ring) {
  for (let index = 0; index < ring.length - 1; index += 1) {
    const a = ring[index]
    const b = ring[index + 1]
    if (
      orientation(a, b, point) === COLLINEAR &&
      isWithinSegmentBounds(point, a, b)
    ) {
      return true
    }
  }
  return false
}

// Standard even-odd ray-casting test; boundary behaviour is intentionally
// unreliable at floating-point precision, which is why callers always combine this
// with the explicit isPointOnRingBoundary check.
function isPointStrictlyInsideRing(point, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 2; i < ring.length - 1; j = i, i += 1) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const crossesRay =
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi
    if (crossesRay) {
      inside = !inside
    }
  }
  return inside
}

export function isPointInLinearRing(point, ring) {
  assertValidRing(ring)
  return (
    isPointStrictlyInsideRing(point, ring) || isPointOnRingBoundary(point, ring)
  )
}

/**
 * @param {number[]} point [longitude, latitude]
 * @param {number[][][]} rings Polygon coordinates: [exteriorRing, ...holeRings]
 */
export function isPointInPolygonalSurface(point, rings) {
  const [exteriorRing, ...holes] = rings
  if (!isPointInLinearRing(point, exteriorRing)) {
    return false
  }
  const strictlyInsideAHole = holes.some(
    (hole) =>
      isPointStrictlyInsideRing(point, hole) &&
      !isPointOnRingBoundary(point, hole)
  )
  return !strictlyInsideAHole
}

function computeEnvelope(rings) {
  let minLongitude = Infinity
  let minLatitude = Infinity
  let maxLongitude = -Infinity
  let maxLatitude = -Infinity
  for (const ring of rings) {
    for (const [longitude, latitude] of ring) {
      minLongitude = Math.min(minLongitude, longitude)
      minLatitude = Math.min(minLatitude, latitude)
      maxLongitude = Math.max(maxLongitude, longitude)
      maxLatitude = Math.max(maxLatitude, latitude)
    }
  }
  return { minLongitude, minLatitude, maxLongitude, maxLatitude }
}

// A strict superset test: when the envelopes provably do not overlap, the actual
// shapes cannot intersect either — never a false negative.
function envelopesOverlap(a, b) {
  return (
    a.minLongitude <= b.maxLongitude &&
    a.maxLongitude >= b.minLongitude &&
    a.minLatitude <= b.maxLatitude &&
    a.maxLatitude >= b.minLatitude
  )
}

function ringSegments(ring) {
  const segments = []
  for (let index = 0; index < ring.length - 1; index += 1) {
    segments.push([ring[index], ring[index + 1]])
  }
  return segments
}

function anyRingIntersectsBoundingBoxEdges(ring, bboxRingSegments) {
  return ringSegments(ring).some(([a, b]) =>
    bboxRingSegments.some(([c, d]) => segmentsIntersect(a, b, c, d))
  )
}

/**
 * @param {number[][][]} coordinates Polygon coordinates: [exteriorRing, ...holes]
 * @param {{minLongitude:number,minLatitude:number,maxLongitude:number,maxLatitude:number}} bbox
 */
export function polygonIntersectsBoundingBox(coordinates, bbox) {
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    raiseMalformedGeometry(
      'Malformed Polygon geometry encountered during a map query.'
    )
  }
  coordinates.forEach(assertValidRing)

  const envelope = computeEnvelope(coordinates)
  if (!envelopesOverlap(envelope, bbox)) {
    return false
  }

  const anyVertexInBbox = coordinates.some((ring) =>
    ring.some((point) => pointInOrOnBoundingBox(point, bbox))
  )
  if (anyVertexInBbox) {
    return true
  }

  const anyCornerInSurface = boundingBoxCorners(bbox).some((corner) =>
    isPointInPolygonalSurface(corner, coordinates)
  )
  if (anyCornerInSurface) {
    return true
  }

  const corners = boundingBoxCorners(bbox)
  const bboxRingSegments = ringSegments([...corners, corners[0]])
  return coordinates.some((ring) =>
    anyRingIntersectsBoundingBoxEdges(ring, bboxRingSegments)
  )
}

/**
 * @param {number[][][][]} coordinates MultiPolygon coordinates
 */
export function multiPolygonIntersectsBoundingBox(coordinates, bbox) {
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    raiseMalformedGeometry(
      'Malformed MultiPolygon geometry encountered during a map query.'
    )
  }
  return coordinates.some((polygonCoordinates) =>
    polygonIntersectsBoundingBox(polygonCoordinates, bbox)
  )
}

/**
 * @param {{type:string, coordinates:*}} geometry
 * @param {{minLongitude:number,minLatitude:number,maxLongitude:number,maxLatitude:number}} bbox
 */
export function featureGeometryIntersectsBoundingBox(geometry, bbox) {
  if (!geometry || typeof geometry !== 'object') {
    raiseMalformedGeometry('Malformed geometry encountered during a map query.')
  }
  if (geometry.type === 'Polygon') {
    return polygonIntersectsBoundingBox(geometry.coordinates, bbox)
  }
  if (geometry.type === 'MultiPolygon') {
    return multiPolygonIntersectsBoundingBox(geometry.coordinates, bbox)
  }
  raiseMalformedGeometry(
    `Unsupported geometry type encountered during a map query: ${geometry.type}`
  )
}
