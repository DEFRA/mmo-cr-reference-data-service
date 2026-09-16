import {
  isSupportedDataset,
  isUploadableDataset
} from '#/common/domain/datasets.js'
import { resolveDatasetNormaliser } from './dataset-normaliser-registry.js'

/**
 * Top-level canonical normalisation entry point. Expects `collection` to already be
 * structurally usable (the Validation Module's responsibility, upstream). Never
 * accesses S3/Floci/the Authentication Service, never updates the in-memory store,
 * and never mutates the supplied `collection`.
 */
export function normaliseCollection({ dataset, collection } = {}) {
  if (!isSupportedDataset(dataset) || !isUploadableDataset(dataset)) {
    throw new Error(`"${dataset}" is not a supported, uploadable dataset.`)
  }

  return resolveDatasetNormaliser(dataset)(collection)
}
