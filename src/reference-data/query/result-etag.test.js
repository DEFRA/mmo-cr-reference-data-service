import { describe, expect, test } from 'vitest'

import { calculateDeterministicEtag } from './result-etag.js'

describe('#calculateDeterministicEtag', () => {
  test('is stable for the same payload', () => {
    const payload = { collectionId: 'c1', version: 'v1' }
    expect(calculateDeterministicEtag(payload)).toBe(
      calculateDeterministicEtag({ ...payload })
    )
  })

  test('changes when the payload changes', () => {
    expect(calculateDeterministicEtag({ version: 'v1' })).not.toBe(
      calculateDeterministicEtag({ version: 'v2' })
    )
  })

  test('is a quoted sha256 string', () => {
    const etag = calculateDeterministicEtag({ a: 1 })
    expect(etag.startsWith('"sha256-')).toBe(true)
    expect(etag.endsWith('"')).toBe(true)
  })
})
