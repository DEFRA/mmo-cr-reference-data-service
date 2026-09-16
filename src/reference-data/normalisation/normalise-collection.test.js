import { describe, expect, test } from 'vitest'

import './datasets/register.js'
import { normaliseCollection } from './normalise-collection.js'

describe('#normaliseCollection', () => {
  test('normalises a valid dataset collection', () => {
    const result = normaliseCollection({
      dataset: 'ports',
      collection: { items: [{ code: ' GBPLY ' }] }
    })

    expect(result.changed).toBe(true)
    expect(result.value.items[0].code).toBe('GBPLY')
  })

  test('throws for an unsupported dataset', () => {
    expect(() =>
      normaliseCollection({ dataset: 'not-a-real-dataset', collection: {} })
    ).toThrow()
  })

  test('throws for the derived map-ports dataset', () => {
    expect(() =>
      normaliseCollection({ dataset: 'map-ports', collection: {} })
    ).toThrow()
  })

  test('does not mutate the supplied collection', () => {
    const collection = { items: [{ code: ' GBPLY ' }] }
    const before = structuredClone(collection)

    normaliseCollection({ dataset: 'ports', collection })

    expect(collection).toEqual(before)
  })

  test('is idempotent across two successive calls', () => {
    const collection = { items: [{ code: ' GBPLY ' }] }

    const first = normaliseCollection({ dataset: 'ports', collection })
    const second = normaliseCollection({
      dataset: 'ports',
      collection: first.value
    })

    expect(second.changed).toBe(false)
    expect(second.value).toEqual(first.value)
  })
})
