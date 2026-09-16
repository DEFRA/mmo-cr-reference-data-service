import { cacheRefresh } from '#/reference-data/cache-refresh/index.js'

const HTTP_STATUS_SERVICE_UNAVAILABLE = 503

export const readiness = {
  method: 'GET',
  path: '/health/ready',
  handler: (_request, h) => {
    const state = cacheRefresh.getReadinessState()
    const payload = {
      ready: state.ready,
      hydrated: state.hydrated,
      missingMandatoryDatasets: state.missingMandatoryDatasets,
      lastHydratedAt: state.lastHydratedAt,
      lastRefreshAt: state.lastRefreshAt,
      lastRefreshStatus: state.lastRefreshStatus
    }
    return state.ready
      ? h.response(payload)
      : h.response(payload).code(HTTP_STATUS_SERVICE_UNAVAILABLE)
  }
}
