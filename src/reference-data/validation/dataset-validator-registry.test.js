import { describe, expect, test } from 'vitest'

import { DATASETS } from '#/common/domain/datasets.js'
import {
  registerDatasetBusinessValidator,
  resolveDatasetBusinessValidator
} from './dataset-validator-registry.js'

describe('#resolveDatasetBusinessValidator', () => {
  test.each([
    DATASETS.VESSELS,
    DATASETS.GEARS,
    DATASETS.PORTS,
    DATASETS.SPECIES,
    DATASETS.MAP_LAND,
    DATASETS.MAP_STATISTICAL_AREAS
  ])('resolves a validator for every uploadable dataset: %s', (dataset) => {
    const validator = resolveDatasetBusinessValidator(dataset)
    expect(typeof validator).toBe('function')
  })

  test('throws for an unsupported dataset', () => {
    expect(() => resolveDatasetBusinessValidator('unknown-dataset')).toThrow(
      /unsupported dataset/i
    )
  })

  test('rejects map-ports as a non-uploadable, derived dataset', () => {
    expect(() => resolveDatasetBusinessValidator(DATASETS.MAP_PORTS)).toThrow(
      /derived/i
    )
  })

  test('a registered no-op placeholder returns a valid result with no issues', () => {
    const validator = resolveDatasetBusinessValidator(DATASETS.PORTS)
    expect(validator({}, {})).toEqual({ valid: true, errors: [], warnings: [] })
  })

  test('allows a dataset validator to be substituted for testing', () => {
    const testDouble = () => ({
      valid: false,
      errors: [{ code: 'business_rule_failed' }],
      warnings: []
    })

    registerDatasetBusinessValidator(DATASETS.PORTS, testDouble)

    expect(resolveDatasetBusinessValidator(DATASETS.PORTS)).toBe(testDouble)

    // restore the no-op placeholder so other tests are not affected
    registerDatasetBusinessValidator(DATASETS.PORTS, () => ({
      valid: true,
      errors: [],
      warnings: []
    }))
  })

  test('rejects registering a validator for a derived dataset', () => {
    expect(() =>
      registerDatasetBusinessValidator(DATASETS.MAP_PORTS, () => {})
    ).toThrow(/derived/i)
  })
})
