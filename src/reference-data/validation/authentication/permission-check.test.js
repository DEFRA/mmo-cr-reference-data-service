import { describe, expect, test } from 'vitest'

import {
  authorize,
  hasExactPermission,
  requireAuthenticatedActor,
  requirePermission,
  requireReadPermission,
  requireWritePermission
} from './permission-check.js'

const READ_ACTOR = { actorId: 'actor-1', permissions: ['reference-data.read'] }
const WRITE_ACTOR = {
  actorId: 'actor-2',
  permissions: ['reference-data.write']
}
const BOTH_ACTOR = {
  actorId: 'actor-3',
  permissions: ['reference-data.read', 'reference-data.write']
}
const NO_PERMISSION_ACTOR = { actorId: 'actor-4', permissions: [] }

describe('#hasExactPermission', () => {
  test('matches an exact permission', () => {
    expect(hasExactPermission(READ_ACTOR, 'reference-data.read')).toBe(true)
  })

  test('rejects substring matching', () => {
    expect(hasExactPermission(READ_ACTOR, 'reference-data.rea')).toBe(false)
    expect(hasExactPermission(READ_ACTOR, 'reference-data')).toBe(false)
  })

  test('fails closed when permissions are missing or malformed', () => {
    expect(hasExactPermission({}, 'reference-data.read')).toBe(false)
    expect(hasExactPermission(null, 'reference-data.read')).toBe(false)
    expect(
      hasExactPermission(
        { permissions: 'reference-data.read' },
        'reference-data.read'
      )
    ).toBe(false)
  })
})

describe('#requireAuthenticatedActor', () => {
  test('returns the actor for a successful outcome', () => {
    expect(
      requireAuthenticatedActor({ authenticated: true, actor: READ_ACTOR })
    ).toBe(READ_ACTOR)
  })

  test('throws unauthorized for a failed outcome', () => {
    expect(() =>
      requireAuthenticatedActor({
        authenticated: false,
        failure: { message: 'x' }
      })
    ).toThrow(expect.objectContaining({ code: 'unauthorized' }))
  })

  test('throws unauthorized when authenticated but the actor is missing', () => {
    expect(() => requireAuthenticatedActor({ authenticated: true })).toThrow(
      expect.objectContaining({ code: 'unauthorized' })
    )
  })
})

describe('#requireReadPermission / #requireWritePermission', () => {
  test('read permission authorises read access', () => {
    expect(requireReadPermission(READ_ACTOR)).toBe(READ_ACTOR)
  })

  test('missing read permission throws forbidden', () => {
    expect(() => requireReadPermission(WRITE_ACTOR)).toThrow(
      expect.objectContaining({ code: 'forbidden' })
    )
  })

  test('write permission authorises write access', () => {
    expect(requireWritePermission(WRITE_ACTOR)).toBe(WRITE_ACTOR)
  })

  test('missing write permission throws forbidden', () => {
    expect(() => requireWritePermission(READ_ACTOR)).toThrow(
      expect.objectContaining({ code: 'forbidden' })
    )
  })

  test('read permission does not automatically grant write permission', () => {
    expect(() => requireWritePermission(READ_ACTOR)).toThrow()
  })

  test('write permission does not automatically grant read permission', () => {
    expect(() => requireReadPermission(WRITE_ACTOR)).toThrow()
  })

  test('an actor with both permissions passes both checks', () => {
    expect(requireReadPermission(BOTH_ACTOR)).toBe(BOTH_ACTOR)
    expect(requireWritePermission(BOTH_ACTOR)).toBe(BOTH_ACTOR)
  })

  test('missing permission data fails closed', () => {
    expect(() =>
      requirePermission(NO_PERMISSION_ACTOR, 'reference-data.read')
    ).toThrow(expect.objectContaining({ code: 'forbidden' }))
  })

  test('does not mutate the actor or permission inputs', () => {
    const actor = { actorId: 'actor-5', permissions: ['reference-data.read'] }
    const before = structuredClone(actor)
    requireReadPermission(actor)
    expect(actor).toEqual(before)
  })
})

describe('#authorize', () => {
  test('returns authorised:true for a matching permission', () => {
    expect(
      authorize({ actor: READ_ACTOR, permission: 'reference-data.read' })
    ).toEqual({
      authorised: true
    })
  })

  test('returns authorised:false for a missing permission', () => {
    expect(
      authorize({ actor: READ_ACTOR, permission: 'reference-data.write' })
    ).toEqual({
      authorised: false
    })
  })
})
