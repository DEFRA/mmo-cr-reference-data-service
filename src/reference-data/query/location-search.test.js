import { describe, expect, test } from 'vitest'

import {
  parseLatitude,
  parseLongitude,
  parseRadiusKm,
  calculateHaversineDistanceKm,
  matchesLocationSearch,
  parseLocationSearch
} from './location-search.js'

describe('#parseLatitude', () => {
  test('accepts a valid latitude', () => {
    expect(parseLatitude('50.37')).toBe(50.37)
  })
  test.each(['-91', '91', 'abc', '50km'])('rejects %s', (value) => {
    expect(() => parseLatitude(value)).toThrow()
  })
})

describe('#parseLongitude', () => {
  test('accepts a valid longitude', () => {
    expect(parseLongitude('-4.14')).toBe(-4.14)
  })
  test.each(['-181', '181', 'abc'])('rejects %s', (value) => {
    expect(() => parseLongitude(value)).toThrow()
  })
})

describe('#parseRadiusKm', () => {
  test('accepts a valid radius', () => {
    expect(parseRadiusKm('25')).toBe(25)
  })
  test('accepts the maximum radius of 1000', () => {
    expect(parseRadiusKm('1000')).toBe(1000)
  })
  test('rejects zero', () => {
    expect(() => parseRadiusKm('0')).toThrow(/greater than 0/)
  })
  test('rejects a negative radius', () => {
    expect(() => parseRadiusKm('-1')).toThrow()
  })
  test('rejects a radius above the maximum', () => {
    expect(() => parseRadiusKm('1000.1')).toThrow(/at most 1000/)
  })
  test('rejects a partial numeric value', () => {
    expect(() => parseRadiusKm('25km')).toThrow()
  })
})

describe('#calculateHaversineDistanceKm', () => {
  test('returns zero for the same point', () => {
    const point = { latitude: 50.37, longitude: -4.14 }
    expect(calculateHaversineDistanceKm(point, point)).toBeCloseTo(0, 6)
  })

  test('returns a plausible distance between two known points', () => {
    // Plymouth to Portsmouth, approximate great-circle distance ~180km.
    const plymouth = { latitude: 50.3755, longitude: -4.1427 }
    const portsmouth = { latitude: 50.8198, longitude: -1.0879 }
    const distance = calculateHaversineDistanceKm(plymouth, portsmouth)
    expect(distance).toBeGreaterThan(150)
    expect(distance).toBeLessThan(250)
  })

  test('does not mutate its inputs', () => {
    const a = { latitude: 50, longitude: -4 }
    const b = { latitude: 51, longitude: -3 }
    const cloneA = { ...a }
    const cloneB = { ...b }
    calculateHaversineDistanceKm(a, b)
    expect(a).toEqual(cloneA)
    expect(b).toEqual(cloneB)
  })
})

describe('#matchesLocationSearch', () => {
  const location = { latitude: 50.3661, longitude: -4.1427, radiusKm: 10 }

  test('returns false when the coordinate is absent', () => {
    expect(matchesLocationSearch(null, location)).toBe(false)
    expect(matchesLocationSearch(undefined, location)).toBe(false)
  })

  test('returns true for the exact same point (inclusive boundary)', () => {
    expect(
      matchesLocationSearch({ latitude: 50.3661, longitude: -4.1427 }, location)
    ).toBe(true)
  })

  test('returns false for a point well outside the radius', () => {
    expect(
      matchesLocationSearch({ latitude: 60, longitude: 0 }, location)
    ).toBe(false)
  })
})

describe('#parseLocationSearch', () => {
  test('builds one composite object from raw query values', () => {
    expect(
      parseLocationSearch({
        latitude: '50.37',
        longitude: '-4.14',
        radiusKm: '25'
      })
    ).toEqual({ latitude: 50.37, longitude: -4.14, radiusKm: 25 })
  })
})
