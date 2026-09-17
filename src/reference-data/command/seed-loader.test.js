import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

import {
  getSeedFilePath,
  loadSeedCollection,
  SEED_DATASET_ORDER,
  SEED_DIRECTORY_URL
} from './seed-loader.js'
import { DATASETS } from '#/common/domain/datasets.js'

describe('#SEED_DATASET_ORDER', () => {
  test('lists exactly the six maintained, uploadable datasets', () => {
    expect(SEED_DATASET_ORDER).toEqual([
      DATASETS.VESSELS,
      DATASETS.GEARS,
      DATASETS.PORTS,
      DATASETS.SPECIES,
      DATASETS.MAP_LAND,
      DATASETS.MAP_STATISTICAL_AREAS
    ])
  })

  test('never includes the derived map-ports dataset', () => {
    expect(SEED_DATASET_ORDER).not.toContain(DATASETS.MAP_PORTS)
  })
})

describe('#getSeedFilePath / #loadSeedCollection', () => {
  test.each(SEED_DATASET_ORDER)('a seed file exists for %s', (dataset) => {
    expect(existsSync(getSeedFilePath(dataset))).toBe(true)
  })

  test.each(SEED_DATASET_ORDER)('%s parses as JSON', (dataset) => {
    expect(() => loadSeedCollection(dataset)).not.toThrow()
  })

  test('throws for an unregistered dataset rather than guessing a path', () => {
    expect(() => getSeedFilePath('not-a-real-dataset')).toThrow(
      /No seed file is registered/
    )
  })

  test('no seed file exists for the derived map-ports dataset', () => {
    expect(
      existsSync(fileURLToPath(new URL('map-ports.json', SEED_DIRECTORY_URL)))
    ).toBe(false)
    expect(
      existsSync(
        fileURLToPath(new URL('map-ports.geojson', SEED_DIRECTORY_URL))
      )
    ).toBe(false)
  })
})
