import { describe, expect, test } from 'vitest'

import './register.js'
import { resolveDatasetBusinessValidator } from '../dataset-validator-registry.js'
import { DATASETS } from '#/common/domain/datasets.js'
import { validateVesselsCollection } from './vessels-validator.js'
import { validateGearsCollection } from './gears-validator.js'
import { validatePortsCollection } from './ports-validator.js'
import { validateSpeciesCollection } from './species-validator.js'
import { validateMapLandCollection } from './map-land-validator.js'
import { validateMapStatisticalAreasCollection } from './map-statistical-areas-validator.js'

describe('#registerDatasetValidators', () => {
  test.each([
    [DATASETS.VESSELS, validateVesselsCollection],
    [DATASETS.GEARS, validateGearsCollection],
    [DATASETS.PORTS, validatePortsCollection],
    [DATASETS.SPECIES, validateSpeciesCollection],
    [DATASETS.MAP_LAND, validateMapLandCollection],
    [DATASETS.MAP_STATISTICAL_AREAS, validateMapStatisticalAreasCollection]
  ])(
    '%s resolves to its real Step 09 validator, not the Step 08 placeholder',
    (dataset, expected) => {
      expect(resolveDatasetBusinessValidator(dataset)).toBe(expected)
    }
  )

  test('map-ports still cannot resolve a business validator (derived, non-uploadable)', () => {
    expect(() => resolveDatasetBusinessValidator(DATASETS.MAP_PORTS)).toThrow()
  })
})
