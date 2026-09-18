import { describe, expect, test } from 'vitest'

import {
  buildGearLookupIndexes,
  projectGearToMobile,
  projectMeasurement,
  collectPageMeasurements,
  stripInternalProjectionFields
} from './gears-mobile-projector.js'

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

describe('#projectGearToMobile', () => {
  const { categoriesById, characteristicsById } =
    buildGearLookupIndexes(COLLECTION)

  test('resolves the category', () => {
    const mobile = projectGearToMobile(GEAR, {
      categoriesById,
      characteristicsById
    })
    expect(mobile.category).toEqual({
      id: 'cat-1',
      code: 'TRAWL',
      name: 'Trawls'
    })
  })

  test('maps fixed+required to requiredMeasurementIds', () => {
    const mobile = projectGearToMobile(GEAR, {
      categoriesById,
      characteristicsById
    })
    expect(mobile.requiredMeasurementIds).toEqual(['char-1'])
    expect(mobile.variableMeasurementIds).toEqual([])
  })

  test('maps fixed=false to variableMeasurementIds', () => {
    const gear = {
      ...GEAR,
      applicableCharacteristics: [
        {
          id: 'rel-1',
          characteristicId: 'char-1',
          fixed: false,
          required: false,
          vesselLengthApplicability: ['under-10m']
        }
      ]
    }
    const mobile = projectGearToMobile(gear, {
      categoriesById,
      characteristicsById
    })
    expect(mobile.variableMeasurementIds).toEqual(['char-1'])
    expect(mobile.requiredMeasurementIds).toEqual([])
  })

  test('excludes characteristics not applicable to the selected band', () => {
    const gear = {
      ...GEAR,
      applicableCharacteristics: [
        {
          id: 'rel-1',
          characteristicId: 'char-1',
          fixed: true,
          required: true,
          vesselLengthApplicability: ['over-12m']
        }
      ]
    }
    const mobile = projectGearToMobile(gear, {
      categoriesById,
      characteristicsById,
      vesselLengthBand: 'under-10m'
    })
    expect(mobile.requiredMeasurementIds).toEqual([])
  })

  test('includes every applicable characteristic with no vessel length context', () => {
    const mobile = projectGearToMobile(GEAR, {
      categoriesById,
      characteristicsById
    })
    expect(mobile.requiredMeasurementIds).toEqual(['char-1'])
  })

  test('retains a gear with no applicable characteristics for the selected band', () => {
    const gear = {
      ...GEAR,
      applicableCharacteristics: [
        {
          id: 'rel-1',
          characteristicId: 'char-1',
          fixed: true,
          required: true,
          vesselLengthApplicability: ['over-12m']
        }
      ]
    }
    const mobile = projectGearToMobile(gear, {
      categoriesById,
      characteristicsById,
      vesselLengthBand: 'under-10m'
    })
    expect(mobile.id).toBe('gear-1')
    expect(mobile.requiredMeasurementIds).toEqual([])
    expect(mobile.variableMeasurementIds).toEqual([])
  })

  test('does not mutate the canonical gear', () => {
    const clone = JSON.parse(JSON.stringify(GEAR))
    projectGearToMobile(GEAR, { categoriesById, characteristicsById })
    expect(GEAR).toEqual(clone)
  })

  test('raises an internal error for a gear referencing an unresolved category', () => {
    const gear = { ...GEAR, categoryId: 'missing-category' }
    expect(() =>
      projectGearToMobile(gear, { categoriesById, characteristicsById })
    ).toThrow(/unresolved category/)
  })

  test('includes a characteristic with no declared vesselLengthApplicability regardless of band', () => {
    const gear = {
      ...GEAR,
      applicableCharacteristics: [
        { id: 'rel-1', characteristicId: 'char-1', fixed: true, required: true }
      ]
    }
    const mobile = projectGearToMobile(gear, {
      categoriesById,
      characteristicsById,
      vesselLengthBand: 'under-10m'
    })
    expect(mobile.requiredMeasurementIds).toEqual(['char-1'])
  })
})

describe('#projectMeasurement defaults', () => {
  test('defaults a missing unit/minimumValue/maximumValue to null', () => {
    const measurement = projectMeasurement({
      id: 'char-2',
      code: 'DEPTH',
      name: 'Depth',
      dataType: 'number'
    })
    expect(measurement).toEqual({
      id: 'char-2',
      code: 'DEPTH',
      label: 'Depth',
      kind: 'number',
      unit: null,
      minimumValue: null,
      maximumValue: null
    })
  })
})

describe('#collectPageMeasurements', () => {
  const { categoriesById, characteristicsById } =
    buildGearLookupIndexes(COLLECTION)

  test('de-duplicates measurements shared by multiple gears', () => {
    const mobile1 = projectGearToMobile(GEAR, {
      categoriesById,
      characteristicsById
    })
    const mobile2 = projectGearToMobile(
      { ...GEAR, id: 'gear-2' },
      { categoriesById, characteristicsById }
    )
    const measurements = collectPageMeasurements(
      [mobile1, mobile2],
      characteristicsById
    )
    expect(measurements).toHaveLength(1)
    expect(measurements[0].id).toBe('char-1')
  })

  test('skips a referenced characteristic id that cannot be resolved', () => {
    const mobile = projectGearToMobile(GEAR, {
      categoriesById,
      characteristicsById
    })
    const emptyCharacteristicsById = new Map()
    const measurements = collectPageMeasurements(
      [mobile],
      emptyCharacteristicsById
    )
    expect(measurements).toEqual([])
  })

  test('treats an item with no __referencedCharacteristicIds as contributing nothing', () => {
    const measurements = collectPageMeasurements(
      [{ id: 'gear-1' }],
      characteristicsById
    )
    expect(measurements).toEqual([])
  })
})

describe('#stripInternalProjectionFields', () => {
  test('removes the internal referenced-characteristics field', () => {
    const { categoriesById, characteristicsById } =
      buildGearLookupIndexes(COLLECTION)
    const mobile = projectGearToMobile(GEAR, {
      categoriesById,
      characteristicsById
    })
    const stripped = stripInternalProjectionFields(mobile)
    expect(stripped).not.toHaveProperty('__referencedCharacteristicIds')
  })
})
