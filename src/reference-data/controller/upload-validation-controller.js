// Reference Data Controller: full collection upload validation-only mode (Step 21) and
// atomic full collection replacement (Step 22). Owns Hapi request/response mapping
// only — authenticates/authorises through the injected Validation Module client, and
// delegates all validation/normalisation/persistence/activation coordination to the
// Command Module. Never accesses S3/Floci directly, never updates the In-Memory Data
// Store directly, never triggers cache refresh.

import { CACHE_CONTROL } from '#/common/helpers/api/cache-control.js'
import {
  DATASET_FORMAT,
  getDatasetCapabilities
} from '#/common/domain/datasets.js'
import { SERVICE_ERROR_CODES } from '#/common/domain/errors.js'
import { LOG_EVENTS } from '#/common/domain/log-events.js'
import { createLogger } from '#/common/helpers/logging/logger.js'
import {
  recordCounter,
  recordDuration,
  METRIC_NAMES
} from '#/common/helpers/observability/metrics.js'
import {
  recordAuditEvent,
  AUDIT_OUTCOMES
} from '#/common/helpers/observability/audit.js'
import {
  extractSingleUploadedFile,
  parseUploadedFileContent,
  resolveUploadMetadata,
  validateCollectionUpload,
  replaceCollection
} from '#/reference-data/command/index.js'
import { PROCESSING_STAGE } from '#/reference-data/cache-refresh/dataset-processing.js'
import { calculateDeterministicEtag } from '#/reference-data/query/result-etag.js'
import { requireWriteAccess } from './write-access.js'

const HTTP_STATUS_OK = 200
const DEFAULT_CLOCK = { now: () => new Date().toISOString() }
const logger = createLogger()

const AUDIT_EVENT_TYPES = Object.freeze({
  VALIDATION_UPLOAD: 'reference-data.validation-upload',
  COLLECTION_REPLACEMENT: 'reference-data.collection-replacement'
})

function buildResource(dataset, extra) {
  return { type: 'reference-data-collection', dataset, ...extra }
}

function raiseValidationFailure({ dataset, stage, errors }) {
  const error = new Error(
    `The uploaded ${dataset} collection contains validation errors.`
  )
  error.code =
    stage === PROCESSING_STAGE.STRUCTURAL_VALIDATION
      ? SERVICE_ERROR_CODES.SCHEMA_VALIDATION_FAILED
      : SERVICE_ERROR_CODES.BUSINESS_VALIDATION_FAILED
  error.dataset = dataset
  error.retryable = false
  error.details = errors
  throw error
}

function countKeysFor(dataset) {
  return getDatasetCapabilities(dataset).format === DATASET_FORMAT.GEOJSON
    ? {
        receivedFeatureCount: 'receivedCount',
        normalisedFeatureCount: 'normalisedCount'
      }
    : {
        receivedItemCount: 'receivedCount',
        normalisedItemCount: 'normalisedCount'
      }
}

function buildValidationSuccessBody({ dataset, result, metadata }) {
  const counts = Object.fromEntries(
    Object.entries(countKeysFor(dataset)).map(([publicKey, resultKey]) => [
      publicKey,
      result[resultKey]
    ])
  )

  return {
    dataset,
    valid: true,
    schemaVersion: metadata.schemaVersion,
    version: metadata.version,
    ...counts,
    changed: result.changed,
    warnings: result.warnings
  }
}

function buildReplacementSuccessBody({ dataset, replacement }) {
  const base = {
    dataset,
    collectionId: replacement.collection.collectionId,
    schemaVersion: replacement.collection.schemaVersion,
    version: replacement.collection.version,
    status: 'active',
    itemCount: replacement.collection.itemCount,
    etag: replacement.collection.etag,
    checksum: replacement.collection.checksum,
    sizeBytes: replacement.collection.sizeBytes,
    manifest: replacement.manifest,
    warnings: replacement.warnings
  }

  if (replacement.outcome === 'idempotent') {
    return { ...base, idempotent: true }
  }

  return {
    ...base,
    ...(replacement.previousCollection
      ? { previousCollection: replacement.previousCollection }
      : {})
  }
}

function parseIfMatch(headerValue) {
  return typeof headerValue === 'string' ? headerValue.trim() : undefined
}

function isFullReplacement(query) {
  return query.validateOnly !== 'true'
}

/**
 * @param {{ authenticationClient: import('#/common/contracts/authentication-client.js').AuthenticationClient, persistence?: import('#/common/contracts/reference-data-repository.js'), store?: import('#/common/contracts/in-memory-data-store.js'), clock?: { now: () => string } }} deps
 */
export function createUploadValidationController({
  authenticationClient,
  persistence,
  store,
  clock = DEFAULT_CLOCK
}) {
  async function handler(request, h) {
    const { dataset } = request.params
    const actor = await requireWriteAccess(request, authenticationClient)

    const file = extractSingleUploadedFile(request.payload)
    const collection = parseUploadedFileContent({ dataset, file })
    const metadata = resolveUploadMetadata({
      fields: {
        schemaVersion: request.payload.schemaVersion,
        version: request.payload.version,
        effectiveFrom: request.payload.effectiveFrom,
        description: request.payload.description
      },
      collection
    })
    const correlationId = request.app.correlationId

    if (!isFullReplacement(request.query)) {
      const startedAt = Date.now()
      logger.info(
        { event: LOG_EVENTS.VALIDATION_UPLOAD_STARTED, correlationId, dataset },
        'validation-upload: started'
      )

      const result = validateCollectionUpload({
        dataset,
        schemaVersion: metadata.schemaVersion,
        collection,
        correlationId
      })
      const durationMillis = Date.now() - startedAt

      if (!result.valid) {
        logger.warn(
          {
            event: LOG_EVENTS.VALIDATION_UPLOAD_FAILED,
            correlationId,
            dataset,
            failureStage: result.stage,
            durationMs: durationMillis
          },
          'validation-upload: failed'
        )
        recordCounter(METRIC_NAMES.VALIDATION_UPLOAD_FAILURES_TOTAL, 1, {
          dataset
        })
        recordDuration(
          METRIC_NAMES.VALIDATION_UPLOAD_DURATION_MS,
          durationMillis,
          {
            dataset
          }
        )
        recordAuditEvent({
          eventType: AUDIT_EVENT_TYPES.VALIDATION_UPLOAD,
          action: 'validate-collection',
          outcome: AUDIT_OUTCOMES.FAILURE,
          actorId: actor.actorId,
          resource: buildResource(dataset),
          correlationId
        })
        raiseValidationFailure({
          dataset,
          stage: result.stage,
          errors: result.errors
        })
      }

      logger.info(
        {
          event: LOG_EVENTS.VALIDATION_UPLOAD_COMPLETED,
          correlationId,
          dataset,
          warningCount: result.warnings.length,
          durationMs: durationMillis
        },
        'validation-upload: completed'
      )
      recordDuration(
        METRIC_NAMES.VALIDATION_UPLOAD_DURATION_MS,
        durationMillis,
        {
          dataset
        }
      )
      recordAuditEvent({
        eventType: AUDIT_EVENT_TYPES.VALIDATION_UPLOAD,
        action: 'validate-collection',
        outcome: AUDIT_OUTCOMES.VALIDATED,
        actorId: actor.actorId,
        resource: buildResource(dataset),
        correlationId
      })

      return h
        .response(buildValidationSuccessBody({ dataset, result, metadata }))
        .code(HTTP_STATUS_OK)
        .header('Cache-Control', CACHE_CONTROL.NO_STORE)
    }

    const replacementStartedAt = Date.now()
    logger.info(
      {
        event: LOG_EVENTS.COLLECTION_REPLACEMENT_STARTED,
        correlationId,
        dataset
      },
      'collection-replacement: started'
    )

    let replacement
    try {
      replacement = await replaceCollection({
        dataset,
        schemaVersion: metadata.schemaVersion,
        collection,
        collectionVersion: metadata.version,
        ifMatch: parseIfMatch(request.headers['if-match']),
        correlationId,
        persistence,
        store,
        clock,
        actorId: actor.actorId
      })
    } catch (cause) {
      const replacementDurationMs = Date.now() - replacementStartedAt
      const isConflict =
        cause.code === SERVICE_ERROR_CODES.COLLECTION_VERSION_EXISTS ||
        cause.code === SERVICE_ERROR_CODES.COLLECTION_MODIFIED
      const outcome = cause.partialFailure
        ? AUDIT_OUTCOMES.PARTIAL_FAILURE
        : isConflict
          ? AUDIT_OUTCOMES.CONFLICT
          : AUDIT_OUTCOMES.FAILURE
      const event = cause.partialFailure
        ? LOG_EVENTS.COLLECTION_REPLACEMENT_PARTIAL_FAILURE
        : isConflict
          ? LOG_EVENTS.COLLECTION_REPLACEMENT_CONFLICTED
          : LOG_EVENTS.COLLECTION_REPLACEMENT_FAILED
      logger[cause.partialFailure ? 'error' : 'warn'](
        {
          event,
          correlationId,
          dataset,
          errorCode: cause.code,
          durationMs: replacementDurationMs
        },
        'collection-replacement: failed'
      )
      recordCounter(METRIC_NAMES.COLLECTION_REPLACEMENT_FAILURES_TOTAL, 1, {
        dataset
      })
      recordDuration(
        METRIC_NAMES.COLLECTION_REPLACEMENT_DURATION_MS,
        replacementDurationMs,
        { dataset }
      )
      recordAuditEvent({
        eventType: AUDIT_EVENT_TYPES.COLLECTION_REPLACEMENT,
        action: 'replace-collection',
        outcome,
        actorId: actor.actorId,
        resource: buildResource(dataset),
        correlationId
      })
      throw cause
    }

    const replacementDurationMs = Date.now() - replacementStartedAt

    if (replacement.outcome === 'invalid') {
      logger.warn(
        {
          event: LOG_EVENTS.COLLECTION_REPLACEMENT_FAILED,
          correlationId,
          dataset,
          failureStage: replacement.stage,
          durationMs: replacementDurationMs
        },
        'collection-replacement: failed'
      )
      recordCounter(METRIC_NAMES.COLLECTION_REPLACEMENT_FAILURES_TOTAL, 1, {
        dataset
      })
      recordDuration(
        METRIC_NAMES.COLLECTION_REPLACEMENT_DURATION_MS,
        replacementDurationMs,
        { dataset }
      )
      recordAuditEvent({
        eventType: AUDIT_EVENT_TYPES.COLLECTION_REPLACEMENT,
        action: 'replace-collection',
        outcome: AUDIT_OUTCOMES.FAILURE,
        actorId: actor.actorId,
        resource: buildResource(dataset),
        correlationId
      })
      raiseValidationFailure({
        dataset,
        stage: replacement.stage,
        errors: replacement.errors
      })
    }

    const completedEvent =
      replacement.outcome === 'idempotent'
        ? LOG_EVENTS.COLLECTION_REPLACEMENT_IDEMPOTENT
        : LOG_EVENTS.COLLECTION_REPLACEMENT_COMPLETED
    logger.info(
      {
        event: completedEvent,
        correlationId,
        dataset,
        version: replacement.collection.version,
        idempotent: replacement.outcome === 'idempotent',
        durationMs: replacementDurationMs
      },
      'collection-replacement: completed'
    )
    recordDuration(
      METRIC_NAMES.COLLECTION_REPLACEMENT_DURATION_MS,
      replacementDurationMs,
      { dataset }
    )
    recordAuditEvent({
      eventType: AUDIT_EVENT_TYPES.COLLECTION_REPLACEMENT,
      action: 'replace-collection',
      outcome:
        replacement.outcome === 'idempotent'
          ? AUDIT_OUTCOMES.IDEMPOTENT
          : AUDIT_OUTCOMES.SUCCESS,
      actorId: actor.actorId,
      resource: buildResource(dataset, {
        collectionId: replacement.collection.collectionId,
        version: replacement.collection.version,
        previousCollectionId: replacement.previousCollection?.collectionId,
        previousVersion: replacement.previousCollection?.version,
        manifestVersion: replacement.manifest.version
      }),
      correlationId
    })

    return h
      .response(buildReplacementSuccessBody({ dataset, replacement }))
      .code(HTTP_STATUS_OK)
      .header('Cache-Control', CACHE_CONTROL.NO_STORE)
      .header(
        'ETag',
        calculateDeterministicEtag({
          collectionId: replacement.collection.collectionId,
          version: replacement.collection.version
        })
      )
  }

  return { handler }
}
