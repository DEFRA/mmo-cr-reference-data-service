// Infrastructure-independent interface implemented by the future Persistence Module.
// No AWS SDK or S3 client types are exposed here.

function notImplemented(methodName) {
  return () => {
    throw new Error(`referenceDataRepository.${methodName} is not implemented`)
  }
}

/**
 * @param {Object} [overrides] test-double or adapter implementations for individual methods
 */
export function createReferenceDataRepositoryContract(overrides = {}) {
  return {
    readCollection: notImplemented('readCollection'),
    writeCollection: notImplemented('writeCollection'),
    readManifest: notImplemented('readManifest'),
    writeManifest: notImplemented('writeManifest'),
    getObjectMetadata: notImplemented('getObjectMetadata'),
    objectExists: notImplemented('objectExists'),
    ...overrides
  }
}
