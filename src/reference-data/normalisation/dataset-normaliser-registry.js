import {
  DATASETS,
  isSupportedDataset,
  isUploadableDataset
} from '#/common/domain/datasets.js'
import { createNormalisationResult } from './normalisation-result.js'

function createIdentityNormaliser() {
  return (collection) =>
    createNormalisationResult({
      value: collection,
      changed: false,
      changes: []
    })
}

// One entry per uploadable dataset, defaulting to a safe identity placeholder;
// datasets/register.js replaces each with the real Step 10 dataset normaliser.
const registry = new Map(
  Object.values(DATASETS)
    .filter((dataset) => isUploadableDataset(dataset))
    .map((dataset) => [dataset, createIdentityNormaliser()])
)

/**
 * Resolves the dataset-specific normaliser for an uploadable dataset. Throws for an
 * unsupported dataset or a derived, non-uploadable dataset (e.g. map-ports) —
 * resolution failure here is a programming/contract error, not a collection issue.
 */
export function resolveDatasetNormaliser(dataset) {
  if (!isSupportedDataset(dataset)) {
    throw new Error(`Unsupported dataset: ${dataset}`)
  }
  if (!isUploadableDataset(dataset)) {
    throw new Error(
      `Dataset "${dataset}" is derived and cannot be resolved for normalisation.`
    )
  }
  return registry.get(dataset)
}

export function registerDatasetNormaliser(dataset, normaliserFn) {
  if (!isUploadableDataset(dataset)) {
    throw new Error(
      `Dataset "${dataset}" is derived and cannot register a normaliser.`
    )
  }
  registry.set(dataset, normaliserFn)
}
