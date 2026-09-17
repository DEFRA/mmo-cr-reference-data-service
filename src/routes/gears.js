import { DATASET_ROUTE_PATHS } from '#/common/domain/route-paths.js'
import { createCollectionRouteController } from '#/reference-data/controller/collection-route-controller.js'
import { query } from '#/reference-data/query/index.js'
import { gearsQueryConfiguration } from '#/reference-data/query/gears-query-configuration.js'
import {
  collectPageMeasurements,
  stripInternalProjectionFields
} from '#/reference-data/query/gears-mobile-projector.js'
import { resolveVesselLengthBand } from '#/reference-data/query/vessel-length-band.js'
import { authenticationClient } from '#/reference-data/validation/index.js'
import { DATASETS } from '#/common/domain/datasets.js'
import { REPRESENTATIONS } from '#/common/domain/representations.js'

const basePath = DATASET_ROUTE_PATHS[DATASETS.GEARS]

export function buildVesselLengthContext(result) {
  const vesselLengthMetres = result.context?.vesselLengthMetres
  if (vesselLengthMetres === undefined) {
    return null
  }
  return {
    vesselLengthMetres,
    vesselLengthBand: resolveVesselLengthBand(vesselLengthMetres)
  }
}

export function addMobileMeasurements(body, result) {
  if (result.view !== REPRESENTATIONS.MOBILE) {
    return body
  }
  const measurements = collectPageMeasurements(
    body.items,
    result.context.characteristicsById
  )
  const vesselLengthContext = buildVesselLengthContext(result)
  return {
    ...body,
    ...(vesselLengthContext ? { context: vesselLengthContext } : {}),
    measurements,
    items: body.items.map(stripInternalProjectionFields)
  }
}

export function addMobileItemContext(body, result) {
  if (result.view !== REPRESENTATIONS.MOBILE) {
    return body
  }
  return stripInternalProjectionFields(body)
}

const { collectionHandler, itemHandler } = createCollectionRouteController({
  config: gearsQueryConfiguration,
  query,
  authenticationClient,
  postProcessCollectionBody: addMobileMeasurements,
  postProcessItemBody: addMobileItemContext
})

export const gearsCollection = {
  method: 'GET',
  path: basePath,
  handler: collectionHandler
}

export const gearsItem = {
  method: 'GET',
  path: `${basePath}/{id}`,
  handler: itemHandler
}

export { resolveVesselLengthBand }
