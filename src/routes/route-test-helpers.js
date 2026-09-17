// Shared authentication stub and Hapi test-server bootstrap reused by every
// route integration test.

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
