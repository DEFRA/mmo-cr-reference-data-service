import { describe, expect, test } from 'vitest'

import './register.js'
import { resolveDatasetNormaliser } from '../dataset-normaliser-registry.js'
import { DATASETS } from '#/common/domain/datasets.js'
import { normaliseVesselsCollection } from './vessels-normaliser.js'
import { normaliseGearsCollection } from './gears-normaliser.js'
import { normalisePortsCollection } from './ports-normaliser.js'
import { normaliseSpeciesCollection } from './species-normaliser.js'
import { normaliseMapLandCollection } from './map-land-normaliser.js'
import { normaliseMapStatisticalAreasCollection } from './map-statistical-areas-normaliser.js'

describe('#registerDatasetNormalisers', () => {
  test.each([
    [DATASETS.VESSELS, normaliseVesselsCollection],
    [DATASETS.GEARS, normaliseGearsCollection],
    [DATASETS.PORTS, normalisePortsCollection],
    [DATASETS.SPECIES, normaliseSpeciesCollection],
    [DATASETS.MAP_LAND, normaliseMapLandCollection],
    [DATASETS.MAP_STATISTICAL_AREAS, normaliseMapStatisticalAreasCollection]
  ])(
    '%s resolves to its real Step 10 normaliser, not the identity placeholder',
    (dataset, expected) => {
      expect(resolveDatasetNormaliser(dataset)).toBe(expected)
    }
  )

  test('map-ports still cannot resolve a normaliser (derived, non-uploadable)', () => {
    expect(() => resolveDatasetNormaliser(DATASETS.MAP_PORTS)).toThrow()
  })
})
