import { describe, test, expect, vi, beforeEach } from 'vitest'

const mockCacheRefresh = {
  hydrate: vi.fn().mockResolvedValue({ status: 'completed' }),
  refresh: vi.fn().mockResolvedValue({ status: 'completed' }),
  markShuttingDown: vi.fn()
}
const mockScheduler = { start: vi.fn(), stop: vi.fn() }

const configValues = {
  'referenceData.mandatoryDatasets': ['vessels'],
  'referenceData.hydrationTimeoutMs': 10000,
  'referenceData.refreshConcurrency': 3,
  'referenceData.refreshIntervalMs': 60000,
  'referenceData.refreshInitialDelayMs': 0,
  'referenceData.refreshEnabled': false,
  'referenceData.autoStartCacheRefresh': false
}

vi.mock('#/config.js', () => ({
  config: { get: (key) => configValues[key] }
}))
vi.mock('#/common/helpers/logging/logger.js', () => ({
  createLogger: () => ({ error: vi.fn(), debug: vi.fn(), warn: vi.fn() })
}))
vi.mock('#/reference-data/persistence/index.js', () => ({ persistence: {} }))
vi.mock('#/reference-data/in-memory-store/index.js', () => ({
  inMemoryStore: {}
}))
vi.mock('./cache-refresh-service.js', () => ({
  createCacheRefreshService: vi.fn(() => mockCacheRefresh)
}))
vi.mock('./scheduler.js', () => ({
  createScheduler: vi.fn(() => mockScheduler)
}))

describe('cache-refresh composition root', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    configValues['referenceData.refreshEnabled'] = false
  })

  test('startCacheRefreshLifecycle hydrates and does not start the scheduler when refresh is disabled', async () => {
    const { startCacheRefreshLifecycle } = await import('./index.js')

    await startCacheRefreshLifecycle()

    expect(mockCacheRefresh.hydrate).toHaveBeenCalled()
    expect(mockScheduler.start).not.toHaveBeenCalled()
  })

  test('startCacheRefreshLifecycle starts the scheduler when refresh is enabled', async () => {
    configValues['referenceData.refreshEnabled'] = true
    const { startCacheRefreshLifecycle } = await import('./index.js')

    await startCacheRefreshLifecycle()

    expect(mockCacheRefresh.hydrate).toHaveBeenCalled()
    expect(mockScheduler.start).toHaveBeenCalled()
  })

  test('stopCacheRefreshLifecycle marks shutting down and stops the scheduler', async () => {
    const { stopCacheRefreshLifecycle } = await import('./index.js')

    stopCacheRefreshLifecycle()

    expect(mockCacheRefresh.markShuttingDown).toHaveBeenCalled()
    expect(mockScheduler.stop).toHaveBeenCalled()
  })
})
