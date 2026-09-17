import Hapi from '@hapi/hapi'

import { secureContext } from '@defra/hapi-secure-context'

import { config } from '#/config.js'
import { router } from '#/plugins/router.js'
import { requestLogger } from '#/plugins/request-logger.js'
import { failAction } from '#/common/helpers/fail-action.js'
import { pulse } from '#/plugins/pulse.js'
import { requestTracing } from '#/plugins/request-tracing.js'
import { correlation } from '#/plugins/correlation.js'
import { errorResponse } from '#/plugins/error-response.js'
import { metrics } from '@defra/cdp-metrics'
import { metricsHttp } from '#/plugins/metrics-http.js'
import { stopCacheRefreshLifecycle } from '#/reference-data/cache-refresh/index.js'

export async function createServer() {
  const server = Hapi.server({
    host: config.get('host'),
    port: config.get('port'),
    routes: {
      validate: {
        options: {
          abortEarly: false
        },
        failAction
      },
      security: {
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: false
        },
        xss: 'enabled',
        noSniff: true,
        xframe: true
      }
    },
    router: {
      stripTrailingSlash: true
    }
  })

  // Hapi Plugins:
  // requestLogger  - automatically logs incoming requests
  // requestTracing - trace header logging and propagation
  // errorResponse  - maps every error to the standard API error envelope
  // correlation    - resolves/generates the correlation id and sets it on every response
  // metrics        - decorates request/server with the @defra/cdp-metrics instance
  // metricsHttp    - records bounded HTTP request-count/duration metrics
  // secureContext  - loads CA certificates from environment config
  // pulse          - provides shutdown handlers
  // router         - routes used in the app
  await server.register([
    requestLogger,
    requestTracing,
    errorResponse,
    correlation,
    metrics,
    metricsHttp,
    secureContext,
    pulse,
    router
  ])

  // Stops future cache-refresh scheduling and marks readiness as shutting down
  // before the server stops accepting connections.
  server.ext('onPreStop', () => {
    stopCacheRefreshLifecycle()
  })

  return server
}
