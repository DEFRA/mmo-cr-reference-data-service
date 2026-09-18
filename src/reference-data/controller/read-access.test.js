import { describe, expect, test, vi } from 'vitest'

import { extractBearerToken, requireReadAccess } from './read-access.js'

describe('#extractBearerToken', () => {
  test('extracts the token from a valid Bearer header', () => {
    expect(extractBearerToken('Bearer abc123')).toBe('abc123')
  })

  test('returns null for a missing header', () => {
    expect(extractBearerToken(undefined)).toBeNull()
  })

  test('returns null for a non-Bearer scheme', () => {
    expect(extractBearerToken('Basic abc123')).toBeNull()
  })

  test('returns null when the Bearer prefix has no token after it', () => {
    expect(extractBearerToken('Bearer ')).toBeNull()
  })

  test('returns null when the Bearer prefix is followed only by whitespace', () => {
    expect(extractBearerToken('Bearer    ')).toBeNull()
  })
})

describe('#requireReadAccess', () => {
  test('authenticates using the extracted token and correlation id', async () => {
    const authenticate = vi.fn().mockResolvedValue({
      authenticated: true,
      actor: { actorId: 'a1', permissions: ['reference-data.read'] }
    })
    const request = {
      app: { correlationId: 'corr-1' },
      headers: { authorization: 'Bearer abc123' }
    }

    const actor = await requireReadAccess(request, {
      authenticate
    })

    expect(authenticate).toHaveBeenCalledWith({
      token: 'abc123',
      correlationId: 'corr-1'
    })
    expect(actor).toEqual({
      actorId: 'a1',
      permissions: ['reference-data.read']
    })
  })

  test('rejects when the read permission is missing', async () => {
    const authenticate = vi.fn().mockResolvedValue({
      authenticated: true,
      actor: { actorId: 'a1', permissions: [] }
    })
    const request = {
      app: { correlationId: 'corr-1' },
      headers: { authorization: 'Bearer abc123' }
    }

    await expect(
      requireReadAccess(request, { authenticate })
    ).rejects.toMatchObject({ code: 'forbidden' })
  })
})
