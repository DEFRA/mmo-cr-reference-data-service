import hapi from '@hapi/hapi'

describe('#startServer', () => {
  let createServerSpy
  let hapiServerSpy
  let startServerImport
  let createServerImport

  beforeAll(async () => {
    vi.stubEnv('PORT', '3098')
    createServerImport = await import('#/server.js')
    startServerImport = await import('./start-server.js')

    createServerSpy = vi.spyOn(createServerImport, 'createServer')
    hapiServerSpy = vi.spyOn(hapi, 'server')
  })

  afterAll(() => {
    vi.resetAllMocks()
  })

  describe('When server starts', () => {
    test('Should start up server as expected', async () => {
      await startServerImport.startServer()

      expect(createServerSpy).toHaveBeenCalled()
      expect(hapiServerSpy).toHaveBeenCalled()
    })
  })

  describe('When server start fails', () => {
    test('Should log failed startup message', async () => {
      createServerSpy.mockRejectedValue(new Error('Server failed to start'))

      await expect(startServerImport.startServer()).rejects.toThrow(
        'Server failed to start'
      )
    })
  })
})

describe('#startServer cache-refresh auto-start', () => {
  test('starts the cache-refresh lifecycle when auto-start is enabled', async () => {
    vi.resetModules()
    vi.stubEnv('PORT', '3099')
    vi.doMock('#/reference-data/cache-refresh/index.js', () => ({
      startCacheRefreshLifecycle: vi.fn().mockResolvedValue(undefined),
      stopCacheRefreshLifecycle: vi.fn(),
      cacheRefresh: { getReadinessState: () => ({ shuttingDown: false }) }
    }))

    const { config } = await import('#/config.js')
    config.set('referenceData.autoStartCacheRefresh', true)

    try {
      const { startServer } = await import('./start-server.js')
      const { startCacheRefreshLifecycle } =
        await import('#/reference-data/cache-refresh/index.js')

      const server = await startServer()
      await server.stop()

      expect(startCacheRefreshLifecycle).toHaveBeenCalled()
    } finally {
      config.set('referenceData.autoStartCacheRefresh', false)
      vi.doUnmock('#/reference-data/cache-refresh/index.js')
      vi.resetModules()
    }
  })

  test('logs an error rather than crashing startup when the cache-refresh lifecycle fails', async () => {
    vi.resetModules()
    vi.stubEnv('PORT', '3100')
    let rejectHydration
    const hydrationPromise = new Promise((_resolve, reject) => {
      rejectHydration = reject
    })
    vi.doMock('#/reference-data/cache-refresh/index.js', () => ({
      startCacheRefreshLifecycle: vi.fn(() => hydrationPromise),
      stopCacheRefreshLifecycle: vi.fn(),
      cacheRefresh: { getReadinessState: () => ({ shuttingDown: false }) }
    }))

    const { config } = await import('#/config.js')
    config.set('referenceData.autoStartCacheRefresh', true)

    try {
      const { startServer } = await import('./start-server.js')
      const server = await startServer()
      const errorSpy = vi.spyOn(server.logger, 'error')

      rejectHydration(new Error('hydration failed'))
      // Let the fire-and-forget rejection's .catch() handler run.
      await new Promise((resolve) => setImmediate(resolve))
      await server.stop()

      expect(errorSpy).toHaveBeenCalledWith(
        expect.any(Error),
        'cache-refresh: startup hydration failed'
      )
    } finally {
      config.set('referenceData.autoStartCacheRefresh', false)
      vi.doUnmock('#/reference-data/cache-refresh/index.js')
      vi.resetModules()
    }
  })
})
