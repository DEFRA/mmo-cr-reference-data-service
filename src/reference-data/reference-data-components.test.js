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
    ['inMemoryStore', inMemoryStore, 'in-memory-store'],
    ['cacheRefresh', cacheRefresh, 'cache-refresh'],
    ['persistence', persistence, 'persistence']
  ])(
    '%s component loads with expected name',
    (_label, component, expectedName) => {
      expect(component).toEqual({ name: expectedName })
    }
  )
})
