import { createInMemoryDataStore } from './in-memory-data-store.js'

export { createInMemoryDataStore }

// Production composition root for this component; tests should create isolated instances via createInMemoryDataStore().
export const inMemoryStore = createInMemoryDataStore()
