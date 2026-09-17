import { describe, expect, test } from 'vitest'

import {
  resolveVesselLengthBand,
  parseVesselLengthMetres
} from './vessel-length-band.js'

describe('#resolveVesselLengthBand', () => {
  test('just below 10 is under-10m', () => {
    expect(resolveVesselLengthBand(9.99)).toBe('under-10m')
  })
  test('exactly 10 is 10-to-12m', () => {
    expect(resolveVesselLengthBand(10)).toBe('10-to-12m')
  })
  test('between 10 and 12 is 10-to-12m', () => {
    expect(resolveVesselLengthBand(11)).toBe('10-to-12m')
  })
  test('exactly 12 is 10-to-12m', () => {
    expect(resolveVesselLengthBand(12)).toBe('10-to-12m')
  })
  test('just above 12 is over-12m', () => {
    expect(resolveVesselLengthBand(12.01)).toBe('over-12m')
  })
  test('rejects zero', () => {
    expect(() => resolveVesselLengthBand(0)).toThrow()
  })
  test('rejects negative values', () => {
    expect(() => resolveVesselLengthBand(-1)).toThrow()
  })
  test('rejects non-numbers', () => {
    expect(() => resolveVesselLengthBand('10')).toThrow()
  })
  test('rejects NaN and Infinity', () => {
    expect(() => resolveVesselLengthBand(NaN)).toThrow()
    expect(() => resolveVesselLengthBand(Infinity)).toThrow()
  })
})

describe('#parseVesselLengthMetres', () => {
  test('parses a positive decimal', () => {
    expect(parseVesselLengthMetres('8.74')).toBe(8.74)
  })
  test('rejects a value containing units', () => {
    expect(() => parseVesselLengthMetres('8.74m')).toThrow()
  })
  test('rejects a negative value', () => {
    expect(() => parseVesselLengthMetres('-1')).toThrow()
  })
  test('rejects a non-numeric string', () => {
    expect(() => parseVesselLengthMetres('abc')).toThrow()
  })
})
