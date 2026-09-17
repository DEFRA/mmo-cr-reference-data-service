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
      const result = validateCollectionUpload({
        dataset,
        schemaVersion: metadata.schemaVersion,
        collection,
        correlationId
      })

      if (!result.valid) {
        raiseValidationFailure({
          dataset,
          stage: result.stage,
          errors: result.errors
        })
      }

      return h
        .response(buildValidationSuccessBody({ dataset, result, metadata }))
        .code(HTTP_STATUS_OK)
        .header('Cache-Control', CACHE_CONTROL.NO_STORE)
    }

    const replacement = await replaceCollection({
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

    if (replacement.outcome === 'invalid') {
      raiseValidationFailure({
        dataset,
        stage: replacement.stage,
        errors: replacement.errors
      })
    }

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
