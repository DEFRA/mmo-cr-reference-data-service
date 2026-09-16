import { describe, expect, test } from 'vitest'

import { controller } from './controller/index.js'
import { validation } from './validation/index.js'
import { query } from './query/index.js'
import { command } from './command/index.js'
import { normalisation } from './normalisation/index.js'
import { inMemoryStore } from './in-memory-store/index.js'
import { cacheRefresh } from './cache-refresh/index.js'
import { persistence } from './persistence/index.js'

describe('#referenceDataComponents', () => {
  test.each([
    ['controller', controller, 'controller'],
    ['validation', validation, 'validation'],
    ['query', query, 'query'],
    ['command', command, 'command'],
    ['normalisation', normalisation, 'normalisation'],
    ['cacheRefresh', cacheRefresh, 'cache-refresh']
  ])(
    '%s component loads with expected name',
    (_label, component, expectedName) => {
      expect(component).toEqual({ name: expectedName })
    }
  )

  // inMemoryStore is implemented (Step 05); its behaviour is covered by in-memory-store/in-memory-data-store.test.js.
  test('inMemoryStore component implements the In-Memory Data Store contract', () => {
    expect(Object.keys(inMemoryStore).sort()).toEqual(
      [
        'clear',
        'getCollection',
        'getCollectionMetadata',
        'getManifest',
        'hasCollection',
        'listLoadedDatasets',
        'removeCollection',
        'setCollection',
        'setManifest'
      ].sort()
    )
  })

  // persistence is implemented (Step 07); its behaviour is covered by persistence/reference-data-repository.test.js.
  test('persistence component implements the Reference Data Repository contract', () => {
    expect(Object.keys(persistence).sort()).toEqual(
      [
        'getObjectMetadata',
        'objectExists',
        'readCollection',
        'readManifest',
        'writeCollection',
        'writeManifest'
      ].sort()
    )
  })
})
