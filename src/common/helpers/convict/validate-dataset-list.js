import Joi from 'joi'

import {
  isPersistedDataset,
  isSupportedDataset
} from '#/common/domain/datasets.js'

// Accepts a comma-separated env string or a JS array; rejects anything not a
// supported, persisted (non-derived) dataset identifier.
export const convictValidateDatasetList = {
  name: 'dataset-list',
  coerce: function coerceDatasetList(value) {
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    }
    return value
  },
  validate: function validateDatasetList(value) {
    Joi.assert(value, Joi.array().items(Joi.string()).min(1).required())
    const unsupported = value.filter(
      (dataset) => !isSupportedDataset(dataset) || !isPersistedDataset(dataset)
    )
    if (unsupported.length > 0) {
      throw new Error(
        `Unsupported or non-persisted dataset(s): ${unsupported.join(', ')}`
      )
    }
  }
}
