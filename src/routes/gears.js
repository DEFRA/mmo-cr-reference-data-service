import { DATASET_ROUTE_PATHS } from '#/common/domain/route-paths.js'
import { createCollectionRouteController } from '#/reference-data/controller/collection-route-controller.js'
import { query } from '#/reference-data/query/index.js'
import { gearsQueryConfiguration } from '#/reference-data/query/gears-query-configuration.js'
import {
  collectPageMeasurements,
  stripInternalProjectionFields
} from '#/reference-data/query/gears-mobile-projector.js'
import { projectGearToStandard } from '#/reference-data/query/gears-standard-projector.js'
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

// Embeds a resolved `category`/`measurement` object on the standard (canonical)
// view only, so a consumer no longer has to join against the mobile view (or a
// separate lookup) to resolve a bare categoryId/characteristicId. No-op for the
// mobile view, which already has its own resolved shape.
export function addStandardGearDetails(body, result) {
  if (result.view === REPRESENTATIONS.MOBILE) {
    return body
  }
  return {
    ...body,
    items: body.items.map((gear) => projectGearToStandard(gear, result.context))
  }
}

export function addStandardGearItemDetails(body, result) {
  if (result.view === REPRESENTATIONS.MOBILE) {
    return body
  }
  return projectGearToStandard(body, result.context)
}

export function postProcessCollectionBody(body, result) {
  return addMobileMeasurements(addStandardGearDetails(body, result), result)
}

export function postProcessItemBody(body, result) {
  return addMobileItemContext(addStandardGearItemDetails(body, result), result)
}

const { collectionHandler, itemHandler } = createCollectionRouteController({
  config: gearsQueryConfiguration,
  query,
  authenticationClient,
  postProcessCollectionBody,
  postProcessItemBody
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
