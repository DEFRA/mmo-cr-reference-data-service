// Interface implemented by the future process-local In-Memory Data Store.
// A cache, not a database: no transactions, indexes, or cross-process consistency are implied.

function notImplemented(methodName) {
  return () => {
    throw new Error(`inMemoryDataStore.${methodName} is not implemented`)
  }
}

/**
 * @param {Object} [overrides] test-double or adapter implementations for individual methods
 */
export function createInMemoryDataStoreContract(overrides = {}) {
  return {
    setCollection: notImplemented('setCollection'),
    getCollection: notImplemented('getCollection'),
    getCollectionMetadata: notImplemented('getCollectionMetadata'),
    hasCollection: notImplemented('hasCollection'),
    listLoadedDatasets: notImplemented('listLoadedDatasets'),
    removeCollection: notImplemented('removeCollection'),
    setManifest: notImplemented('setManifest'),
    getManifest: notImplemented('getManifest'),
    clear: notImplemented('clear'),
    ...overrides
  }
}
