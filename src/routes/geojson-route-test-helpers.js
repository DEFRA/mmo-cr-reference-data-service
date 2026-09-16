// Shared fixtures/stubs for the map-land and map-statistical-areas route tests.

export const SQUARE_RING = [
  [0, 0],
  [0, 10],
  [10, 10],
  [10, 0],
  [0, 0]
]

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
