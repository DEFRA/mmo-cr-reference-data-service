// Administrative audit-event abstraction (Step 25). Wraps the existing, previously
// unused `@defra/cdp-auditing` dependency (writes a `log.level: "audit"` line that the
// CDP platform's FluentBit sidecar routes to a separate audit stream; prints to
// console locally). No second audit sink is introduced.

import { audit } from '@defra/cdp-auditing'

import { config } from '#/config.js'
import { createLogger } from '#/common/helpers/logging/logger.js'
import { LOG_EVENTS } from '#/common/domain/log-events.js'

export const AUDIT_OUTCOMES = Object.freeze({
  SUCCESS: 'success',
  FAILURE: 'failure',
  DENIED: 'denied',
  CONFLICT: 'conflict',
  VALIDATED: 'validated',
  IDEMPOTENT: 'idempotent',
  PARTIAL_FAILURE: 'partial-failure'
})

const VALID_OUTCOMES = new Set(Object.values(AUDIT_OUTCOMES))
const DEFAULT_CLOCK = { now: () => new Date().toISOString() }

function assertValidOutcome(outcome) {
  if (!VALID_OUTCOMES.has(outcome)) {
    throw new Error(`Unsupported audit outcome: ${outcome}`)
  }
}

function isEnabled() {
  return config.get('observability.auditEnabled')
}

/**
 * Records one administrative audit event. `actorId` is the ONLY accepted actor
 * input — deliberately not an `actor` object — so a caller cannot pass arbitrary
 * authentication claims even by mistake; it must come from the already-authenticated
 * request context.
 *
 * @param {Object} params
 * @param {string} params.eventType stable event type, e.g. `reference-data.collection-replacement`
 * @param {string} params.action e.g. `replace-collection`
 * @param {'success'|'failure'|'denied'|'conflict'|'validated'|'idempotent'|'partial-failure'} params.outcome
 * @param {string} params.actorId authenticated actor identifier
 * @param {Object} params.resource safe, non-sensitive resource description
 * @param {string} [params.correlationId]
 * @param {{ now: () => string }} [params.clock]
 */
export function recordAuditEvent({
  eventType,
  action,
  outcome,
  actorId,
  resource,
  correlationId,
  clock = DEFAULT_CLOCK
}) {
  assertValidOutcome(outcome)

  if (!isEnabled()) {
    return
  }

  const event = {
    eventType,
    occurredAt: clock.now(),
    action,
    outcome,
    actor: { id: actorId },
    resource,
    correlationId
  }

  try {
    audit(event)
  } catch (cause) {
    createLogger().error(
      {
        err: cause,
        event: LOG_EVENTS.AUDIT_DELIVERY_FAILED,
        eventType,
        action
      },
      'audit: failed to record audit event'
    )
  }
}
