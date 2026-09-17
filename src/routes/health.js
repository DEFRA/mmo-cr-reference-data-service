import { config } from '#/config.js'
import { CACHE_CONTROL } from '#/common/helpers/api/cache-control.js'

const HTTP_STATUS_OK = 200

// Liveness only: constant-time, no dependency calls of any kind. Must never
// fail because S3/Floci, the Authentication Service, or startup hydration are
// unavailable — those conditions belong to readiness/dependency status.
function handler(_request, h) {
  return h
    .response({
      status: 'ok',
      service: config.get('serviceName'),
      timestamp: new Date().toISOString()
    })
    .code(HTTP_STATUS_OK)
    .header('Cache-Control', CACHE_CONTROL.NO_STORE)
}

export const health = {
  method: 'GET',
  path: '/health',
  handler
}
