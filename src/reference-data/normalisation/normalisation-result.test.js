import { describe, expect, test } from 'vitest'

import { createNormalisationResult } from './normalisation-result.js'

describe('#createNormalisationResult', () => {
  test('returns changed:false with no warnings when there are no changes', () => {
    const result = createNormalisationResult({
      value: { code: 'GBPLY' },
      changed: false,
      changes: []
    })

    expect(result).toEqual({
      value: { code: 'GBPLY' },
      changed: false,
      warnings: []
    })
  })

  test('maps a change into a whitespace_trimmed warning', () => {
    const result = createNormalisationResult({
      value: { code: 'GBPLY' },
      changed: true,
      changes: [
        {
          path: 'items[0].code',
          originalValue: ' GBPLY ',
          normalisedValue: 'GBPLY'
        }
      ]
    })

    expect(result.changed).toBe(true)
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: 'whitespace_trimmed',
        path: 'items[0].code',
        originalValue: ' GBPLY ',
        normalisedValue: 'GBPLY'
      })
    ])
  })

  test('redacts an unsafe original/normalised value', () => {
    const result = createNormalisationResult({
      value: {},
      changed: true,
      changes: [
        {
          path: 'x',
          originalValue: { nested: true },
          normalisedValue: undefined
        }
      ]
    })

    expect(result.warnings[0]).not.toHaveProperty('originalValue')
    expect(result.warnings[0]).not.toHaveProperty('normalisedValue')
  })

  test('truncates warnings beyond the configured maximum and appends a truncation warning', () => {
    const changes = Array.from({ length: 5 }, (_, index) => ({
      path: `items[${index}]`,
      originalValue: ' a ',
      normalisedValue: 'a'
    }))

    const result = createNormalisationResult({
      value: {},
      changed: true,
      changes,
      maxWarnings: 2
    })

    expect(result.warnings).toHaveLength(3)
    expect(result.warnings[2]).toEqual(
      expect.objectContaining({ code: 'normalisation_warnings_truncated' })
    )
  })
})
