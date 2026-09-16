import {
  DATASETS,
  isSupportedDataset,
  isUploadableDataset
} from '#/common/domain/datasets.js'

function createNoOpValidator() {
  return () => ({ valid: true, errors: [], warnings: [] })
}

// One entry per uploadable dataset. Step 08 registers a safe no-op placeholder for
// each; Step 09 replaces individual entries with real dataset-specific validators via
// registerDatasetBusinessValidator.
const registry = new Map(
  Object.values(DATASETS)
    .filter((dataset) => isUploadableDataset(dataset))
    .map((dataset) => [dataset, createNoOpValidator()])
)

/**
 * Resolves the dataset-specific business validator for an uploadable dataset.
 * Throws for an unsupported dataset or a derived, non-uploadable dataset (e.g. map-ports)
 * — resolution failure here is a programming/contract error, not a collection issue.
 */
export function resolveDatasetBusinessValidator(dataset) {
  if (!isSupportedDataset(dataset)) {
    throw new Error(`Unsupported dataset: ${dataset}`)
  }
  if (!isUploadableDataset(dataset)) {
    throw new Error(
      `Dataset "${dataset}" is derived and cannot be resolved for upload validation.`
    )
  }
  return registry.get(dataset)
}

export function registerDatasetBusinessValidator(dataset, validatorFn) {
  if (!isUploadableDataset(dataset)) {
    throw new Error(
      `Dataset "${dataset}" is derived and cannot register a business validator.`
    )
  }
  registry.set(dataset, validatorFn)
}
