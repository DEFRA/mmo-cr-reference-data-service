import Joi from 'joi'

import { UPLOAD_ROUTE_PATH } from '#/common/domain/route-paths.js'
import { DATASETS, isUploadableDataset } from '#/common/domain/datasets.js'
import { config } from '#/config.js'
import { createUploadValidationController } from '#/reference-data/controller/upload-validation-controller.js'
import { authenticationClient } from '#/reference-data/validation/index.js'
import { persistence } from '#/reference-data/persistence/index.js'
import { inMemoryStore } from '#/reference-data/in-memory-store/index.js'

// Single source of truth for which datasets may be uploaded, derived from the central
// dataset registry — never a second, hand-maintained list (excludes the derived
// `map-ports` dataset).
const uploadableDatasetIds = Object.values(DATASETS).filter(isUploadableDataset)

// Exported separately so tests can register the same validated route shape against a
// stubbed authenticationClient/controller without depending on the production
// composition root (matches the `collection-route-controller` test convention).
export const uploadValidationRouteOptions = {
  validate: {
    params: Joi.object({
      dataset: Joi.string()
        .valid(...uploadableDatasetIds)
        .required()
    }),
    query: Joi.object({
      // Absent or "false" performs full atomic replacement (Step 22); "true" performs
      // Step 21's non-persistent validation-only mode. Any other representation is
      // rejected.
      validateOnly: Joi.string().valid('true', 'false').optional()
    })
  },
  payload: {
    multipart: { output: 'annotated' },
    parse: true,
    allow: 'multipart/form-data',
    maxBytes: config.get('referenceData.maxUploadBytes')
  }
}

const { handler } = createUploadValidationController({
  authenticationClient,
  persistence,
  store: inMemoryStore
})

export const uploadValidation = {
  method: 'PUT',
  path: UPLOAD_ROUTE_PATH,
  options: uploadValidationRouteOptions,
  handler
}
