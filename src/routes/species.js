import { DATASET_ROUTE_PATHS } from '#/common/domain/route-paths.js'
import { createCollectionRouteController } from '#/reference-data/controller/collection-route-controller.js'
import { query } from '#/reference-data/query/index.js'
import { speciesQueryConfiguration } from '#/reference-data/query/species-query-configuration.js'
import { parseAcceptLanguageTag } from '#/reference-data/query/species-accept-language.js'
import { authenticationClient } from '#/reference-data/validation/index.js'
import { DATASETS } from '#/common/domain/datasets.js'

function getProjectionContext(request) {
  return {
    requestedLanguageTag: parseAcceptLanguageTag(
      request.headers['accept-language']
    )
  }
}

export { getProjectionContext }

const { collectionHandler, itemHandler } = createCollectionRouteController({
  config: speciesQueryConfiguration,
  query,
  authenticationClient,
  getProjectionContext
})

const basePath = DATASET_ROUTE_PATHS[DATASETS.SPECIES]

export const speciesCollection = {
  method: 'GET',
  path: basePath,
  handler: collectionHandler
}

export const speciesItem = {
  method: 'GET',
  path: `${basePath}/{id}`,
  handler: itemHandler
}
