import { describe, expect, test } from 'vitest'

import {
  processDatasetCollection,
  PROCESSING_STAGE
} from './dataset-processing.js'
import validPortsCollection from '#/common/schemas/fixtures/valid/ports.json' with { type: 'json' }

describe('#processDatasetCollection', () => {
  test('accepts a structurally and business-valid collection', () => {
    const result = processDatasetCollection({
      dataset: 'ports',
      schemaVersion: '1.0',
      content: validPortsCollection
    })

    expect(result.ok).toBe(true)
    expect(result.collection.items[0].code).toBe('GBPLY')
    expect(result.warnings).toEqual([])
  })

  test('fails at the structural-validation stage for a structurally invalid collection', () => {
    const result = processDatasetCollection({
      dataset: 'ports',
      schemaVersion: '1.0',
      content: { dataset: 'ports' }
    })

    expect(result.ok).toBe(false)
    expect(result.stage).toBe(PROCESSING_STAGE.STRUCTURAL_VALIDATION)
  })

  test('fails at the business-validation stage for a duplicate business code', () => {
    const invalid = structuredClone(validPortsCollection)
    invalid.itemCount = 2
    invalid.items.push({ ...invalid.items[0] })

    const result = processDatasetCollection({
      dataset: 'ports',
      schemaVersion: '1.0',
      content: invalid
    })

    expect(result.ok).toBe(false)
    expect(result.stage).toBe(PROCESSING_STAGE.BUSINESS_VALIDATION)
  })

  test('surfaces normalisation warnings alongside a successful result', () => {
    const collection = structuredClone(validPortsCollection)
    collection.items[0].code = '  GBPLY  '

    const result = processDatasetCollection({
      dataset: 'ports',
      schemaVersion: '1.0',
      content: collection
    })

    expect(result.ok).toBe(true)
    expect(result.collection.items[0].code).toBe('GBPLY')
    expect(
      result.warnings.some((warning) => warning.code === 'whitespace_trimmed')
    ).toBe(true)
  })

  test('does not mutate the supplied content', () => {
    const before = structuredClone(validPortsCollection)
    processDatasetCollection({
      dataset: 'ports',
      schemaVersion: '1.0',
      content: validPortsCollection
    })
    expect(validPortsCollection).toEqual(before)
  })
})
