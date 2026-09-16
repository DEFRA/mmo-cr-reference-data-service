import { DATASET_ROUTE_PATHS } from '#/common/domain/route-paths.js'
import { createGeoJsonCollectionRouteController } from '#/reference-data/controller/geojson-collection-route-controller.js'
import { query } from '#/reference-data/query/index.js'
import { mapLandQueryConfiguration } from '#/reference-data/query/map-land-query-configuration.js'
import { authenticationClient } from '#/reference-data/validation/index.js'
import { DATASETS } from '#/common/domain/datasets.js'

const { collectionHandler } = createGeoJsonCollectionRouteController({
  config: mapLandQueryConfiguration,
  query,
  authenticationClient
})

export const mapLand = {
  method: 'GET',
  path: DATASET_ROUTE_PATHS[DATASETS.MAP_LAND],
  handler: collectionHandler
}
