import { cacheRefresh } from '#/reference-data/cache-refresh/index.js'
import { config } from '#/config.js'
import { CACHE_CONTROL } from '#/common/helpers/api/cache-control.js'

const HTTP_STATUS_OK = 200
const HTTP_STATUS_SERVICE_UNAVAILABLE = 503

// Derives a safe lifecycle label without ever forwarding the raw internal
// `shuttingDown` flag itself.
function computeStatus(state) {
  if (state.shuttingDown) {
    return 'shutting-down'
  }
  return state.ready ? 'ready' : 'not-ready'
}

function buildMandatoryDatasetSummary(state) {
  const expected = config.get('referenceData.mandatoryDatasets').length
  const missing = state.missingMandatoryDatasets
  return {
    expected,
    loaded: expected - missing.length,
    missing
  }
}

export const readiness = {
  method: 'GET',
  path: '/health/ready',
  handler: (_request, h) => {
    const state = cacheRefresh.getReadinessState()
    const payload = {
      status: computeStatus(state),
      ready: state.ready,
      hydrated: state.hydrated,
      timestamp: new Date().toISOString(),
      datasets: { mandatory: buildMandatoryDatasetSummary(state) },
      missingMandatoryDatasets: state.missingMandatoryDatasets,
      lastHydratedAt: state.lastHydratedAt,
      lastRefreshAt: state.lastRefreshAt,
      lastRefreshStatus: state.lastRefreshStatus
    }
    return h
      .response(payload)
      .code(state.ready ? HTTP_STATUS_OK : HTTP_STATUS_SERVICE_UNAVAILABLE)
      .header('Cache-Control', CACHE_CONTROL.NO_STORE)
  }
}
