import Joi from 'joi'

import { guidSchema } from '#/common/schemas/fragments/guid.js'
import { timestampSchema } from '#/common/schemas/fragments/timestamp.js'
import { schemaVersionSchema } from '#/common/schemas/schema-versions.js'
import {
  DATASET_FORMAT,
  DATASETS,
  isPersistedDataset
} from '#/common/domain/datasets.js'

const PERSISTABLE_DATASETS = Object.values(DATASETS).filter(isPersistedDataset)

// Restricted to persisted datasets only; map-ports can never appear as a manifest entry.
export const manifestDatasetEntrySchema = Joi.object({
  dataset: Joi.string()
    .valid(...PERSISTABLE_DATASETS)
    .required(),
  collectionId: guidSchema.required(),
  schemaVersion: schemaVersionSchema.required(),
  version: Joi.string().min(1).required(),
  format: Joi.string()
    .valid(DATASET_FORMAT.JSON, DATASET_FORMAT.GEOJSON)
    .required(),
  etag: Joi.string().min(1).required(),
  checksum: Joi.string().min(1).required(),
  itemCount: Joi.number().strict().integer().min(0).required(),
  sizeBytes: Joi.number().strict().integer().min(0).required(),
  lastModified: timestampSchema.required(),
  objectRef: Joi.string().min(1).optional()
})

export const manifestSchema = Joi.object({
  manifestId: guidSchema.required(),
  version: Joi.string().min(1).required(),
  generatedAt: timestampSchema.required(),
  datasets: Joi.array().items(manifestDatasetEntrySchema).required()
})
