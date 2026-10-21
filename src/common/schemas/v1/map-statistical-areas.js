import Joi from 'joi'

import {
  createFeatureSchemaWithoutId,
  multiPolygonGeometrySchema
} from '#/common/schemas/fragments/geojson.js'
import { createCollectionEnvelopeSchema } from '#/common/schemas/v1/collection-envelope.js'
import { DATASETS } from '#/common/domain/datasets.js'

// See docs/adr/0001-map-statistical-areas-raw-epsg3857-contract.md: this dataset is
// served as the raw upstream ArcGIS/shapefile export, unchanged — no reprojection, no
// field renaming, no synthesised Feature.id. The ArcGIS columns below are the
// documented export columns, enumerated explicitly (not `.unknown(true)`), so
// upstream column drift fails validation loudly instead of being silently accepted.
export const statisticalAreaPropertiesSchema = Joi.object({
  OBJECTID: Joi.number().strict().integer().required(),
  OBJECTID_1: Joi.number().strict().integer().optional(),
  ICESNAME: Joi.string().min(1).required(),
  SOUTH: Joi.number().strict().required(),
  WEST: Joi.number().strict().required(),
  NORTH: Joi.number().strict().required(),
  EAST: Joi.number().strict().required(),
  AREA_KM2: Joi.number().strict().positive().required(),
  stat_x: Joi.number().strict().optional(),
  stat_y: Joi.number().strict().optional(),
  sub_code: Joi.string().min(1).required(),
  sub_str: Joi.number().strict().integer().optional(),
  sub_x: Joi.number().strict().optional(),
  sub_y: Joi.number().strict().optional(),
  Shape_Leng: Joi.number().strict().positive().required(),
  Shape_Area: Joi.number().strict().positive().required()
})

// No Feature.id: the raw ArcGIS export has no per-feature identifier (the item
// identifier is properties.OBJECTID — a query-layer concern, not a schema one).
// Geometry is restricted to MultiPolygon (not the generic Polygon|MultiPolygon
// alternation) to match the raw export exactly.
export const mapStatisticalAreaFeatureSchema = createFeatureSchemaWithoutId(
  statisticalAreaPropertiesSchema,
  multiPolygonGeometrySchema
)

// The raw export's top-level GeoJSON `crs` member (naming EPSG:3857) is passed
// through unchanged; RFC 7946 §6.1 tolerates this as a foreign member.
const statisticalAreasCrsSchema = Joi.object({
  type: Joi.string().valid('name').required(),
  properties: Joi.object({
    name: Joi.string().min(1).required()
  }).required()
})

export const mapStatisticalAreasCollectionSchema =
  createCollectionEnvelopeSchema(DATASETS.MAP_STATISTICAL_AREAS, {
    type: Joi.string().valid('FeatureCollection').required(),
    crs: statisticalAreasCrsSchema.required(),
    features: Joi.array().items(mapStatisticalAreaFeatureSchema).required()
  })
