// Shared request stub and authenticated-actor fixture reused by the
// collection-route-controller and geojson-collection-route-controller tests.

export function createRequest({
  authorization,
  ifNoneMatch,
  query = {},
  params = {}
} = {}) {
  return {
    app: { correlationId: 'corr-1' },
    headers: {
      ...(authorization !== undefined ? { authorization } : {}),
      ...(ifNoneMatch !== undefined ? { 'if-none-match': ifNoneMatch } : {})
    },
    query,
    params
  }
}

export const AUTHENTICATED = {
  authenticated: true,
  actor: { actorId: 'a1', permissions: ['reference-data.read'] }
}
