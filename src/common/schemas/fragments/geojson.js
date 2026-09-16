import Joi from 'joi'

import { guidSchema } from './guid.js'

// A GeoJSON position: [longitude, latitude, optional altitude], longitude-first.
export const positionSchema = Joi.array()
  .items(Joi.number().strict())
  .min(2)
  .max(3)

const linearRingSchema = Joi.array().items(positionSchema).min(4)

const polygonCoordinatesSchema = Joi.array().items(linearRingSchema).min(1)

const multiPolygonCoordinatesSchema = Joi.array()
  .items(polygonCoordinatesSchema)
  .min(1)

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
