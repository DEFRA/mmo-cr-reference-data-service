import { DATASET_ROUTE_PATHS } from '#/common/domain/route-paths.js'
import { createCollectionRouteController } from '#/reference-data/controller/collection-route-controller.js'
import { query } from '#/reference-data/query/index.js'
import { vesselsQueryConfiguration } from '#/reference-data/query/vessels-query-configuration.js'
import { authenticationClient } from '#/reference-data/validation/index.js'
import { DATASETS } from '#/common/domain/datasets.js'

const { collectionHandler, itemHandler } = createCollectionRouteController({
  config: vesselsQueryConfiguration,
  query,
  authenticationClient
})

const basePath = DATASET_ROUTE_PATHS[DATASETS.VESSELS]

export const vesselsCollection = {
  method: 'GET',
  path: basePath,
  handler: collectionHandler
}

export const vesselsItem = {
  method: 'GET',
  path: `${basePath}/{id}`,
  handler: itemHandler
}
