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

// Builds the `code`/`header`/`response` chain shared by both fake Hapi
// toolkits; callers may add further chained methods (e.g. `type`) to `chain`.
export function createBaseFakeToolkit(state) {
  const chain = {
    code: (statusCode) => {
      state.statusCode = statusCode
      return chain
    },
    header: (name, value) => {
      state.headers[name] = value
      return chain
    }
  }
  return {
    chain,
    h: {
      response: (payload) => {
        state.payload = payload
        return chain
      }
    }
  }
}
