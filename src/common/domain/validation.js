// Severity levels for reference-data validation issues.

export const VALIDATION_SEVERITY = Object.freeze({
  ERROR: 'error',
  WARNING: 'warning'
})

/**
 * @typedef {Object} ValidationIssue
 * @property {string} code machine-readable issue code
 * @property {string} message safe human-readable message
 * @property {string} [path] optional property path
 * @property {number} [itemIndex] optional item index
 * @property {*} [rejectedValue] optional rejected value, only when safe to expose
 * @property {string} [dataset] one of the DATASETS identifiers
 * @property {string} severity one of VALIDATION_SEVERITY
 * @property {string} [correlationId]
 *
 * @typedef {Object} ValidationResult
 * @property {boolean} valid
 * @property {ValidationIssue[]} errors
 * @property {ValidationIssue[]} warnings
 * @property {number} [receivedCount] item or feature count received, where applicable
 * @property {number} [normalisedCount] item or feature count after normalisation, where applicable
 */

export {}
