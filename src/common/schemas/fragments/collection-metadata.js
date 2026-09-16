import Joi from 'joi'

import { guidSchema } from './guid.js'
import { timestampSchema } from './timestamp.js'
import { schemaVersionSchema } from '#/common/schemas/schema-versions.js'

// Shared metadata keys reused by every collection envelope (JSON and GeoJSON alike),
// so metadata is never redefined per-format.
export const collectionMetadataKeys = Object.freeze({
  collectionId: guidSchema.required(),
  schemaVersion: schemaVersionSchema.required(),
  version: Joi.string().min(1).required(),
  generatedAt: timestampSchema.required(),
  effectiveFrom: timestampSchema.optional(),
  itemCount: Joi.number().strict().integer().min(0).required()
})
