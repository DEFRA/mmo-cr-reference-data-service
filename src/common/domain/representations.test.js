import { describe, expect, test } from 'vitest'

import {
  REPRESENTATIONS,
  isSupportedRepresentation
} from './representations.js'

describe('#isSupportedRepresentation', () => {
  test.each(Object.values(REPRESENTATIONS))(
    'recognises %s',
    (representation) => {
      expect(isSupportedRepresentation(representation)).toBe(true)
    }
  )

  test('rejects an unknown representation identifier', () => {
    expect(isSupportedRepresentation('unknown-representation')).toBe(false)
  })
})
