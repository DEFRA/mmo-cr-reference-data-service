import { describe, expect, test } from 'vitest'

import { validateCollectionUpload } from './validate-collection-upload.js'
import { PROCESSING_STAGE } from '#/reference-data/cache-refresh/dataset-processing.js'
import validPortsCollection from '#/common/schemas/fixtures/valid/ports.json' with { type: 'json' }
import validVesselsCollection from '#/common/schemas/fixtures/valid/vessels.json' with { type: 'json' }
import validGearsCollection from '#/common/schemas/fixtures/valid/gears.json' with { type: 'json' }
import validSpeciesCollection from '#/common/schemas/fixtures/valid/species.json' with { type: 'json' }
import validMapLandCollection from '#/common/schemas/fixtures/valid/map-land.json' with { type: 'json' }
import validMapStatisticalAreasCollection from '#/common/schemas/fixtures/valid/map-statistical-areas.json' with { type: 'json' }

describe('#validateCollectionUpload', () => {
  test.each([
    ['vessels', validVesselsCollection],
    ['gears', validGearsCollection],
    ['ports', validPortsCollection],
    ['species', validSpeciesCollection],
    ['map-land', validMapLandCollection],
    ['map-statistical-areas', validMapStatisticalAreasCollection]
  ])('accepts a valid %s collection', (dataset, collection) => {
    const result = validateCollectionUpload({
      dataset,
      schemaVersion: '1.0',
      collection
    })

    expect(result.valid).toBe(true)
    expect(result.stage).toBeNull()
    expect(result.errors).toEqual([])
    expect(result.changed).toBe(false)
  })

  test('rejects the derived map-ports dataset', () => {
    const result = validateCollectionUpload({
      dataset: 'map-ports',
      schemaVersion: '1.0',
      collection: {}
    })

    expect(result.valid).toBe(false)
    expect(result.stage).toBe(PROCESSING_STAGE.STRUCTURAL_VALIDATION)
    expect(result.errors[0].code).toBe('unsupported_dataset')
  })

  test('rejects an unsupported dataset', () => {
    const result = validateCollectionUpload({
      dataset: 'not-a-real-dataset',
      schemaVersion: '1.0',
      collection: {}
    })

    expect(result.valid).toBe(false)
    expect(result.errors[0].code).toBe('unsupported_dataset')
  })

  test('rejects an unsupported schema version', () => {
    const result = validateCollectionUpload({
      dataset: 'ports',
      schemaVersion: '9.9',
      collection: validPortsCollection
    })

    expect(result.valid).toBe(false)
    expect(result.errors[0].code).toBe('unsupported_schema_version')
  })

  test('fails at the structural stage for a structurally invalid collection', () => {
    const result = validateCollectionUpload({
      dataset: 'ports',
      schemaVersion: '1.0',
      collection: { dataset: 'ports' }
    })

    expect(result.valid).toBe(false)
    expect(result.stage).toBe(PROCESSING_STAGE.STRUCTURAL_VALIDATION)
  })

  test('fails at the business stage for a duplicate item GUID', () => {
    const duplicated = structuredClone(validPortsCollection)
    duplicated.itemCount = 2
    duplicated.items.push(structuredClone(duplicated.items[0]))

    const result = validateCollectionUpload({
      dataset: 'ports',
      schemaVersion: '1.0',
      collection: duplicated
    })

    expect(result.valid).toBe(false)
    expect(result.stage).toBe(PROCESSING_STAGE.BUSINESS_VALIDATION)
    expect(result.errors.some((issue) => issue.code === 'duplicate_guid')).toBe(
      true
    )
  })

  test('surfaces normalisation warnings alongside a successful result', () => {
    const collection = structuredClone(validPortsCollection)
    collection.items[0].code = '  GBPLY  '

    const result = validateCollectionUpload({
      dataset: 'ports',
      schemaVersion: '1.0',
      collection
    })

    expect(result.valid).toBe(true)
    expect(result.changed).toBe(true)
    expect(
      result.warnings.some((warning) => warning.code === 'whitespace_trimmed')
    ).toBe(true)
  })

  test('reports received and normalised item counts', () => {
    const result = validateCollectionUpload({
      dataset: 'ports',
      schemaVersion: '1.0',
      collection: validPortsCollection
    })

    expect(result.receivedCount).toBe(1)
    expect(result.normalisedCount).toBe(1)
  })

  test('does not mutate the supplied collection', () => {
    const before = structuredClone(validPortsCollection)
    validateCollectionUpload({
      dataset: 'ports',
      schemaVersion: '1.0',
      collection: validPortsCollection
    })
    expect(validPortsCollection).toEqual(before)
  })

  test('does not return the complete normalised collection', () => {
    const result = validateCollectionUpload({
      dataset: 'ports',
      schemaVersion: '1.0',
      collection: validPortsCollection
    })

    expect(result.collection).toBeUndefined()
    expect(result.value).toBeUndefined()
  })
})
