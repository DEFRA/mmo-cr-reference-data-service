// Centralised, safe object-key construction for the Persistence Module. Callers never supply raw keys.

import {
  isPersistedDataset,
  isSupportedDataset
} from '#/common/domain/datasets.js'
import { SERVICE_ERROR_CODES } from '#/common/domain/errors.js'
import { raisePersistenceError } from './error-mapping.js'

export const REFERENCE_DATA_PREFIX = 'reference-data'
export const MANIFEST_OBJECT_KEY = `${REFERENCE_DATA_PREFIX}/manifest.json`

// Deliberately restrictive: no separators, traversal, whitespace, or URL-like content can reach an object key.
const SAFE_COLLECTION_VERSION_PATTERN = /^[A-Za-z0-9._-]+$/

function assertPersistedDataset(dataset) {
  if (!isSupportedDataset(dataset) || !isPersistedDataset(dataset)) {
    raisePersistenceError(
      SERVICE_ERROR_CODES.INVALID_DATASET,
      `${dataset} is not a persisted reference-data dataset`,
      dataset
    )
  }
}

function assertSafeCollectionVersion(collectionVersion, dataset) {
  if (
    typeof collectionVersion !== 'string' ||
    collectionVersion === '' ||
    collectionVersion === '.' ||
    collectionVersion === '..' ||
    !SAFE_COLLECTION_VERSION_PATTERN.test(collectionVersion)
  ) {
    raisePersistenceError(
      SERVICE_ERROR_CODES.INVALID_REQUEST,
      `Invalid collection version: ${JSON.stringify(collectionVersion)}`,
      dataset
    )
  }
}

export function buildManifestObjectKey() {
  return MANIFEST_OBJECT_KEY
}

export function buildCollectionObjectKey(dataset, collectionVersion) {
  assertPersistedDataset(dataset)
  assertSafeCollectionVersion(collectionVersion, dataset)
  return `${REFERENCE_DATA_PREFIX}/${dataset}/${collectionVersion}.json`
}
