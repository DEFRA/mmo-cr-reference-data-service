import { DATASET_ROUTE_PATHS } from '#/common/domain/route-paths.js'
import { createMapPortsController } from '#/reference-data/controller/map-ports-controller.js'
import { query } from '#/reference-data/query/index.js'
import { authenticationClient } from '#/reference-data/validation/index.js'
import { DATASETS } from '#/common/domain/datasets.js'

const { handler } = createMapPortsController({ query, authenticationClient })

export const mapPorts = {
  method: 'GET',
  path: DATASET_ROUTE_PATHS[DATASETS.MAP_PORTS],
  handler
}
