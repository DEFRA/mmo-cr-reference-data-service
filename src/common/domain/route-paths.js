// Central, framework-agnostic public API route-path registry. Shared by the Query
// Module (manifest dataset URLs) and the Reference Data Controller (Hapi route
// registration) so the two can never drift apart.

import { DATASETS } from './datasets.js'

export const API_BASE_PATH = '/api/v1/reference-data'

export const MANIFEST_ROUTE_PATH = `${API_BASE_PATH}/manifest`

// Full collection upload route (Step 21 validation-only mode, Step 22 replacement).
// Deliberately distinct from DATASET_ROUTE_PATHS below: uploads always use the literal
// dataset identifier as the path segment (e.g. "map-land"), not the nested read paths
// used for map datasets (e.g. "/map/land").
export const UPLOAD_ROUTE_PATH = `${API_BASE_PATH}/{dataset}`

export const DATASET_ROUTE_PATHS = Object.freeze({
  [DATASETS.VESSELS]: `${API_BASE_PATH}/vessels`,
  [DATASETS.GEARS]: `${API_BASE_PATH}/gears`,
  [DATASETS.PORTS]: `${API_BASE_PATH}/ports`,
  [DATASETS.SPECIES]: `${API_BASE_PATH}/species`,
  [DATASETS.MAP_LAND]: `${API_BASE_PATH}/map/land`,
  [DATASETS.MAP_STATISTICAL_AREAS]: `${API_BASE_PATH}/map/statistical-areas`,
  [DATASETS.MAP_PORTS]: `${API_BASE_PATH}/map/ports`
})

export function getDatasetRoutePath(dataset) {
  const path = DATASET_ROUTE_PATHS[dataset]
  if (!path) {
    throw new Error(`No public route registered for dataset: ${dataset}`)
  }
  return path
}
