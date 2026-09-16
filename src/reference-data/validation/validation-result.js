import { VALIDATION_SEVERITY } from '#/common/domain/validation.js'
import { VALIDATION_ISSUE_CODE } from './error-codes.js'

// Bounds the number of issues a single validation run can report; protects against a
// malicious or pathological collection producing an unbounded response.
export const MAX_VALIDATION_ISSUES = 200

function isSafeRejectedValue(value) {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
}

function normaliseIssue(issue, severity) {
  const { code, message, path, itemIndex, rejectedValue, dataset, context } =
    issue

  return {
    code,
    message,
    severity,
    ...(path !== undefined ? { path } : {}),
    ...(itemIndex !== undefined ? { itemIndex } : {}),
    ...(isSafeRejectedValue(rejectedValue) ? { rejectedValue } : {}),
    ...(dataset !== undefined ? { dataset } : {}),
    ...(context !== undefined ? { context } : {})
  }
}

/**
 * Deterministic, bounded collector for validation errors and warnings. Callers must add
 * issues in a fixed, deterministic order (stage order, then rule order, then item order) —
 * the collector preserves insertion order rather than re-sorting, so callers stay in control
 * of the "stage order, then path" ordering required by the validation contract.
 */
export function createIssueCollector({
  maxIssues = MAX_VALIDATION_ISSUES
} = {}) {
  const errors = []
  const warnings = []
  let truncated = false

  function hasCapacity() {
    return errors.length + warnings.length < maxIssues
  }

  function addError(issue) {
    if (!hasCapacity()) {
      truncated = true
      return
    }
    errors.push(normaliseIssue(issue, VALIDATION_SEVERITY.ERROR))
  }

  function addWarning(issue) {
    if (!hasCapacity()) {
      truncated = true
      return
    }
    warnings.push(normaliseIssue(issue, VALIDATION_SEVERITY.WARNING))
  }

  function toResult({ receivedCount, normalisedCount } = {}) {
    if (truncated) {
      warnings.push(
        normaliseIssue(
          {
            code: VALIDATION_ISSUE_CODE.VALIDATION_ISSUES_TRUNCATED,
            message: `Validation stopped collecting issues after ${maxIssues} entries.`
          },
          VALIDATION_SEVERITY.WARNING
        )
      )
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      ...(receivedCount !== undefined ? { receivedCount } : {}),
      ...(normalisedCount !== undefined ? { normalisedCount } : {})
    }
  }

  return { addError, addWarning, toResult }
}
