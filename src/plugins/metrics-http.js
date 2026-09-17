// Hapi plugin: bounded HTTP request metrics (Step 25). Additive to hapi-pino's
// existing per-request completion log — this plugin never logs, it only records
// metrics using the safe route template (never the raw path or query string).

import {
  recordCounter,
  recordDuration,
  METRIC_NAMES
} from '#/common/helpers/observability/metrics.js'

function resolveRouteLabel(request) {
  return request.route?.path ?? 'unknown'
}

export const metricsHttp = {
  plugin: {
    name: 'metrics-http',
    register: (server) => {
      server.ext('onPreResponse', (request, h) => {
        const dimensions = {
          route: resolveRouteLabel(request),
          method: request.method?.toUpperCase(),
          status_code: String(
            request.response.isBoom
              ? request.response.output.statusCode
              : request.response.statusCode
          )
        }
        recordCounter(METRIC_NAMES.HTTP_REQUESTS_TOTAL, 1, dimensions)
        recordDuration(
          METRIC_NAMES.HTTP_REQUEST_DURATION_MS,
          Date.now() - request.info.received,
          dimensions
        )
        return h.continue
      })
    }
  }
}
