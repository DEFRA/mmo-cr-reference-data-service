import { describe, expect, test } from 'vitest'

import {
  DATASETS,
  DATASET_FORMAT,
  isSupportedDataset,
  getDatasetCapabilities,
  isUploadableDataset,
  isQueryableDataset,
  isPersistedDataset,
  isDerivedDataset
} from './datasets.js'

const ALL_DATASETS = Object.values(DATASETS)

describe('#isSupportedDataset', () => {
  test.each(ALL_DATASETS)('recognises %s as supported', (dataset) => {
    expect(isSupportedDataset(dataset)).toBe(true)
  })

  test('rejects an unknown dataset identifier', () => {
    expect(isSupportedDataset('unknown-dataset')).toBe(false)
  })
})

describe('#getDatasetCapabilities', () => {
  test('throws for an unsupported dataset', () => {
    expect(() => getDatasetCapabilities('unknown-dataset')).toThrow(
      /Unsupported dataset/
    )
  })
})

describe('#isUploadableDataset', () => {
  test.each([
    DATASETS.VESSELS,
    DATASETS.GEARS,
    DATASETS.PORTS,
    DATASETS.SPECIES,
    DATASETS.MAP_LAND,
    DATASETS.MAP_STATISTICAL_AREAS
  ])('%s is uploadable', (dataset) => {
    expect(isUploadableDataset(dataset)).toBe(true)
  })

  test('map-ports is not uploadable', () => {
    expect(isUploadableDataset(DATASETS.MAP_PORTS)).toBe(false)
  })
})

describe('#isQueryableDataset', () => {
  test.each(ALL_DATASETS)('%s is queryable', (dataset) => {
    expect(isQueryableDataset(dataset)).toBe(true)
  })
})

describe('#isPersistedDataset', () => {
  test.each([
    DATASETS.VESSELS,
    DATASETS.GEARS,
    DATASETS.PORTS,
    DATASETS.SPECIES,
    DATASETS.MAP_LAND,
    DATASETS.MAP_STATISTICAL_AREAS
  ])('%s is persisted', (dataset) => {
    expect(isPersistedDataset(dataset)).toBe(true)
  })

  test('map-ports is not independently persisted', () => {
    expect(isPersistedDataset(DATASETS.MAP_PORTS)).toBe(false)
  })
})

describe('#isDerivedDataset', () => {
  test.each([
    DATASETS.VESSELS,
    DATASETS.GEARS,
    DATASETS.PORTS,
    DATASETS.SPECIES,
    DATASETS.MAP_LAND,
    DATASETS.MAP_STATISTICAL_AREAS
  ])('%s is not derived', (dataset) => {
    expect(isDerivedDataset(dataset)).toBe(false)
  })

  test('map-ports is derived', () => {
    expect(isDerivedDataset(DATASETS.MAP_PORTS)).toBe(true)
  })
})

describe('#datasetFormat', () => {
  test.each([
    DATASETS.VESSELS,
    DATASETS.GEARS,
    DATASETS.PORTS,
    DATASETS.SPECIES
  ])('%s is JSON format', (dataset) => {
    expect(getDatasetCapabilities(dataset).format).toBe(DATASET_FORMAT.JSON)
  })

  test.each([
    DATASETS.MAP_LAND,
    DATASETS.MAP_STATISTICAL_AREAS,
    DATASETS.MAP_PORTS
  ])('%s is GeoJSON format', (dataset) => {
    expect(getDatasetCapabilities(dataset).format).toBe(DATASET_FORMAT.GEOJSON)
  })
})
