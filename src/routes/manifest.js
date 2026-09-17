import { MANIFEST_ROUTE_PATH } from '#/common/domain/route-paths.js'
import { createManifestController } from '#/reference-data/controller/manifest-controller.js'
import { query } from '#/reference-data/query/index.js'
import { authenticationClient } from '#/reference-data/validation/index.js'

const { handler } = createManifestController({ query, authenticationClient })

export const manifest = {
  method: 'GET',
  path: MANIFEST_ROUTE_PATH,
  handler
}
