import { describe, expect, test } from 'vitest'

import { buildGearLookupIndexes } from './gears-mobile-projector.js'
import {
  resolveStandardCategory,
  resolveStandardMeasurement,
  projectApplicableCharacteristicToStandard,
  projectGearToStandard
} from './gears-standard-projector.js'

const COLLECTION = {
  categories: [{ id: 'cat-1', code: 'TRAWL', name: 'Trawls' }],
  characteristics: [
    {
      id: 'char-1',
      code: 'MESH_SIZE',
      name: 'Mesh size',
      dataType: 'number',
      unit: 'mm',
      minValue: 1,
      maxValue: null
    }
  ]
}

const GEAR = {
  id: 'gear-1',
  code: 'TBB',
  name: 'Beam trawl',
  type: 'trawl',
  categoryId: 'cat-1',
  pairFishing: false,
  applicableCharacteristics: [
    {
      id: 'rel-1',
      characteristicId: 'char-1',
      fixed: true,
      required: true,
      vesselLengthApplicability: ['under-10m', '10-to-12m', 'over-12m']
    }
  ],
  active: true
}

describe('#resolveStandardCategory', () => {
  const { categoriesById } = buildGearLookupIndexes(COLLECTION)

  test('resolves id, code and name', () => {
    expect(resolveStandardCategory('cat-1', categoriesById)).toEqual({
      id: 'cat-1',
      code: 'TRAWL',
      name: 'Trawls'
    })
  })

  test('raises an internal error for an unresolved category id', () => {
    expect(() => resolveStandardCategory('missing', categoriesById)).toThrow(
      /does not resolve to a known category/
    )
  })
})

describe('#resolveStandardMeasurement', () => {
  const { characteristicsById } = buildGearLookupIndexes(COLLECTION)

  test('resolves id, code, name, unit, dataType and min/max', () => {
    expect(resolveStandardMeasurement('char-1', characteristicsById)).toEqual({
      id: 'char-1',
      code: 'MESH_SIZE',
      name: 'Mesh size',
      unit: 'mm',
      dataType: 'number',
      minValue: 1,
      maxValue: null
    })
  })

  test('raises an internal error for an unresolved characteristic id', () => {
    expect(() =>
      resolveStandardMeasurement('missing', characteristicsById)
    ).toThrow(/does not resolve to a known characteristic/)
  })
})

describe('#projectApplicableCharacteristicToStandard', () => {
  const { characteristicsById } = buildGearLookupIndexes(COLLECTION)

  test('preserves every existing field and adds measurement', () => {
    const entry = GEAR.applicableCharacteristics[0]
    const projected = projectApplicableCharacteristicToStandard(
      entry,
      characteristicsById
    )
    expect(projected).toEqual({
      ...entry,
      measurement: {
        id: 'char-1',
        code: 'MESH_SIZE',
        name: 'Mesh size',
        unit: 'mm',
        dataType: 'number',
        minValue: 1,
        maxValue: null
      }
    })
  })
})

describe('#projectGearToStandard', () => {
  const { categoriesById, characteristicsById } =
    buildGearLookupIndexes(COLLECTION)

  test('preserves every existing gear field and adds category', () => {
    const projected = projectGearToStandard(GEAR, {
      categoriesById,
      characteristicsById
    })
    expect(projected.category).toEqual({
      id: 'cat-1',
      code: 'TRAWL',
      name: 'Trawls'
    })
    expect(projected.categoryId).toBe('cat-1')
    expect(projected.id).toBe('gear-1')
    expect(projected.code).toBe('TBB')
  })

  test('embeds a resolved measurement per applicable characteristic while retaining fixed/required/vesselLengthApplicability', () => {
    const projected = projectGearToStandard(GEAR, {
      categoriesById,
      characteristicsById
    })
    expect(projected.applicableCharacteristics).toHaveLength(1)
    const [entry] = projected.applicableCharacteristics
    expect(entry.characteristicId).toBe('char-1')
    expect(entry.fixed).toBe(true)
    expect(entry.required).toBe(true)
    expect(entry.vesselLengthApplicability).toEqual([
      'under-10m',
      '10-to-12m',
      'over-12m'
    ])
    expect(entry.measurement.code).toBe('MESH_SIZE')
  })

  test('raises an internal error when categoryId is unresolved', () => {
    const unresolvedGear = { ...GEAR, categoryId: 'missing' }
    expect(() =>
      projectGearToStandard(unresolvedGear, {
        categoriesById,
        characteristicsById
      })
    ).toThrow(/does not resolve to a known category/)
  })

  test('raises an internal error when a characteristicId is unresolved', () => {
    const unresolvedGear = {
      ...GEAR,
      applicableCharacteristics: [
        { ...GEAR.applicableCharacteristics[0], characteristicId: 'missing' }
      ]
    }
    expect(() =>
      projectGearToStandard(unresolvedGear, {
        categoriesById,
        characteristicsById
      })
    ).toThrow(/does not resolve to a known characteristic/)
  })
})
