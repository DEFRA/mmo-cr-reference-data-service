import { describe, expect, test } from 'vitest'

import { trimStringsDeep } from './string-trim.js'

describe('#trimStringsDeep', () => {
  test('returns an already-trimmed string unchanged', () => {
    const result = trimStringsDeep('clean')
    expect(result).toEqual({ value: 'clean', changed: false, changes: [] })
  })

  test('trims leading and trailing whitespace from a string', () => {
    const result = trimStringsDeep('  GBPLY  ', 'items[0].code')
    expect(result).toEqual({
      value: 'GBPLY',
      changed: true,
      changes: [
        {
          path: 'items[0].code',
          originalValue: '  GBPLY  ',
          normalisedValue: 'GBPLY'
        }
      ]
    })
  })

  test('leaves numbers, booleans, and null untouched', () => {
    expect(trimStringsDeep(42)).toEqual({
      value: 42,
      changed: false,
      changes: []
    })
    expect(trimStringsDeep(true)).toEqual({
      value: true,
      changed: false,
      changes: []
    })
    expect(trimStringsDeep(null)).toEqual({
      value: null,
      changed: false,
      changes: []
    })
  })

  test('recurses through nested objects and arrays, tracking paths', () => {
    const input = {
      dataset: 'ports',
      items: [{ id: 'abc', code: '  GBPLY  ', coordinate: { latitude: 50.1 } }]
    }

    const result = trimStringsDeep(input)

    expect(result.changed).toBe(true)
    expect(result.value).toEqual({
      dataset: 'ports',
      items: [{ id: 'abc', code: 'GBPLY', coordinate: { latitude: 50.1 } }]
    })
    expect(result.changes).toEqual([
      {
        path: 'items[0].code',
        originalValue: '  GBPLY  ',
        normalisedValue: 'GBPLY'
      }
    ])
  })

  test('reports changed:false and no changes when nothing needs trimming', () => {
    const input = { dataset: 'ports', items: [{ code: 'GBPLY' }] }
    const result = trimStringsDeep(input)

    expect(result.changed).toBe(false)
    expect(result.changes).toEqual([])
    expect(result.value).toEqual(input)
  })

  test('does not mutate the supplied input', () => {
    const input = { items: [{ code: '  GBPLY  ' }] }
    const before = structuredClone(input)

    trimStringsDeep(input)

    expect(input).toEqual(before)
  })

  test('is idempotent: a second pass over the trimmed output changes nothing', () => {
    const input = { items: [{ code: '  GBPLY  ' }] }

    const first = trimStringsDeep(input)
    const second = trimStringsDeep(first.value)

    expect(second.changed).toBe(false)
    expect(second.changes).toEqual([])
    expect(second.value).toEqual(first.value)
  })

  test('trims strings nested inside arrays with correct index paths', () => {
    const result = trimStringsDeep([' a ', 'b'], 'names')
    expect(result.changes).toEqual([
      { path: 'names[0]', originalValue: ' a ', normalisedValue: 'a' }
    ])
  })
})
