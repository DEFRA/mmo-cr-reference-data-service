import { describe, expect, test } from 'vitest'

import './register.js'
import '#/reference-data/validation/datasets/register.js'
import { normaliseCollection } from '../normalise-collection.js'
import { resolveDatasetBusinessValidator } from '#/reference-data/validation/dataset-validator-registry.js'
import { getCollectionSchema } from '#/common/schemas/schema-registry.js'
import { validateAgainstSchema } from '#/common/schemas/validate.js'
import validPortsCollection from '#/common/schemas/fixtures/valid/ports.json' with { type: 'json' }

describe('#normalisationPipelineIntegration', () => {
  test('a structurally valid collection normalises without error', () => {
    const { error } = validateAgainstSchema(
      getCollectionSchema('ports', '1.0'),
      validPortsCollection
    )
    expect(error).toBeUndefined()

    const result = normaliseCollection({
      dataset: 'ports',
      collection: validPortsCollection
    })

    expect(result.changed).toBe(false)
  })

  test('business validation still runs correctly against normalised output', () => {
    const normalised = normaliseCollection({
      dataset: 'ports',
      collection: validPortsCollection
    })

    const businessResult = resolveDatasetBusinessValidator('ports')(
      normalised.value
    )
    expect(businessResult.valid).toBe(true)
  })

  test('trimming never hides a genuine business-rule duplicate: only whitespace differed', () => {
    const collection = structuredClone(validPortsCollection)
    collection.items.push({
      ...structuredClone(collection.items[0]),
      id: '22222222-2222-4222-8222-222222222222',
      code: `  ${collection.items[0].code}  `
    })

    const normalised = normaliseCollection({ dataset: 'ports', collection })
    expect(normalised.changed).toBe(true)

    const businessResult = resolveDatasetBusinessValidator('ports')(
      normalised.value
    )
    expect(businessResult.valid).toBe(false)
    expect(
      businessResult.errors.some(
        (issue) => issue.code === 'duplicate_business_code'
      )
    ).toBe(true)
  })

  test('running normalisation twice is idempotent and never mutates the original input', () => {
    const collection = structuredClone(validPortsCollection)
    collection.items[0].code = '  GBPLY  '
    const before = structuredClone(collection)

    const first = normaliseCollection({ dataset: 'ports', collection })
    const second = normaliseCollection({
      dataset: 'ports',
      collection: first.value
    })

    expect(second.changed).toBe(false)
    expect(collection).toEqual(before)
  })
})
