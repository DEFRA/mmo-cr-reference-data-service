import { describe, expect, test } from 'vitest'

import { createReadinessTracker } from './readiness-tracker.js'

describe('#createReadinessTracker', () => {
  test('starts not hydrated and not shutting down', () => {
    const tracker = createReadinessTracker()
    expect(tracker.getFlags()).toEqual({
      hydrated: false,
      shuttingDown: false,
      lastHydratedAt: null,
      lastRefreshAt: null,
      lastRefreshStatus: null
    })
  })

  test('markHydrated records hydrated state and timestamp', () => {
    const tracker = createReadinessTracker()
    tracker.markHydrated('2026-09-11T08:00:00Z')
    expect(tracker.getFlags().hydrated).toBe(true)
    expect(tracker.getFlags().lastHydratedAt).toBe('2026-09-11T08:00:00Z')
  })

  test('markRefreshed records the latest refresh timestamp and status', () => {
    const tracker = createReadinessTracker()
    tracker.markRefreshed({
      timestamp: '2026-09-11T09:00:00Z',
      status: 'completed'
    })
    expect(tracker.getFlags().lastRefreshAt).toBe('2026-09-11T09:00:00Z')
    expect(tracker.getFlags().lastRefreshStatus).toBe('completed')
  })

  test('markShuttingDown sets shuttingDown to true', () => {
    const tracker = createReadinessTracker()
    tracker.markShuttingDown()
    expect(tracker.getFlags().shuttingDown).toBe(true)
  })
})
