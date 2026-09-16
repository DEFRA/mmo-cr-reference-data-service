import { createLogger } from '#/common/helpers/logging/logger.js'
import { mapErrorToResponse } from '#/common/helpers/api/map-error-to-response.js'

const logger = createLogger()
const SERVER_ERROR_THRESHOLD = 500

/**
 * Converts every error reaching the API boundary into the standard error
 * envelope before the response is sent. Registered before the correlation
 * plugin so the correlation header still applies to the final, safe response
 * (this handler intentionally does not call `.takeover()`, which would skip
 * later onPreResponse extensions).
 */
export const errorResponse = {
  plugin: {
    name: 'error-response',
    register: (server) => {
      server.ext('onPreResponse', (request, h) => {
        const response = request.response
        if (!response.isBoom) {
          return h.continue
        }

        const correlationId = request.app.correlationId
        const { statusCode, envelope } = mapErrorToResponse(response, {
          correlationId
        })

        if (statusCode >= SERVER_ERROR_THRESHOLD) {
          logger.error({ err: response, correlationId }, 'Unhandled API error')
        } else {
          logger.warn(
            { code: envelope.error.code, correlationId },
            'API request failed'
          )
        }

        return h.response(envelope).code(statusCode)
      })
    }
  }
}
