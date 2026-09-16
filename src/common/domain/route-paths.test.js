import { describe, expect, test } from 'vitest'

import { DATASETS } from './datasets.js'
import {
  API_BASE_PATH,
  DATASET_ROUTE_PATHS,
  MANIFEST_ROUTE_PATH,
  getDatasetRoutePath
} from './route-paths.js'

describe('#routePaths', () => {
  test('manifest route path uses the approved base path', () => {
    expect(MANIFEST_ROUTE_PATH).toBe(`${API_BASE_PATH}/manifest`)
  })

  test.each([
    [DATASETS.VESSELS, '/api/v1/reference-data/vessels'],
    [DATASETS.GEARS, '/api/v1/reference-data/gears'],
    [DATASETS.PORTS, '/api/v1/reference-data/ports'],
    [DATASETS.SPECIES, '/api/v1/reference-data/species'],
    [DATASETS.MAP_LAND, '/api/v1/reference-data/map/land'],
    [
      DATASETS.MAP_STATISTICAL_AREAS,
      '/api/v1/reference-data/map/statistical-areas'
    ],
    [DATASETS.MAP_PORTS, '/api/v1/reference-data/map/ports']
  ])('%s maps to %s', (dataset, expectedPath) => {
    expect(getDatasetRoutePath(dataset)).toBe(expectedPath)
    expect(DATASET_ROUTE_PATHS[dataset]).toBe(expectedPath)
  })

  test('throws for an unregistered dataset', () => {
    expect(() => getDatasetRoutePath('unknown-dataset')).toThrow(
      /No public route registered/
    )
  })

  test('never exposes S3 or Floci details in any route path', () => {
    const allPaths = Object.values(DATASET_ROUTE_PATHS)
    for (const path of allPaths) {
      expect(path).not.toMatch(/s3|floci|bucket|4566/i)
    }
  })
})
