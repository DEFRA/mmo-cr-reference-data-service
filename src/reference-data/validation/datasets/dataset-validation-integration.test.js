import { describe, expect, test } from 'vitest'

import './register.js'
import { validateCollection } from '../validate-collection.js'
import validVesselsCollection from '#/common/schemas/fixtures/valid/vessels.json' with { type: 'json' }
import validGearsCollection from '#/common/schemas/fixtures/valid/gears.json' with { type: 'json' }
import validPortsCollection from '#/common/schemas/fixtures/valid/ports.json' with { type: 'json' }
import validSpeciesCollection from '#/common/schemas/fixtures/valid/species.json' with { type: 'json' }
import validMapLandCollection from '#/common/schemas/fixtures/valid/map-land.json' with { type: 'json' }
import validMapStatisticalAreasCollection from '#/common/schemas/fixtures/valid/map-statistical-areas.json' with { type: 'json' }

const VALID_FIXTURES = [
  ['vessels', validVesselsCollection],
  ['gears', validGearsCollection],
  ['ports', validPortsCollection],
  ['species', validSpeciesCollection],
  ['map-land', validMapLandCollection],
  ['map-statistical-areas', validMapStatisticalAreasCollection]
]

describe('#datasetValidationIntegration', () => {
  test.each(VALID_FIXTURES)(
    '%s valid fixture passes the full structural + common + dataset-specific pipeline',
    (dataset, fixture) => {
      const result = validateCollection({
        dataset,
        schemaVersion: '1.0',
        collection: fixture
      })

      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    }
  )

  test('a gear unresolved category reference surfaces end-to-end', () => {
    const invalid = structuredClone(validGearsCollection)
    invalid.items[0].categoryId = '99999999-9999-4999-8999-999999999999'

    const result = validateCollection({
      dataset: 'gears',
      schemaVersion: '1.0',
      collection: invalid
    })

    expect(result.valid).toBe(false)
    expect(
      result.errors.some((issue) => issue.code === 'unresolved_reference')
    ).toBe(true)
  })

  test('a vessel with no natural identifier surfaces end-to-end', () => {
    const invalid = structuredClone(validVesselsCollection)
    invalid.items[0].identifiers = {
      cfr: null,
      uvi: null,
      mmsi: null,
      ircs: null,
      externalMark: null,
      registrationNumber: null
    }

    const result = validateCollection({
      dataset: 'vessels',
      schemaVersion: '1.0',
      collection: invalid
    })

    expect(result.valid).toBe(false)
    expect(
      result.errors.some((issue) => issue.code === 'missing_natural_identifier')
    ).toBe(true)
  })

  test('one dataset validator is never invoked for another dataset collection', () => {
    // A gears collection validated as "ports" fails structurally (dataset mismatch)
    // long before any gear-shaped data could reach the ports validator.
    const result = validateCollection({
      dataset: 'ports',
      schemaVersion: '1.0',
      collection: validGearsCollection
    })

    expect(result.valid).toBe(false)
    expect(
      result.errors.some((issue) => issue.code === 'dataset_mismatch')
    ).toBe(true)
  })

  test('does not mutate any of the supplied valid fixtures', () => {
    for (const [dataset, fixture] of VALID_FIXTURES) {
      const before = structuredClone(fixture)
      validateCollection({ dataset, schemaVersion: '1.0', collection: fixture })
      expect(fixture).toEqual(before)
    }
  })

  describe('rules already enforced structurally by Step 04 (no Step 09 duplication)', () => {
    test('a negative vessel length is rejected by the schema, not a Step 09 rule', () => {
      const invalid = structuredClone(validVesselsCollection)
      invalid.items[0].lengthOverallMetres = -1

      const result = validateCollection({
        dataset: 'vessels',
        schemaVersion: '1.0',
        collection: invalid
      })

      expect(result.valid).toBe(false)
    })

    test('a zero vessel length is rejected by the schema (positive() excludes zero)', () => {
      const invalid = structuredClone(validVesselsCollection)
      invalid.items[0].lengthOverallMetres = 0

      const result = validateCollection({
        dataset: 'vessels',
        schemaVersion: '1.0',
        collection: invalid
      })

      expect(result.valid).toBe(false)
    })

    test('a port with only a latitude (no longitude) is rejected by the schema', () => {
      const invalid = structuredClone(validPortsCollection)
      invalid.items[0].coordinate = { latitude: 50.3661 }

      const result = validateCollection({
        dataset: 'ports',
        schemaVersion: '1.0',
        collection: invalid
      })

      expect(result.valid).toBe(false)
    })

    test('an out-of-range port latitude is rejected by the schema', () => {
      const invalid = structuredClone(validPortsCollection)
      invalid.items[0].coordinate = { latitude: 200, longitude: -4.1427 }

      const result = validateCollection({
        dataset: 'ports',
        schemaVersion: '1.0',
        collection: invalid
      })

      expect(result.valid).toBe(false)
    })

    test('a statistical-area parentCode with no matching feature does not fail end-to-end', () => {
      const collection = structuredClone(validMapStatisticalAreasCollection)
      collection.features[0].properties.parentCode = 'no-such-area'

      const result = validateCollection({
        dataset: 'map-statistical-areas',
        schemaVersion: '1.0',
        collection
      })

      expect(result.valid).toBe(true)
    })
  })
})
