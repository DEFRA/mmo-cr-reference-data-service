// Concrete In-Memory Data Store: a process-local cache, not a database.
// Durable persistence and cache-refresh orchestration are owned by later steps.

import { createInMemoryDataStoreContract } from '#/common/contracts/in-memory-data-store.js'
import {
  DATASETS,
  isSupportedDataset,
  isDerivedDataset
} from '#/common/domain/datasets.js'
import { SERVICE_ERROR_CODES } from '#/common/domain/errors.js'

function raiseStoreError(code, message, dataset, cause) {
  const error = new Error(message)
  error.code = code
  error.dataset = dataset ?? null
  error.retryable = false
  if (cause) {
    error.cause = cause
  }
  throw error
}

function assertSupportedDataset(dataset) {
  if (!isSupportedDataset(dataset)) {
    raiseStoreError(
      SERVICE_ERROR_CODES.INVALID_DATASET,
      `Unsupported dataset: ${dataset}`,
      dataset
    )
  }
}

function assertStorableDataset(dataset) {
  assertSupportedDataset(dataset)
  if (isDerivedDataset(dataset)) {
    raiseStoreError(
      SERVICE_ERROR_CODES.INVALID_DATASET,
      `${dataset} is derived and cannot be stored independently`,
      dataset
    )
  }
}

// structuredClone gives deep, type-preserving defensive copies without JSON round-tripping (Node >=24).
function cloneOrThrow(value, label, dataset) {
  try {
    return structuredClone(value)
  } catch (cause) {
    return raiseStoreError(
      SERVICE_ERROR_CODES.INVALID_REQUEST,
      `Unable to store ${label}: value is not cloneable`,
      dataset,
      cause
    )
  }
}

function assertValidCollectionInput(dataset, collection, metadata) {
  if (collection === undefined || metadata === undefined) {
    raiseStoreError(
      SERVICE_ERROR_CODES.INVALID_REQUEST,
      'A collection and its metadata are both required',
      dataset
    )
  }
  if (metadata?.dataset !== undefined && metadata.dataset !== dataset) {
    raiseStoreError(
      SERVICE_ERROR_CODES.INVALID_REQUEST,
      `Collection metadata dataset "${metadata.dataset}" does not match "${dataset}"`,
      dataset
    )
  }
}

// Validates and clones before returning, so a failed clone never leaves a partially prepared entry.
function prepareCollectionEntry(dataset, collection, metadata) {
  assertValidCollectionInput(dataset, collection, metadata)
  return {
    collection: cloneOrThrow(collection, 'collection', dataset),
    metadata: cloneOrThrow(metadata, 'collection metadata', dataset)
  }
}

function prepareManifest(nextManifest) {
  if (nextManifest === undefined) {
    raiseStoreError(
      SERVICE_ERROR_CODES.INVALID_REQUEST,
      'A manifest is required',
      null
    )
  }
  return cloneOrThrow(nextManifest, 'manifest', null)
}

function getEntry(collections, dataset) {
  assertSupportedDataset(dataset)
  return collections.get(dataset)
}

/**
 * Creates an isolated In-Memory Data Store instance implementing the Step 03 contract.
 */
export function createInMemoryDataStore() {
  const collections = new Map()
  let manifest = null

  function setCollection(dataset, collection, metadata) {
    assertStorableDataset(dataset)
    const entry = prepareCollectionEntry(dataset, collection, metadata)
    // Preparation succeeds before the map is mutated, so a failed replacement leaves the previous entry intact.
    collections.set(dataset, entry)
  }

  function getCollection(dataset) {
    const entry = getEntry(collections, dataset)
    return entry ? structuredClone(entry.collection) : undefined
  }

  function getCollectionMetadata(dataset) {
    const entry = getEntry(collections, dataset)
    return entry ? structuredClone(entry.metadata) : undefined
  }

  function hasCollection(dataset) {
    assertSupportedDataset(dataset)
    return collections.has(dataset)
  }

  function listLoadedDatasets() {
    // Filters the canonical Step 03 dataset order rather than Map insertion order, which is not a documented guarantee.
    return Object.values(DATASETS).filter((dataset) => collections.has(dataset))
  }

  function removeCollection(dataset) {
    assertSupportedDataset(dataset)
    return collections.delete(dataset)
  }

  function setManifest(nextManifest) {
    manifest = prepareManifest(nextManifest)
  }

  function getManifest() {
    return manifest === null ? null : structuredClone(manifest)
  }

  function clear() {
    collections.clear()
    manifest = null
  }

  return createInMemoryDataStoreContract({
    setCollection,
    getCollection,
    getCollectionMetadata,
    hasCollection,
    listLoadedDatasets,
    removeCollection,
    setManifest,
    getManifest,
    clear
  })
}
