import { describe, expect, test } from 'vitest'

import {
  registerDatasetNormaliser,
  resolveDatasetNormaliser
} from './dataset-normaliser-registry.js'

describe('#resolveDatasetNormaliser', () => {
  test('resolves a default identity normaliser for every uploadable dataset', () => {
    const result = resolveDatasetNormaliser('ports')({ items: [] })
    expect(result).toEqual({
      value: { items: [] },
      changed: false,
      warnings: []
    })
  })

  test('rejects an unsupported dataset', () => {
    expect(() => resolveDatasetNormaliser('not-a-real-dataset')).toThrow()
  })

  test('rejects map-ports as a derived, non-uploadable dataset', () => {
    expect(() => resolveDatasetNormaliser('map-ports')).toThrow(/derived/)
  })
})

describe('#registerDatasetNormaliser', () => {
  test('replaces the resolved normaliser for a dataset', () => {
    const customNormaliser = (collection) => ({
      value: collection,
      changed: false,
      warnings: [{ code: 'custom' }]
    })

    registerDatasetNormaliser('ports', customNormaliser)

    expect(resolveDatasetNormaliser('ports')).toBe(customNormaliser)
  })

  test('rejects registering a normaliser for a derived dataset', () => {
    expect(() => registerDatasetNormaliser('map-ports', () => {})).toThrow(
      /derived/
    )
  })
})
