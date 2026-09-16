import { config } from '#/config.js'
import { createLogger } from '#/common/helpers/logging/logger.js'
import { persistence } from '#/reference-data/persistence/index.js'
import { inMemoryStore } from '#/reference-data/in-memory-store/index.js'
import { createCacheRefreshService } from './cache-refresh-service.js'
import { createScheduler } from './scheduler.js'

export { createCacheRefreshService } from './cache-refresh-service.js'
export { createScheduler } from './scheduler.js'

// Production composition root for this component; tests should create isolated
// instances via createCacheRefreshService()/createScheduler().
export const cacheRefresh = createCacheRefreshService({
  persistence,
  store: inMemoryStore,
  mandatoryDatasets: config.get('referenceData.mandatoryDatasets'),
  hydrationTimeoutMs: config.get('referenceData.hydrationTimeoutMs'),
  refreshConcurrency: config.get('referenceData.refreshConcurrency'),
  logger: createLogger()
})

export const scheduler = createScheduler({
  intervalMs: config.get('referenceData.refreshIntervalMs'),
  initialDelayMs: config.get('referenceData.refreshInitialDelayMs'),
  task: () => cacheRefresh.refresh(),
  onError: (cause) =>
    createLogger().error(
      { err: cause },
      'cache-refresh: scheduled refresh failed'
    )
})

export async function startCacheRefreshLifecycle() {
  await cacheRefresh.hydrate()
  if (config.get('referenceData.refreshEnabled')) {
    scheduler.start()
  }
}

export function stopCacheRefreshLifecycle() {
  cacheRefresh.markShuttingDown()
  scheduler.stop()
}
