import { describe, expect, test } from 'vitest'

import { createTestAuthenticationClient } from './test-authentication-client.js'

describe('#createTestAuthenticationClient', () => {
  test('returns a controlled synthetic actor with read permission', async () => {
    const client = createTestAuthenticationClient({
      tokens: {
        'read-token': {
          actorId: 'test-actor-1',
          permissions: ['reference-data.read']
        }
      }
    })

    const outcome = await client.authenticate({ token: 'read-token' })

    expect(outcome).toEqual({
      authenticated: true,
      actor: { actorId: 'test-actor-1', permissions: ['reference-data.read'] },
      correlationId: undefined
    })
  })

  test('write and read permissions can be configured independently', async () => {
    const client = createTestAuthenticationClient({
      tokens: {
        reader: { actorId: 'reader', permissions: ['reference-data.read'] },
        writer: { actorId: 'writer', permissions: ['reference-data.write'] },
        both: {
          actorId: 'both',
          permissions: ['reference-data.read', 'reference-data.write']
        }
      }
    })

    expect(
      (await client.authenticate({ token: 'reader' })).actor.permissions
    ).toEqual(['reference-data.read'])
    expect(
      (await client.authenticate({ token: 'writer' })).actor.permissions
    ).toEqual(['reference-data.write'])
    expect(
      (await client.authenticate({ token: 'both' })).actor.permissions
    ).toEqual(['reference-data.read', 'reference-data.write'])
  })

  test('simulates an invalid token', async () => {
    const client = createTestAuthenticationClient({ tokens: {} })
    const outcome = await client.authenticate({ token: 'unknown' })
    expect(outcome.authenticated).toBe(false)
    expect(outcome.failure.code).toBe('unauthorized')
  })

  test('simulates Authentication Service unavailability', async () => {
    const client = createTestAuthenticationClient({
      tokens: { 'down-token': { unavailable: true } }
    })

    const outcome = await client.authenticate({ token: 'down-token' })

    expect(outcome.authenticated).toBe(false)
    expect(outcome.failure.code).toBe('authentication_service_unavailable')
  })

  test('a missing token causes no lookup and fails as unauthorized', async () => {
    const client = createTestAuthenticationClient({ tokens: {} })
    const outcome = await client.authenticate({ token: undefined })
    expect(outcome.failure.code).toBe('unauthorized')
  })

  test('does not include hardcoded real user information', () => {
    const source = createTestAuthenticationClient.toString()
    expect(source).not.toMatch(/@(gmail|hotmail|outlook)\./)
  })
})
