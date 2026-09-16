import Joi from 'joi'

import { guidSchema } from './guid.js'

const MIN_POSITION_DIMENSIONS = 2
const MAX_POSITION_DIMENSIONS = 3
const MIN_LINEAR_RING_POSITIONS = 4
const MIN_POLYGON_RINGS = 1
const MIN_MULTIPOLYGON_POLYGONS = 1

// A GeoJSON position: [longitude, latitude, optional altitude], longitude-first.
export const positionSchema = Joi.array()
  .items(Joi.number().strict())
  .min(MIN_POSITION_DIMENSIONS)
  .max(MAX_POSITION_DIMENSIONS)

const linearRingSchema = Joi.array()
  .items(positionSchema)
  .min(MIN_LINEAR_RING_POSITIONS)

const polygonCoordinatesSchema = Joi.array()
  .items(linearRingSchema)
  .min(MIN_POLYGON_RINGS)

const multiPolygonCoordinatesSchema = Joi.array()
  .items(polygonCoordinatesSchema)
  .min(MIN_MULTIPOLYGON_POLYGONS)

export const polygonGeometrySchema = Joi.object({
  type: Joi.string().valid('Polygon').required(),
  coordinates: polygonCoordinatesSchema.required()
})

export const multiPolygonGeometrySchema = Joi.object({
  type: Joi.string().valid('MultiPolygon').required(),
  coordinates: multiPolygonCoordinatesSchema.required()
})

// Structural shape only; full geospatial topology validation is out of scope.
export const geometrySchema = Joi.alternatives().try(
  polygonGeometrySchema,
  multiPolygonGeometrySchema
)

export function createFeatureSchema(propertiesSchema) {
  return Joi.object({
    type: Joi.string().valid('Feature').required(),
    id: guidSchema.required(),
    properties: propertiesSchema.required(),
    geometry: geometrySchema.required()
  })
}

export function createFeatureCollectionSchema(featureSchema) {
  return Joi.object({
    type: Joi.string().valid('FeatureCollection').required(),
    features: Joi.array().items(featureSchema).required()
  })
}
