// Central registry of supported reference-data dataset identifiers and their capabilities.

export const DATASETS = Object.freeze({
  VESSELS: 'vessels',
  GEARS: 'gears',
  PORTS: 'ports',
  SPECIES: 'species',
  MAP_LAND: 'map-land',
  MAP_STATISTICAL_AREAS: 'map-statistical-areas',
  MAP_PORTS: 'map-ports'
})

export const DATASET_FORMAT = Object.freeze({
  JSON: 'json',
  GEOJSON: 'geojson'
})

/**
 * @typedef {Object} DatasetCapabilities
 * @property {boolean} queryable
 * @property {boolean} uploadable
 * @property {boolean} persisted
 * @property {boolean} derived
 * @property {string} format one of DATASET_FORMAT
 * @property {string} [sourceDataset] present only for derived datasets
 */

const DATASET_CAPABILITIES = Object.freeze({
  [DATASETS.VESSELS]: Object.freeze({
    queryable: true,
    uploadable: true,
    persisted: true,
    derived: false,
    format: DATASET_FORMAT.JSON
  }),
  [DATASETS.GEARS]: Object.freeze({
    queryable: true,
    uploadable: true,
    persisted: true,
    derived: false,
    format: DATASET_FORMAT.JSON
  }),
  [DATASETS.PORTS]: Object.freeze({
    queryable: true,
    uploadable: true,
    persisted: true,
    derived: false,
    format: DATASET_FORMAT.JSON
  }),
  [DATASETS.SPECIES]: Object.freeze({
    queryable: true,
    uploadable: true,
    persisted: true,
    derived: false,
    format: DATASET_FORMAT.JSON
  }),
  [DATASETS.MAP_LAND]: Object.freeze({
    queryable: true,
    uploadable: true,
    persisted: true,
    derived: false,
    format: DATASET_FORMAT.GEOJSON
  }),
  [DATASETS.MAP_STATISTICAL_AREAS]: Object.freeze({
    queryable: true,
    uploadable: true,
    persisted: true,
    derived: false,
    format: DATASET_FORMAT.GEOJSON
  }),
  [DATASETS.MAP_PORTS]: Object.freeze({
    queryable: true,
    uploadable: false,
    persisted: false,
    derived: true,
    format: DATASET_FORMAT.GEOJSON,
    sourceDataset: DATASETS.PORTS
  })
})

export function isSupportedDataset(value) {
  return Object.values(DATASETS).includes(value)
}

export function getDatasetCapabilities(dataset) {
  if (!isSupportedDataset(dataset)) {
    throw new Error(`Unsupported dataset: ${dataset}`)
  }
  return DATASET_CAPABILITIES[dataset]
}

export function isUploadableDataset(dataset) {
  return getDatasetCapabilities(dataset).uploadable
}

export function isQueryableDataset(dataset) {
  return getDatasetCapabilities(dataset).queryable
}

export function isPersistedDataset(dataset) {
  return getDatasetCapabilities(dataset).persisted
}

export function isDerivedDataset(dataset) {
  return getDatasetCapabilities(dataset).derived
}
