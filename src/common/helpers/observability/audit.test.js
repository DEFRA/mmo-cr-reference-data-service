import { describe, expect, test, vi, beforeEach } from 'vitest'

const auditMock = vi.fn()

vi.mock('@defra/cdp-auditing', () => ({
  audit: (...args) => auditMock(...args)
}))

import { recordAuditEvent, AUDIT_OUTCOMES } from './audit.js'
import { config } from '#/config.js'

const FIXED_CLOCK = { now: () => '2026-09-17T12:00:00.000Z' }

beforeEach(() => {
  auditMock.mockClear()
  config.set('observability.auditEnabled', true)
})

describe('#recordAuditEvent', () => {
  test('builds the approved audit-event contract', () => {
    recordAuditEvent({
      eventType: 'reference-data.collection-replacement',
      action: 'replace-collection',
      outcome: AUDIT_OUTCOMES.SUCCESS,
      actorId: 'actor-1',
      resource: {
        type: 'reference-data-collection',
        dataset: 'species',
        collectionId: '13caf795-a8fc-4679-bc1c-d9cc7ce62b57',
        version: '2026.09.11.1'
      },
      correlationId: '42e9acba-016e-47af-841d-903bd8e9dc36',
      clock: FIXED_CLOCK
    })

    expect(auditMock).toHaveBeenCalledWith({
      eventType: 'reference-data.collection-replacement',
      occurredAt: '2026-09-17T12:00:00.000Z',
      action: 'replace-collection',
      outcome: 'success',
      actor: { id: 'actor-1' },
      resource: {
        type: 'reference-data-collection',
        dataset: 'species',
        collectionId: '13caf795-a8fc-4679-bc1c-d9cc7ce62b57',
        version: '2026.09.11.1'
      },
      correlationId: '42e9acba-016e-47af-841d-903bd8e9dc36'
    })
  })

  test('rejects an unsupported outcome', () => {
    expect(() =>
      recordAuditEvent({
        eventType: 'x',
        action: 'x',
        outcome: 'not-a-real-outcome',
        actorId: 'a1',
        resource: {}
      })
    ).toThrow(/Unsupported audit outcome/)

    expect(auditMock).not.toHaveBeenCalled()
  })

  test('never accepts a raw actor object — only actorId', () => {
    recordAuditEvent({
      eventType: 'x',
      action: 'x',
      outcome: AUDIT_OUTCOMES.DENIED,
      actorId: 'actor-2',
      resource: {},
      clock: FIXED_CLOCK
    })

    const [emitted] = auditMock.mock.calls[0]
    expect(emitted.actor).toEqual({ id: 'actor-2' })
    expect(Object.keys(emitted.actor)).toEqual(['id'])
  })

  test('does not emit when auditing is disabled', () => {
    config.set('observability.auditEnabled', false)

    recordAuditEvent({
      eventType: 'x',
      action: 'x',
      outcome: AUDIT_OUTCOMES.VALIDATED,
      actorId: 'a1',
      resource: {}
    })

    expect(auditMock).not.toHaveBeenCalled()
  })

  test('isolates a delivery failure without throwing', () => {
    auditMock.mockImplementationOnce(() => {
      throw new Error('audit sink unavailable')
    })

    expect(() =>
      recordAuditEvent({
        eventType: 'x',
        action: 'x',
        outcome: AUDIT_OUTCOMES.FAILURE,
        actorId: 'a1',
        resource: {}
      })
    ).not.toThrow()
  })

  test('never includes tokens, credentials, or raw errors in the emitted event', () => {
    recordAuditEvent({
      eventType: 'reference-data.collection-replacement',
      action: 'replace-collection',
      outcome: AUDIT_OUTCOMES.FAILURE,
      actorId: 'actor-1',
      resource: { type: 'reference-data-collection', dataset: 'ports' },
      clock: FIXED_CLOCK
    })

    const serialised = JSON.stringify(auditMock.mock.calls[0][0])
    expect(serialised).not.toMatch(/token|password|secret|authorization/i)
  })
})
