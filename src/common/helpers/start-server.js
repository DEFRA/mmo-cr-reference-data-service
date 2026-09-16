import { config } from '#/config.js'

import { createServer } from '#/server.js'
import { startCacheRefreshLifecycle } from '#/reference-data/cache-refresh/index.js'

export async function startServer() {
  const server = await createServer()
  await server.start()

  if (config.get('referenceData.autoStartCacheRefresh')) {
    // Fire-and-forget: hydrate() never rejects (internal failures are captured in
    // its result), so this cannot block or crash server startup; readiness is
    // reported independently through GET /health/ready.
    startCacheRefreshLifecycle().catch((error) =>
      server.logger.error(error, 'cache-refresh: startup hydration failed')
    )
  }

  server.logger.info('Server started successfully')
  server.logger.info(
    `Access your backend on http://localhost:${config.get('port')}`
  )

  return server
}
