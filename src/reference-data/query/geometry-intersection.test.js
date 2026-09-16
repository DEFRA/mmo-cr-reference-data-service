import { describe, expect, test } from 'vitest'

import {
  segmentsIntersect,
  isPointOnRingBoundary,
  isPointInLinearRing,
  isPointInPolygonalSurface,
  polygonIntersectsBoundingBox,
  multiPolygonIntersectsBoundingBox,
  featureGeometryIntersectsBoundingBox
} from './geometry-intersection.js'

function bbox(minLongitude, minLatitude, maxLongitude, maxLatitude) {
  return { minLongitude, minLatitude, maxLongitude, maxLatitude }
}

// A closed 0..10 square ring (longitude, latitude).
const SQUARE_RING = [
  [0, 0],
  [0, 10],
  [10, 10],
  [10, 0],
  [0, 0]
]

// A closed 0..20 square with a 5..15 square hole (a "frame").
const FRAME_EXTERIOR = [
  [0, 0],
  [0, 20],
  [20, 20],
  [20, 0],
  [0, 0]
]
const FRAME_HOLE = [
  [5, 5],
  [5, 15],
  [15, 15],
  [15, 5],
  [5, 5]
]
const FRAME_POLYGON = [FRAME_EXTERIOR, FRAME_HOLE]

describe('#segmentsIntersect', () => {
  test('detects a proper crossing', () => {
    expect(segmentsIntersect([0, 0], [10, 10], [0, 10], [10, 0])).toBe(true)
  })

  test('detects boundary-only (collinear touching) contact', () => {
    expect(segmentsIntersect([0, 0], [10, 0], [5, 0], [15, 0])).toBe(true)
  })

  test('returns false for disjoint segments', () => {
    expect(segmentsIntersect([0, 0], [1, 1], [5, 5], [6, 6])).toBe(false)
  })
})

describe('#isPointOnRingBoundary / #isPointInLinearRing', () => {
  test('detects a point on the ring boundary', () => {
    expect(isPointOnRingBoundary([5, 0], SQUARE_RING)).toBe(true)
  })

  test('boundary-inclusive containment (on edge)', () => {
    expect(isPointInLinearRing([0, 5], SQUARE_RING)).toBe(true)
  })

  test('strictly-inside point is contained', () => {
    expect(isPointInLinearRing([5, 5], SQUARE_RING)).toBe(true)
  })

  test('outside point is not contained', () => {
    expect(isPointInLinearRing([50, 50], SQUARE_RING)).toBe(false)
  })

  test('throws for a degenerate ring with fewer than 4 positions', () => {
    expect(() =>
      isPointInLinearRing(
        [1, 1],
        [
          [0, 0],
          [1, 1]
        ]
      )
    ).toThrow()
  })
})

describe('#isPointInPolygonalSurface (holes)', () => {
  test('a point in the frame (outside the hole) is on the surface', () => {
    expect(isPointInPolygonalSurface([2, 2], FRAME_POLYGON)).toBe(true)
  })

  test('a point strictly inside the hole is not on the surface', () => {
    expect(isPointInPolygonalSurface([10, 10], FRAME_POLYGON)).toBe(false)
  })

  test('a point on the hole boundary is still on the surface', () => {
    expect(isPointInPolygonalSurface([5, 10], FRAME_POLYGON)).toBe(true)
  })
})

describe('#polygonIntersectsBoundingBox', () => {
  test('bounding box completely inside the polygon', () => {
    expect(polygonIntersectsBoundingBox([SQUARE_RING], bbox(2, 2, 8, 8))).toBe(
      true
    )
  })

  test('polygon completely inside the bounding box', () => {
    expect(
      polygonIntersectsBoundingBox([SQUARE_RING], bbox(-5, -5, 15, 15))
    ).toBe(true)
  })

  test('partial edge intersection', () => {
    expect(
      polygonIntersectsBoundingBox([SQUARE_RING], bbox(5, 5, 15, 15))
    ).toBe(true)
  })

  test('boundary-only contact', () => {
    expect(
      polygonIntersectsBoundingBox([SQUARE_RING], bbox(10, 0, 20, 10))
    ).toBe(true)
  })

  test('disjoint polygon', () => {
    expect(
      polygonIntersectsBoundingBox([SQUARE_RING], bbox(100, 100, 110, 110))
    ).toBe(false)
  })

  test('hole: bounding box entirely inside the hole does not intersect (envelope early-rejection must not produce a false negative here — the envelope DOES overlap, but the true result is still false)', () => {
    expect(
      polygonIntersectsBoundingBox(FRAME_POLYGON, bbox(7, 7, 13, 13))
    ).toBe(false)
  })

  test('hole: bounding box intersects the polygonal surface (partly in the frame)', () => {
    expect(polygonIntersectsBoundingBox(FRAME_POLYGON, bbox(3, 3, 8, 8))).toBe(
      true
    )
  })

  test('hole: a hole boundary intersects the bounding box', () => {
    expect(polygonIntersectsBoundingBox(FRAME_POLYGON, bbox(4, 7, 6, 9))).toBe(
      true
    )
  })

  test('does not mutate the coordinates or bbox input', () => {
    const coordinates = [SQUARE_RING.map((point) => [...point])]
    const box = bbox(2, 2, 8, 8)
    const cloneCoordinates = JSON.parse(JSON.stringify(coordinates))
    const cloneBox = { ...box }
    polygonIntersectsBoundingBox(coordinates, box)
    expect(coordinates).toEqual(cloneCoordinates)
    expect(box).toEqual(cloneBox)
  })

  test('throws for a malformed (empty) coordinates array', () => {
    expect(() => polygonIntersectsBoundingBox([], bbox(0, 0, 1, 1))).toThrow()
  })
})

describe('#multiPolygonIntersectsBoundingBox', () => {
  const farRing = [
    [100, 100],
    [100, 110],
    [110, 110],
    [110, 100],
    [100, 100]
  ]

  test('one intersecting polygon is sufficient', () => {
    expect(
      multiPolygonIntersectsBoundingBox(
        [[SQUARE_RING], [farRing]],
        bbox(2, 2, 8, 8)
      )
    ).toBe(true)
  })

  test('no intersecting polygons', () => {
    expect(
      multiPolygonIntersectsBoundingBox([[farRing]], bbox(2, 2, 8, 8))
    ).toBe(false)
  })

  test('throws for an empty MultiPolygon', () => {
    expect(() =>
      multiPolygonIntersectsBoundingBox([], bbox(0, 0, 1, 1))
    ).toThrow()
  })
})

describe('#featureGeometryIntersectsBoundingBox', () => {
  test('dispatches Polygon geometry', () => {
    expect(
      featureGeometryIntersectsBoundingBox(
        { type: 'Polygon', coordinates: [SQUARE_RING] },
        bbox(2, 2, 8, 8)
      )
    ).toBe(true)
  })

  test('dispatches MultiPolygon geometry', () => {
    expect(
      featureGeometryIntersectsBoundingBox(
        { type: 'MultiPolygon', coordinates: [[SQUARE_RING]] },
        bbox(2, 2, 8, 8)
      )
    ).toBe(true)
  })

  test('fails safely for an unsupported geometry type', () => {
    expect(() =>
      featureGeometryIntersectsBoundingBox(
        { type: 'Point', coordinates: [0, 0] },
        bbox(0, 0, 1, 1)
      )
    ).toThrow()
  })

  test('fails safely for missing geometry', () => {
    expect(() =>
      featureGeometryIntersectsBoundingBox(null, bbox(0, 0, 1, 1))
    ).toThrow()
  })

  test('malformed geometry errors use the shared internal_error code', () => {
    try {
      featureGeometryIntersectsBoundingBox(
        { type: 'Point', coordinates: [0, 0] },
        bbox(0, 0, 1, 1)
      )
      throw new Error('expected to throw')
    } catch (error) {
      expect(error.code).toBe('internal_error')
    }
  })
})
