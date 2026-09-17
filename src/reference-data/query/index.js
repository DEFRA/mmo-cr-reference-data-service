import { inMemoryStore } from '#/reference-data/in-memory-store/index.js'
import { createLogger } from '#/common/helpers/logging/logger.js'
import { createQueryService } from './query-service.js'
import { createCollectionQueryService } from './collection-query-service.js'
import { createMapPortsQueryService } from './map-ports-query-service.js'

export { createQueryService } from './query-service.js'
export { parseIncludeFilter } from './manifest-include-filter.js'
export { projectManifest } from './manifest-projection.js'
export { createQueryConfiguration } from './query-configuration.js'
export { parseCollectionQuery } from './query-request-parser.js'
export { runCollectionQuery } from './collection-query-engine.js'
export { createCollectionQueryService } from './collection-query-service.js'
export { createMapPortsQueryService } from './map-ports-query-service.js'
export { calculateDeterministicEtag } from './result-etag.js'

// Production composition root for this component; tests should create isolated
// instances via createQueryService()/createCollectionQueryService()/
// createMapPortsQueryService(). Dataset-specific query configurations and endpoints
// are composed in Steps 16-20.
export const query = {
  ...createQueryService({ store: inMemoryStore }),
  ...createCollectionQueryService({
    store: inMemoryStore,
    logger: createLogger()
  }),
  ...createMapPortsQueryService({ store: inMemoryStore })
}
