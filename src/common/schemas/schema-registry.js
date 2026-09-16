import { DATASETS, isPersistedDataset } from '#/common/domain/datasets.js'
import {
  isSupportedSchemaVersion,
  SCHEMA_VERSIONS
} from '#/common/schemas/schema-versions.js'
import { vesselsCollectionSchema } from '#/common/schemas/v1/vessels.js'
import { gearsCollectionSchema } from '#/common/schemas/v1/gears.js'
import { portsCollectionSchema } from '#/common/schemas/v1/ports.js'
import { speciesCollectionSchema } from '#/common/schemas/v1/species.js'
import { mapLandCollectionSchema } from '#/common/schemas/v1/map-land.js'
import { mapStatisticalAreasCollectionSchema } from '#/common/schemas/v1/map-statistical-areas.js'
import { manifestSchema } from '#/common/schemas/v1/manifest.js'

// map-ports is deliberately absent: it is derived and not an uploadable, persisted dataset.
const COLLECTION_SCHEMA_REGISTRY = Object.freeze({
  [SCHEMA_VERSIONS.V1]: Object.freeze({
    [DATASETS.VESSELS]: vesselsCollectionSchema,
    [DATASETS.GEARS]: gearsCollectionSchema,
    [DATASETS.PORTS]: portsCollectionSchema,
    [DATASETS.SPECIES]: speciesCollectionSchema,
    [DATASETS.MAP_LAND]: mapLandCollectionSchema,
    [DATASETS.MAP_STATISTICAL_AREAS]: mapStatisticalAreasCollectionSchema
  })
})

const MANIFEST_SCHEMA_REGISTRY = Object.freeze({
  [SCHEMA_VERSIONS.V1]: manifestSchema
})

export function getCollectionSchema(dataset, schemaVersion) {
  if (!isSupportedSchemaVersion(schemaVersion)) {
    throw new Error(`Unsupported schema version: ${schemaVersion}`)
  }

  if (!isPersistedDataset(dataset)) {
    throw new Error(
      `Dataset "${dataset}" is not an uploadable, persisted dataset`
    )
  }

  const schema = COLLECTION_SCHEMA_REGISTRY[schemaVersion][dataset]

  if (!schema) {
    throw new Error(
      `No schema registered for dataset "${dataset}" at schema version "${schemaVersion}"`
    )
  }

  return schema
}

export function getManifestSchema(schemaVersion) {
  if (!isSupportedSchemaVersion(schemaVersion)) {
    throw new Error(`Unsupported schema version: ${schemaVersion}`)
  }

  return MANIFEST_SCHEMA_REGISTRY[schemaVersion]
}
