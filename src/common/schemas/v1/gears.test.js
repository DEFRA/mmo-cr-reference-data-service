import { describe, expect, test } from 'vitest'

import {
  gearApplicableCharacteristicSchema,
  gearCategorySchema,
  gearCharacteristicSchema,
  gearItemSchema,
  gearsCollectionSchema
} from './gears.js'

const validCategory = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'TOWED',
  name: 'Towed gear'
}

const validCharacteristic = {
  id: '22222222-2222-4222-8222-222222222222',
  code: 'MESH_SIZE',
  name: 'Mesh size',
  dataType: 'number',
  unit: 'mm',
  minValue: 20,
  maxValue: 300
}

const validApplicability = {
  id: '33333333-3333-4333-8333-333333333333',
  characteristicId: validCharacteristic.id,
  fixed: true,
  required: false,
  vesselLengthApplicability: ['under-10m', '10-to-12m']
}

const validGearItem = {
  id: '44444444-4444-4444-8444-444444444444',
  code: 'OTB',
  name: 'Otter trawl',
  type: 'trawl',
  categoryId: validCategory.id,
  pairFishing: false,
  applicableCharacteristics: [validApplicability],
  active: true
}

describe('#gearCategorySchema / #gearCharacteristicSchema', () => {
  test('accepts a valid category', () => {
    expect(gearCategorySchema.validate(validCategory).error).toBeUndefined()
  })

  test('accepts a valid characteristic', () => {
    expect(
      gearCharacteristicSchema.validate(validCharacteristic).error
    ).toBeUndefined()
  })
})

describe('#gearApplicableCharacteristicSchema', () => {
  test('keeps fixed and required as separate booleans', () => {
    const { error, value } =
      gearApplicableCharacteristicSchema.validate(validApplicability)

    expect(error).toBeUndefined()
    expect(value.fixed).toBe(true)
    expect(value.required).toBe(false)
  })

  test('rejects an invalid applicability structure', () => {
    const { error } = gearApplicableCharacteristicSchema.validate({
      ...validApplicability,
      fixed: 'yes'
    })

    expect(error).toBeDefined()
  })
})

describe('#gearItemSchema', () => {
  test('accepts a valid gear item', () => {
    expect(gearItemSchema.validate(validGearItem).error).toBeUndefined()
  })
})

describe('#gearsCollectionSchema', () => {
  test('accepts a valid gears collection with categories, characteristics, and items', () => {
    const collection = {
      dataset: 'gears',
      collectionId: '0be553de-f430-49f7-b120-1e8e5ad972dc',
      schemaVersion: '1.0',
      version: '2026.09.11.1',
      generatedAt: '2026-09-11T08:30:00Z',
      itemCount: 1,
      categories: [validCategory],
      characteristics: [validCharacteristic],
      items: [validGearItem]
    }

    expect(gearsCollectionSchema.validate(collection).error).toBeUndefined()
  })
})
