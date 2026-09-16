import { describe, expect, test } from 'vitest'

import { projectVesselToMobile } from './vessels-mobile-projector.js'

const BASE_VESSEL = {
  id: '73168db4-1996-46f8-91cb-2288fe2e689c',
  name: 'ACHILLES',
  namePln: null,
  identifiers: {
    cfr: 'GBR000A1234',
    uvi: null,
    mmsi: '232001234',
    ircs: 'MABC7',
    externalMark: 'PH1234',
    registrationNumber: 'PH1234'
  },
  typeCode: 'FISHING',
  registrationCountryCode: 'GBR',
  lengthOverallMetres: 8.74,
  status: 'active',
  activeFrom: '2015-03-17',
  activeTo: null
}

describe('#projectVesselToMobile', () => {
  test('preserves GUID, CFR, and length', () => {
    const mobile = projectVesselToMobile(BASE_VESSEL)
    expect(mobile.id).toBe(BASE_VESSEL.id)
    expect(mobile.cfr).toBe('GBR000A1234')
    expect(mobile.lengthOverallMetres).toBe(8.74)
  })

  test('uses namePln for displayName when present', () => {
    const mobile = projectVesselToMobile({
      ...BASE_VESSEL,
      namePln: 'ACHILLES PH1234'
    })
    expect(mobile.displayName).toBe('ACHILLES PH1234')
  })

  test('falls back to name + pln when namePln absent', () => {
    const mobile = projectVesselToMobile(BASE_VESSEL)
    expect(mobile.displayName).toBe('ACHILLES PH1234')
  })

  test('falls back to name only when no pln is available', () => {
    const mobile = projectVesselToMobile({
      ...BASE_VESSEL,
      identifiers: {
        ...BASE_VESSEL.identifiers,
        externalMark: null,
        registrationNumber: null
      }
    })
    expect(mobile.displayName).toBe('ACHILLES')
    expect(mobile.pln).toBeNull()
  })

  test('uses externalMark as pln precedence over registrationNumber', () => {
    const mobile = projectVesselToMobile({
      ...BASE_VESSEL,
      identifiers: {
        ...BASE_VESSEL.identifiers,
        externalMark: 'EXT1',
        registrationNumber: 'REG1'
      }
    })
    expect(mobile.pln).toBe('EXT1')
  })

  test('falls back to registrationNumber when externalMark absent', () => {
    const mobile = projectVesselToMobile({
      ...BASE_VESSEL,
      identifiers: {
        ...BASE_VESSEL.identifiers,
        externalMark: null,
        registrationNumber: 'REG1'
      }
    })
    expect(mobile.pln).toBe('REG1')
  })

  test('cfr is null when absent', () => {
    const mobile = projectVesselToMobile({
      ...BASE_VESSEL,
      identifiers: { ...BASE_VESSEL.identifiers, cfr: null }
    })
    expect(mobile.cfr).toBeNull()
  })

  test('does not mutate the canonical vessel', () => {
    const clone = JSON.parse(JSON.stringify(BASE_VESSEL))
    projectVesselToMobile(BASE_VESSEL)
    expect(BASE_VESSEL).toEqual(clone)
  })

  test('does not include unapproved identifiers', () => {
    const mobile = projectVesselToMobile(BASE_VESSEL)
    expect(mobile).not.toHaveProperty('uvi')
    expect(mobile).not.toHaveProperty('mmsi')
    expect(mobile).not.toHaveProperty('ircs')
  })
})
