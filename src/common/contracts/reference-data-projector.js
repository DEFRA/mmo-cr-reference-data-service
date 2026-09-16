// Interface implemented by the future canonical-to-mobile projector.
// Produces JSON-compatible mobile data from canonical data; no persistence or transport concerns.

function notImplemented(methodName) {
  return () => {
    throw new Error(`referenceDataProjector.${methodName} is not implemented`)
  }
}

/**
 * @param {Object} [overrides] test-double or adapter implementations for individual methods
 */
export function createReferenceDataProjectorContract(overrides = {}) {
  return {
    project: notImplemented('project'),
    ...overrides
  }
}
