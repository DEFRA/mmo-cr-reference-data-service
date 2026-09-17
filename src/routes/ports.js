import { DATASET_ROUTE_PATHS } from '#/common/domain/route-paths.js'
import { createCollectionRouteController } from '#/reference-data/controller/collection-route-controller.js'
import { query } from '#/reference-data/query/index.js'
import { portsQueryConfiguration } from '#/reference-data/query/ports-query-configuration.js'
import { authenticationClient } from '#/reference-data/validation/index.js'
import { DATASETS } from '#/common/domain/datasets.js'

const { collectionHandler, itemHandler } = createCollectionRouteController({
  config: portsQueryConfiguration,
  query,
  authenticationClient
})

const basePath = DATASET_ROUTE_PATHS[DATASETS.PORTS]

export const portsCollection = {
  method: 'GET',
  path: basePath,
  handler: collectionHandler
}

export const portsItem = {
  method: 'GET',
  path: `${basePath}/{id}`,
  handler: itemHandler
}
