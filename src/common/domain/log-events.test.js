import { describe, expect, test } from 'vitest'

import { LOG_EVENTS } from './log-events.js'

describe('#LOG_EVENTS', () => {
  test('every event name follows the reference_data.<area>_<action> convention', () => {
    for (const eventName of Object.values(LOG_EVENTS)) {
      expect(eventName).toMatch(/^reference_data\.[a-z0-9_]+$/)
    }
  })

  test('every event name is unique', () => {
    const names = Object.values(LOG_EVENTS)
    expect(new Set(names).size).toBe(names.length)
  })

  test('is frozen', () => {
    expect(Object.isFrozen(LOG_EVENTS)).toBe(true)
  })
})
