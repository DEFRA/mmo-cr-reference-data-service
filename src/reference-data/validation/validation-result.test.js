import { describe, expect, test } from 'vitest'

import { createIssueCollector } from './validation-result.js'

describe('#createIssueCollector', () => {
  test('starts valid with no issues', () => {
    const collector = createIssueCollector()
    expect(collector.toResult()).toEqual({
      valid: true,
      errors: [],
      warnings: []
    })
  })

  test('becomes invalid once an error is added', () => {
    const collector = createIssueCollector()
    collector.addError({ code: 'business_rule_failed', message: 'failed' })

    const result = collector.toResult()
    expect(result.valid).toBe(false)
    expect(result.errors).toHaveLength(1)
  })

  test('warnings alone do not make a result invalid', () => {
    const collector = createIssueCollector()
    collector.addWarning({
      code: 'validation_issues_truncated',
      message: 'warn'
    })

    expect(collector.toResult().valid).toBe(true)
  })

  test('omits an unsafe rejectedValue', () => {
    const collector = createIssueCollector()
    collector.addError({
      code: 'business_rule_failed',
      message: 'failed',
      rejectedValue: { secret: 'value' }
    })

    expect(collector.toResult().errors[0].rejectedValue).toBeUndefined()
  })

  test('keeps a safe scalar rejectedValue', () => {
    const collector = createIssueCollector()
    collector.addError({
      code: 'business_rule_failed',
      message: 'failed',
      rejectedValue: 'GBPLY'
    })

    expect(collector.toResult().errors[0].rejectedValue).toBe('GBPLY')
  })

  test('bounds the number of collected issues and reports truncation', () => {
    const collector = createIssueCollector({ maxIssues: 2 })

    collector.addError({ code: 'business_rule_failed', message: 'one' })
    collector.addError({ code: 'business_rule_failed', message: 'two' })
    collector.addError({ code: 'business_rule_failed', message: 'three' })

    const result = collector.toResult()

    expect(result.errors).toHaveLength(2)
    expect(
      result.warnings.some((w) => w.code === 'validation_issues_truncated')
    ).toBe(true)
  })

  test('bounds the number of collected warnings and reports truncation', () => {
    const collector = createIssueCollector({ maxIssues: 2 })

    collector.addWarning({ code: 'normalisation_warning', message: 'one' })
    collector.addWarning({ code: 'normalisation_warning', message: 'two' })
    collector.addWarning({ code: 'normalisation_warning', message: 'three' })

    const result = collector.toResult()

    expect(
      result.warnings.filter((w) => w.code === 'normalisation_warning')
    ).toHaveLength(2)
    expect(
      result.warnings.some((w) => w.code === 'validation_issues_truncated')
    ).toBe(true)
  })

  test('includes receivedCount and normalisedCount only when supplied', () => {
    const collector = createIssueCollector()

    expect(collector.toResult({ receivedCount: 3 })).toEqual({
      valid: true,
      errors: [],
      warnings: [],
      receivedCount: 3
    })
  })
})
