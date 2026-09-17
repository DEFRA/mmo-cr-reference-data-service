import { config } from '#/config.js'
import { persistence } from '#/reference-data/persistence/index.js'
import { cacheRefresh } from '#/reference-data/cache-refresh/index.js'
import { createDependencyStatusService } from './dependency-status-service.js'

export {
  createDependencyStatusService,
  DEPENDENCY_STATUS
} from './dependency-status-service.js'

// Production composition root for this component; tests should create isolated
// instances via createDependencyStatusService().
export const dependencyStatusService = createDependencyStatusService({
  persistence,
  cacheRefresh,
  mandatoryDatasetCount: config.get('referenceData.mandatoryDatasets').length,
  authenticationServiceUrl: config.get('authentication.serviceUrl'),
  probeTimeoutMs: config.get('health.dependencyProbeTimeoutMs')
})
