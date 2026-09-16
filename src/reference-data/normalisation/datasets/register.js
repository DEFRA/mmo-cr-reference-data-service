import { DATASETS } from '#/common/domain/datasets.js'
import { registerDatasetNormaliser } from '../dataset-normaliser-registry.js'
import { normaliseVesselsCollection } from './vessels-normaliser.js'
import { normaliseGearsCollection } from './gears-normaliser.js'
import { normalisePortsCollection } from './ports-normaliser.js'
import { normaliseSpeciesCollection } from './species-normaliser.js'
import { normaliseMapLandCollection } from './map-land-normaliser.js'
import { normaliseMapStatisticalAreasCollection } from './map-statistical-areas-normaliser.js'

// Side-effect module: replaces every identity placeholder with the real Step 10
// dataset-specific normaliser. Imported once by normalisation/index.js.
registerDatasetNormaliser(DATASETS.VESSELS, normaliseVesselsCollection)
registerDatasetNormaliser(DATASETS.GEARS, normaliseGearsCollection)
registerDatasetNormaliser(DATASETS.PORTS, normalisePortsCollection)
registerDatasetNormaliser(DATASETS.SPECIES, normaliseSpeciesCollection)
registerDatasetNormaliser(DATASETS.MAP_LAND, normaliseMapLandCollection)
registerDatasetNormaliser(
  DATASETS.MAP_STATISTICAL_AREAS,
  normaliseMapStatisticalAreasCollection
)
