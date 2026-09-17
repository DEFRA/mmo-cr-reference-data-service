// Command Module use case: atomic full collection replacement (Step 22). Orchestrates
// structural/normalisation/business validation (reusing the Step 21 pipeline),
// immutable collection persistence, conditional active-manifest activation, and
// process-local in-memory publication. Never imports the AWS SDK directly (only the
// injected Persistence Module contract), never calls the Authentication Service.

import { randomUUID } from 'node:crypto'

import {
  DATASETS,
  DATASET_FORMAT,
  getDatasetCapabilities
} from '#/common/domain/datasets.js'
import { SERVICE_ERROR_CODES } from '#/common/domain/errors.js'
import { calculateChecksum } from '#/reference-data/persistence/checksum.js'
import { calculateDeterministicEtag } from '#/reference-data/query/result-etag.js'
import { validateManifest } from '#/reference-data/cache-refresh/manifest-validation.js'
import { validateCollectionUpload } from './validate-collection-upload.js'

const DEFAULT_CLOCK = { now: () => new Date().toISOString() }

function raise(code, message, { dataset, details } = {}) {
  const error = new Error(message)
  error.code = code
  error.dataset = dataset ?? null
  error.retryable = false
  if (details) {
    error.details = details
  }
  throw error
}

function countRecords(collection, format) {
  return format === DATASET_FORMAT.GEOJSON
    ? collection.features.length
    : collection.items.length
}

function stripQuotes(value) {
  return typeof value === 'string' ? value.replaceAll('"', '') : value
}

async function loadActiveManifest(persistence) {
  try {
    const { manifest, metadata } = await persistence.readManifest()
    return { manifest, etag: metadata.etag }
  } catch (cause) {
    if (cause.code === SERVICE_ERROR_CODES.DATASET_NOT_FOUND) {
      return { manifest: null, etag: null }
    }
    throw cause
  }
}

function findActiveEntry(manifest, dataset) {
  return manifest?.datasets?.find((entry) => entry.dataset === dataset) ?? null
}

function activeEntryEtag(activeEntry) {
  return calculateDeterministicEtag({
    collectionId: activeEntry.collectionId,
    version: activeEntry.version
  })
}

function enforceIfMatch({ ifMatch, activeEntry, dataset }) {
  if (ifMatch === undefined) {
    return
  }
  const expected = stripQuotes(ifMatch)
  const current = activeEntry ? stripQuotes(activeEntryEtag(activeEntry)) : null
  if (current === null || expected !== current) {
    raise(
      SERVICE_ERROR_CODES.COLLECTION_MODIFIED,
      'The active collection changed after the upload was prepared.',
      { dataset, details: [{ code: 'etag_mismatch', providedEtag: ifMatch }] }
    )
  }
}

function buildManifestEntry({
  dataset,
  schemaVersion,
  collectionVersion,
  normalised,
  writeResult,
  checksum
}) {
  const format = getDatasetCapabilities(dataset).format
  return {
    dataset,
    collectionId: normalised.collectionId,
    schemaVersion,
    version: collectionVersion,
    format,
    etag: writeResult.etag,
    checksum: writeResult.checksum ?? checksum,
    itemCount: countRecords(normalised, format),
    sizeBytes: writeResult.sizeBytes,
    lastModified: writeResult.lastModifiedAt
  }
}

// Canonical DATASETS enum order, matching in-memory-data-store.js's own determinism
// convention, rather than insertion order.
function sortManifestEntries(entries) {
  const order = Object.values(DATASETS)
  return [...entries].sort(
    (a, b) => order.indexOf(a.dataset) - order.indexOf(b.dataset)
  )
}

function buildNextManifest({
  activeManifest,
  dataset,
  newEntry,
  clock,
  manifestId
}) {
  const unrelatedEntries = (activeManifest?.datasets ?? []).filter(
    (entry) => entry.dataset !== dataset
  )
  const generatedAt = clock.now()
  return {
    manifestId: activeManifest?.manifestId ?? manifestId ?? randomUUID(),
    version: generatedAt,
    generatedAt,
    datasets: sortManifestEntries([...unrelatedEntries, newEntry])
  }
}

function toPreviousCollectionMetadata(activeEntry) {
  if (!activeEntry) {
    return undefined
  }
  return {
    collectionId: activeEntry.collectionId,
    version: activeEntry.version,
    etag: activeEntryEtag(activeEntry)
  }
}

async function publishLocally({
  store,
  dataset,
  normalised,
  newEntry,
  nextManifest
}) {
  try {
    store.setCollection(dataset, normalised, newEntry)
    store.setManifest(nextManifest)
  } catch (cause) {
    const error = new Error(
      'The collection was activated but local in-memory publication failed.'
    )
    error.code = SERVICE_ERROR_CODES.INTERNAL_ERROR
    error.dataset = dataset
    error.retryable = true
    error.partialFailure = true
    error.cause = cause
    throw error
  }
}

/**
 * @param {Object} params
 * @param {string} params.dataset
 * @param {string} params.schemaVersion
 * @param {*} params.collection raw (pre-normalisation) parsed collection content
 * @param {string} params.collectionVersion resolved upload version
 * @param {string} [params.ifMatch] optional client-supplied `If-Match` header value
 * @param {string} [params.correlationId]
 * @param {import('#/common/contracts/reference-data-repository.js')} params.persistence
 * @param {import('#/common/contracts/in-memory-data-store.js')} params.store
 * @param {{ now: () => string }} [params.clock]
 * @param {string} [params.manifestId] fallback manifest GUID used only when no active
 *   manifest exists yet (an existing manifest's own ID always takes precedence); local
 *   bootstrap uses this for a deterministic first-ever manifest identity instead of a
 *   randomly generated one.
 */
export async function replaceCollection({
  dataset,
  schemaVersion,
  collection,
  collectionVersion,
  ifMatch,
  correlationId,
  persistence,
  store,
  clock = DEFAULT_CLOCK,
  manifestId
}) {
  const validation = validateCollectionUpload({
    dataset,
    schemaVersion,
    collection,
    correlationId,
    includeNormalisedCollection: true
  })

  if (!validation.valid) {
    return {
      outcome: 'invalid',
      stage: validation.stage,
      errors: validation.errors,
      warnings: validation.warnings
    }
  }

  const normalised = validation.collection
  const { manifest: activeManifest, etag: manifestEtag } =
    await loadActiveManifest(persistence)
  const activeEntry = findActiveEntry(activeManifest, dataset)

  enforceIfMatch({ ifMatch, activeEntry, dataset })

  const checksum = calculateChecksum(JSON.stringify(normalised))

  if (activeEntry && activeEntry.version === collectionVersion) {
    if (activeEntry.checksum === checksum) {
      return {
        outcome: 'idempotent',
        dataset,
        collection: activeEntry,
        manifest: {
          manifestId: activeManifest.manifestId,
          version: activeManifest.version
        },
        warnings: validation.warnings
      }
    }
    raise(
      SERVICE_ERROR_CODES.COLLECTION_VERSION_EXISTS,
      `Collection version "${collectionVersion}" already exists for "${dataset}" with different content.`,
      { dataset }
    )
  }

  const writeResult = await persistence.writeCollection({
    dataset,
    collectionVersion,
    content: normalised
  })

  const newEntry = buildManifestEntry({
    dataset,
    schemaVersion,
    collectionVersion,
    normalised,
    writeResult,
    checksum
  })

  const nextManifest = buildNextManifest({
    activeManifest,
    dataset,
    newEntry,
    clock,
    manifestId
  })

  const manifestValidation = validateManifest(nextManifest)
  if (!manifestValidation.valid) {
    raise(
      SERVICE_ERROR_CODES.INTERNAL_ERROR,
      'The constructed manifest failed validation.',
      { dataset, details: manifestValidation.issues }
    )
  }

  // No manifest existed when this workflow started, so the final write below would
  // otherwise be unconditional (no ETag to match) — re-check immediately beforehand so
  // a concurrent "first ever manifest" creation is still detected as a conflict rather
  // than silently overwritten.
  if (
    manifestEtag === null &&
    (await persistence.objectExists({ manifest: true }))
  ) {
    raise(
      SERVICE_ERROR_CODES.COLLECTION_VERSION_EXISTS,
      'The active manifest was created concurrently by another request.',
      { dataset }
    )
  }

  await persistence.writeManifest({
    manifest: nextManifest,
    expectedEtag: manifestEtag ?? undefined
  })

  await publishLocally({ store, dataset, normalised, newEntry, nextManifest })

  return {
    outcome: 'activated',
    dataset,
    collection: newEntry,
    previousCollection: toPreviousCollectionMetadata(activeEntry),
    manifest: {
      manifestId: nextManifest.manifestId,
      version: nextManifest.version
    },
    warnings: validation.warnings
  }
}
