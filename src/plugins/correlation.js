import { randomUUID } from 'node:crypto'

import { config } from '#/config.js'

const HEADER_NAME = config.get('tracing.header')
// Bounded, conservative allowlist for a caller-supplied correlation id (matches
// typical UUID/opaque-token shapes). An invalid or missing value is replaced
// with a freshly generated one rather than rejecting the request.
const VALID_CORRELATION_ID_PATTERN = /^[\w-]{1,100}$/

export function resolveCorrelationId(suppliedValue) {
  return typeof suppliedValue === 'string' &&
    VALID_CORRELATION_ID_PATTERN.test(suppliedValue)
    ? suppliedValue
    : randomUUID()
}

// Reuses the existing x-cdp-request-id tracing header end-to-end (request,
// response, error traceId) instead of introducing a second correlation header.
export const correlation = {
  plugin: {
    name: 'correlation',
    register: (server) => {
      server.ext('onRequest', (request, h) => {
        request.app.correlationId = resolveCorrelationId(
          request.headers[HEADER_NAME]
        )
        return h.continue
      })

      server.ext('onPreResponse', (request, h) => {
        const response = request.response
        const correlationId = request.app.correlationId
        if (response.isBoom) {
          response.output.headers[HEADER_NAME] = correlationId
        } else {
          response.header(HEADER_NAME, correlationId)
        }
        return h.continue
      })
    }
  }
}
