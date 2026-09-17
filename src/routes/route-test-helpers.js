// Shared authentication stub and Hapi test-server bootstrap reused by every
// route integration test.

import { afterAll } from 'vitest'
import { createServer } from '#/server.js'

export function createStubAuthenticationClient() {
  return {
    authenticate: async ({ token }) =>
      token === 'read-token'
        ? {
            authenticated: true,
            actor: { actorId: 'a1', permissions: ['reference-data.read'] }
          }
        : {
            authenticated: false,
            failure: { code: 'unauthorized', message: 'x' }
          }
  }
}

export async function buildTestServerWithRoutes(routes) {
  const server = await createServer()
  server.route(routes)
  await server.initialize()
  return server
}

// Builds a test server for a collection handler and, when supplied, its
// matching GET-by-id item handler (e.g. map-land has no item route).
export function buildCollectionRouteTestServer({
  collectionPath,
  itemPath,
  collectionHandler,
  itemHandler
}) {
  const routes = [
    { method: 'GET', path: collectionPath, handler: collectionHandler }
  ]
  if (itemPath && itemHandler) {
    routes.push({ method: 'GET', path: itemPath, handler: itemHandler })
  }
  return buildTestServerWithRoutes(routes)
}

// Registers the standard teardown for a describe-scoped mutable `server`
// reference (`getServer` must read the same variable a test assigns to).
export function registerServerTeardown(getServer) {
  afterAll(async () => {
    const server = getServer()
    if (server) {
      await server.stop()
    }
  })
}

export async function injectAuthenticatedGet(server, url, extraHeaders = {}) {
  return server.inject({
    method: 'GET',
    url,
    headers: { authorization: 'Bearer read-token', ...extraHeaders }
  })
}
