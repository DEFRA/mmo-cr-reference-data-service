import { describe, expect, test } from 'vitest'

import { parseBoundingBox, isPointInBoundingBox } from './bounding-box.js'

describe('#parseBoundingBox', () => {
  test('parses a valid bounding box', () => {
    expect(parseBoundingBox('-6.0,49.5,2.0,56.0')).toEqual({
      minLongitude: -6,
      minLatitude: 49.5,
      maxLongitude: 2,
      maxLatitude: 56
    })
  })

  test('rejects a non-string value', () => {
    expect(() => parseBoundingBox(undefined)).toThrow(/non-empty string/)
  })

  test('rejects a whitespace-only value', () => {
    expect(() => parseBoundingBox('   ')).toThrow(/non-empty string/)
  })

  test('rejects fewer than four values', () => {
    expect(() => parseBoundingBox('-6,49.5,2')).toThrow(/exactly four/)
  })

  test('rejects more than four values', () => {
    expect(() => parseBoundingBox('-6,49.5,2,56,1')).toThrow(/exactly four/)
  })

  test('rejects empty values', () => {
    expect(() => parseBoundingBox('-6,,2,56')).toThrow(/exactly four/)
  })

  test('rejects non-numeric values', () => {
    expect(() => parseBoundingBox('a,49.5,2,56')).toThrow()
  })

  test('rejects partial numeric values', () => {
    expect(() => parseBoundingBox('-6km,49.5,2,56')).toThrow()
  })

  test('rejects longitude out of range', () => {
    expect(() => parseBoundingBox('-181,49.5,2,56')).toThrow(/longitude/i)
    expect(() => parseBoundingBox('-6,49.5,181,56')).toThrow(/longitude/i)
  })

  test('rejects latitude out of range', () => {
    expect(() => parseBoundingBox('-6,-91,2,56')).toThrow(/latitude/i)
    expect(() => parseBoundingBox('-6,49.5,2,91')).toThrow(/latitude/i)
  })

  test('rejects minLatitude greater than maxLatitude', () => {
    expect(() => parseBoundingBox('-6,56,2,49.5')).toThrow(
      /minLatitude must not exceed maxLatitude/
    )
  })

  test('rejects an antimeridian-crossing box', () => {
    expect(() => parseBoundingBox('170,-10,-170,10')).toThrow(/antimeridian/)
  })
})

describe('#isPointInBoundingBox', () => {
  const bbox = {
    minLongitude: -6,
    minLatitude: 49.5,
    maxLongitude: 2,
    maxLatitude: 56
  }

  test('returns true for a point inside the box', () => {
    expect(isPointInBoundingBox(-4.14, 50.37, bbox)).toBe(true)
  })

  test('returns true on each inclusive boundary', () => {
    expect(isPointInBoundingBox(-6, 49.5, bbox)).toBe(true)
    expect(isPointInBoundingBox(2, 56, bbox)).toBe(true)
  })

  test('returns false for a point outside the box', () => {
    expect(isPointInBoundingBox(10, 60, bbox)).toBe(false)
  })
})
