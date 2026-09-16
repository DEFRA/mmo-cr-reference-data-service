import { DATASET_ROUTE_PATHS } from '#/common/domain/route-paths.js'
import { createGeoJsonCollectionRouteController } from '#/reference-data/controller/geojson-collection-route-controller.js'
import { query } from '#/reference-data/query/index.js'
import { mapStatisticalAreasQueryConfiguration } from '#/reference-data/query/map-statistical-areas-query-configuration.js'
import { authenticationClient } from '#/reference-data/validation/index.js'
import { DATASETS } from '#/common/domain/datasets.js'

const { collectionHandler, itemHandler } =
  createGeoJsonCollectionRouteController({
    config: mapStatisticalAreasQueryConfiguration,
    query,
    authenticationClient
  })

const basePath = DATASET_ROUTE_PATHS[DATASETS.MAP_STATISTICAL_AREAS]

export const mapStatisticalAreasCollection = {
  method: 'GET',
  path: basePath,
  handler: collectionHandler
}

export const mapStatisticalAreasItem = {
  method: 'GET',
  path: `${basePath}/{id}`,
  handler: itemHandler
}
