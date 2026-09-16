import { DATASETS } from '#/common/domain/datasets.js'
import { registerDatasetBusinessValidator } from '../dataset-validator-registry.js'
import { validateVesselsCollection } from './vessels-validator.js'
import { validateGearsCollection } from './gears-validator.js'
import { validatePortsCollection } from './ports-validator.js'
import { validateSpeciesCollection } from './species-validator.js'
import { validateMapLandCollection } from './map-land-validator.js'
import { validateMapStatisticalAreasCollection } from './map-statistical-areas-validator.js'

// Side-effect module: replaces every Step 08 no-op placeholder with the real Step 09
// dataset-specific business validator. Imported once by validation/index.js.
registerDatasetBusinessValidator(DATASETS.VESSELS, validateVesselsCollection)
registerDatasetBusinessValidator(DATASETS.GEARS, validateGearsCollection)
registerDatasetBusinessValidator(DATASETS.PORTS, validatePortsCollection)
registerDatasetBusinessValidator(DATASETS.SPECIES, validateSpeciesCollection)
registerDatasetBusinessValidator(DATASETS.MAP_LAND, validateMapLandCollection)
registerDatasetBusinessValidator(
  DATASETS.MAP_STATISTICAL_AREAS,
  validateMapStatisticalAreasCollection
)
