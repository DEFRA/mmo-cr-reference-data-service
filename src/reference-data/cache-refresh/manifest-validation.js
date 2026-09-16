import { getManifestSchema } from '#/common/schemas/schema-registry.js'
import {
  mapValidationErrorDetails,
  validateAgainstSchema
} from '#/common/schemas/validate.js'
import {
  isPersistedDataset,
  isSupportedDataset
} from '#/common/domain/datasets.js'
import { findDuplicates } from '#/reference-data/validation/duplicate-detection.js'

/**
 * Structural and minimal business validation of the manifest document itself
 * (distinct from validating each referenced collection). Never mutates `manifest`.
 */
export function validateManifest(manifest, { schemaVersion = '1.0' } = {}) {
  const schema = getManifestSchema(schemaVersion)
  const { error } = validateAgainstSchema(schema, manifest)
  if (error) {
    return {
      valid: false,
      issues: mapValidationErrorDetails(error),
      entries: []
    }
  }

  const entries = manifest.datasets
  const issues = []

  entries.forEach((entry, index) => {
    if (
      !isSupportedDataset(entry.dataset) ||
      !isPersistedDataset(entry.dataset)
    ) {
      issues.push({
        path: `datasets[${index}].dataset`,
        message: `Unsupported or non-persisted dataset "${entry.dataset}".`
      })
    }
  })

  const duplicateEntries = findDuplicates(
    entries.map((entry, index) => ({
      value: entry.dataset,
      path: `datasets[${index}].dataset`,
      itemIndex: index
    }))
  )
  duplicateEntries.forEach((duplicate) => {
    issues.push({
      path: duplicate.entries[0].path,
      message: `Duplicate manifest entry for dataset "${duplicate.value}".`
    })
  })

  return { valid: issues.length === 0, issues, entries }
}
