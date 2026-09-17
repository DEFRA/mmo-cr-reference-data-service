import { dependencyStatusService } from '#/reference-data/health/index.js'
import { CACHE_CONTROL } from '#/common/helpers/api/cache-control.js'

const HTTP_STATUS_OK = 200
const HTTP_STATUS_SERVICE_UNAVAILABLE = 503

// Diagnostic only: never triggers a collection read, cache refresh, or
// mutation. Public payload exposes only high-level dependency status values,
// never URLs, bucket names, object keys, or raw dependency errors.
async function handler(_request, h) {
  const result = await dependencyStatusService.getStatus()

  return h
    .response({
      status: result.status,
      timestamp: result.timestamp,
      dependencies: result.dependencies
    })
    .code(result.ready ? HTTP_STATUS_OK : HTTP_STATUS_SERVICE_UNAVAILABLE)
    .header('Cache-Control', CACHE_CONTROL.NO_STORE)
}

export const dependencyStatus = {
  method: 'GET',
  path: '/health/dependencies',
  handler
}
