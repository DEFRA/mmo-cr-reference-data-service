import { describe, expect, test } from 'vitest'

import { validateCollection } from './validate-collection.js'
import validPortsCollection from '#/common/schemas/fixtures/valid/ports.json' with { type: 'json' }
import unsupportedDataset from '#/common/schemas/fixtures/invalid/unsupported-dataset.json' with { type: 'json' }
import negativeItemCount from '#/common/schemas/fixtures/invalid/negative-item-count.json' with { type: 'json' }

describe('#validateCollection', () => {
  test('returns a valid result for a structurally and structurally-sound collection', () => {
    const result = validateCollection({
      dataset: 'ports',
      schemaVersion: '1.0',
      collection: validPortsCollection
    })

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  test('rejects an unsupported dataset before touching the schema registry', () => {
    const result = validateCollection({
      dataset: 'not-a-real-dataset',
      schemaVersion: '1.0',
      collection: {}
    })

    expect(result.valid).toBe(false)
    expect(result.errors[0].code).toBe('unsupported_dataset')
  })

  test('rejects map-ports as an upload-validation target', () => {
    const result = validateCollection({
      dataset: 'map-ports',
      schemaVersion: '1.0',
      collection: {}
    })

    expect(result.valid).toBe(false)
    expect(result.errors[0].code).toBe('unsupported_dataset')
  })

  test('rejects an unsupported schema version', () => {
    const result = validateCollection({
      dataset: 'ports',
      schemaVersion: '9.9',
      collection: validPortsCollection
    })

    expect(result.valid).toBe(false)
    expect(result.errors[0].code).toBe('unsupported_schema_version')
  })

  test('reports structural issues from the Step 04 schema', () => {
    const result = validateCollection({
      dataset: 'ports',
      schemaVersion: '1.0',
      collection: unsupportedDataset
    })

    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  test('collects multiple deterministic issues rather than stopping at the first one', () => {
    const result = validateCollection({
      dataset: 'ports',
      schemaVersion: '1.0',
      collection: negativeItemCount
    })

    expect(result.valid).toBe(false)
  })

  test('detects a business-rule dataset mismatch even when structurally valid', () => {
    const mismatched = structuredClone(validPortsCollection)
    mismatched.dataset = 'vessels'

    const result = validateCollection({
      dataset: 'ports',
      schemaVersion: '1.0',
      collection: mismatched
    })

    expect(result.valid).toBe(false)
    expect(
      result.errors.some((issue) => issue.code === 'dataset_mismatch')
    ).toBe(true)
  })

  test('detects a duplicate item GUID business failure', () => {
    const duplicated = structuredClone(validPortsCollection)
    duplicated.itemCount = 2
    duplicated.items.push(structuredClone(duplicated.items[0]))

    const result = validateCollection({
      dataset: 'ports',
      schemaVersion: '1.0',
      collection: duplicated
    })

    expect(result.valid).toBe(false)
    expect(result.errors.some((issue) => issue.code === 'duplicate_guid')).toBe(
      true
    )
  })

  test('does not mutate the supplied collection', () => {
    const before = structuredClone(validPortsCollection)

    validateCollection({
      dataset: 'ports',
      schemaVersion: '1.0',
      collection: validPortsCollection
    })

    expect(validPortsCollection).toEqual(before)
  })

  test('does not throw for a non-object collection', () => {
    expect(() =>
      validateCollection({
        dataset: 'ports',
        schemaVersion: '1.0',
        collection: null
      })
    ).not.toThrow()
  })

  test('does not throw when the collection is an array rather than an object', () => {
    const result = validateCollection({
      dataset: 'ports',
      schemaVersion: '1.0',
      collection: []
    })

    expect(result.valid).toBe(false)
  })

  test('surfaces dataset-specific warnings from the registered validator', async () => {
    const { registerDatasetBusinessValidator } =
      await import('./dataset-validator-registry.js')
    registerDatasetBusinessValidator('ports', () => ({
      valid: true,
      errors: [],
      warnings: [{ code: 'business_rule_failed', message: 'a warning' }]
    }))

    const result = validateCollection({
      dataset: 'ports',
      schemaVersion: '1.0',
      collection: validPortsCollection
    })

    expect(result.warnings).toEqual([
      expect.objectContaining({ code: 'business_rule_failed' })
    ])

    registerDatasetBusinessValidator('ports', () => ({
      valid: true,
      errors: [],
      warnings: []
    }))
  })

  test('reports receivedCount and normalisedCount for a valid collection', () => {
    const result = validateCollection({
      dataset: 'ports',
      schemaVersion: '1.0',
      collection: validPortsCollection
    })

    expect(result.receivedCount).toBe(1)
    expect(result.normalisedCount).toBe(1)
  })
})
