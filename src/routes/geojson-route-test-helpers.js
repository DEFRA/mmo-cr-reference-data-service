// Shared fixtures/stubs for the map-land and map-statistical-areas route tests.

export {
  createStubAuthenticationClient,
  buildTestServerWithRoutes,
  buildCollectionRouteTestServer
} from '#/routes/route-test-helpers.js'

export const SQUARE_RING = [
  [0, 0],
  [0, 10],
  [10, 10],
  [10, 0],
  [0, 0]
]
