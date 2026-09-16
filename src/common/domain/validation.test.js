import { describe, expect, test } from 'vitest'

import { VALIDATION_SEVERITY } from './validation.js'

describe('#VALIDATION_SEVERITY', () => {
  test('defines error and warning severities', () => {
    expect(VALIDATION_SEVERITY).toEqual({ ERROR: 'error', WARNING: 'warning' })
  })

  test('is frozen', () => {
    expect(Object.isFrozen(VALIDATION_SEVERITY)).toBe(true)
  })
})
