// The Reference Data Repository: the only component permitted to talk to S3-compatible storage.
// Implements the Step 03 contract; no AWS SDK types are exposed to callers.

import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand
} from '@aws-sdk/client-s3'

import { createReferenceDataRepositoryContract } from '#/common/contracts/reference-data-repository.js'
import {
  getDatasetCapabilities,
  DATASET_FORMAT
} from '#/common/domain/datasets.js'
import { SERVICE_ERROR_CODES } from '#/common/domain/errors.js'
import { createS3Client } from './s3-client.js'
import {
  buildCollectionObjectKey,
  buildManifestObjectKey
} from './object-keys.js'
import {
  calculateChecksum,
  CHECKSUM_ALGORITHM,
  normaliseEtag
} from './checksum.js'
import { readJsonBody } from './response-body.js'
import { mapS3Error, raisePersistenceError } from './error-mapping.js'

const HTTP_STATUS_NOT_FOUND = 404
const HTTP_STATUS_PRECONDITION_FAILED = 412

const CONTENT_TYPE_BY_FORMAT = Object.freeze({
  [DATASET_FORMAT.JSON]: 'application/json',
  [DATASET_FORMAT.GEOJSON]: 'application/geo+json'
})

function resolveContentType(dataset) {
  return CONTENT_TYPE_BY_FORMAT[getDatasetCapabilities(dataset).format]
}

function isNotFoundError(cause) {
  return (
    cause?.name === 'NotFound' ||
    cause?.$metadata?.httpStatusCode === HTTP_STATUS_NOT_FOUND
  )
}

function isPreconditionFailedError(cause) {
  return (
    cause?.name === 'PreconditionFailed' ||
    cause?.$metadata?.httpStatusCode === HTTP_STATUS_PRECONDITION_FAILED
  )
}

function toObjectMetadata({
  dataset,
  collectionVersion,
  objectKey,
  contentType,
  response,
  checksum,
  fallbackLastModifiedAt
}) {
  return {
    dataset,
    collectionVersion: collectionVersion ?? null,
    objectKey,
    format: dataset ? getDatasetCapabilities(dataset).format : null,
    contentType: response.ContentType ?? contentType ?? null,
    etag: normaliseEtag(response.ETag),
    checksum: checksum ?? response.ChecksumSHA256 ?? null,
    checksumAlgorithm: CHECKSUM_ALGORITHM,
    sizeBytes: response.ContentLength ?? null,
    // PutObject responses never include LastModified (only Get/HeadObject do) — fall
    // back to a captured upload timestamp so writeCollection/writeManifest callers
    // always get a usable value.
    lastModifiedAt: response.LastModified
      ? new Date(response.LastModified).toISOString()
      : (fallbackLastModifiedAt ?? null)
  }
}

function resolveTargetKey(target) {
  return target?.manifest
    ? buildManifestObjectKey()
    : buildCollectionObjectKey(target.dataset, target.collectionVersion)
}

function resolveTargetDataset(target) {
  return target?.manifest ? null : target.dataset
}

async function headObjectAt(s3Client, bucket, key) {
  return s3Client.send(
    new HeadObjectCommand({ Bucket: bucket, Key: key, ChecksumMode: 'ENABLED' })
  )
}

// Returns null for a confirmed-absent object; throws a mapped error for any other failure.
async function getExistingEtag(s3Client, bucket, key) {
  try {
    const response = await headObjectAt(s3Client, bucket, key)
    return normaliseEtag(response.ETag)
  } catch (cause) {
    if (isNotFoundError(cause)) {
      return null
    }
    throw mapS3Error(cause, {})
  }
}

async function fetchCollection(s3Client, bucket, dataset, collectionVersion) {
  const objectKey = buildCollectionObjectKey(dataset, collectionVersion)
  try {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        ChecksumMode: 'ENABLED'
      })
    )
    const { data, checksum } = await readJsonBody(response, dataset)
    return {
      content: data,
      metadata: toObjectMetadata({
        dataset,
        collectionVersion,
        objectKey,
        response,
        checksum: response.ChecksumSHA256 ?? checksum
      })
    }
  } catch (cause) {
    if (cause?.isServiceError) {
      throw cause
    }
    throw mapS3Error(cause, { dataset })
  }
}

function raiseCollectionVersionExists(dataset, collectionVersion, cause) {
  raisePersistenceError(
    SERVICE_ERROR_CODES.COLLECTION_VERSION_EXISTS,
    `Collection version already exists: ${dataset}/${collectionVersion}`,
    dataset,
    cause
  )
}

async function putCollection(
  s3Client,
  bucket,
  dataset,
  collectionVersion,
  content
) {
  const objectKey = buildCollectionObjectKey(dataset, collectionVersion)
  const contentType = resolveContentType(dataset)
  const body = JSON.stringify(content)

  // Floci does not enforce If-None-Match, so a pre-check guards local development;
  // the header still protects genuine concurrent writes on real AWS S3.
  const preExistingEtag = await getExistingEtag(s3Client, bucket, objectKey)
  if (preExistingEtag !== null) {
    raiseCollectionVersionExists(dataset, collectionVersion)
  }

  try {
    const uploadedAt = new Date().toISOString()
    const response = await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: body,
        ContentType: contentType,
        ChecksumAlgorithm: CHECKSUM_ALGORITHM.toUpperCase(),
        IfNoneMatch: '*'
      })
    )
    return toObjectMetadata({
      dataset,
      collectionVersion,
      objectKey,
      contentType,
      response: {
        ...response,
        ContentType: contentType,
        ContentLength: Buffer.byteLength(body)
      },
      checksum: response.ChecksumSHA256 ?? calculateChecksum(body),
      fallbackLastModifiedAt: uploadedAt
    })
  } catch (cause) {
    if (isPreconditionFailedError(cause)) {
      raiseCollectionVersionExists(dataset, collectionVersion, cause)
    }
    throw mapS3Error(cause, { dataset })
  }
}

async function fetchManifest(s3Client, bucket) {
  const objectKey = buildManifestObjectKey()
  try {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        ChecksumMode: 'ENABLED'
      })
    )
    const { data, checksum } = await readJsonBody(response, null)
    return {
      manifest: data,
      metadata: toObjectMetadata({
        dataset: null,
        objectKey,
        response,
        contentType: 'application/json',
        checksum: response.ChecksumSHA256 ?? checksum
      })
    }
  } catch (cause) {
    if (cause?.isServiceError) {
      throw cause
    }
    throw mapS3Error(cause, {})
  }
}

function raiseManifestModified(cause) {
  raisePersistenceError(
    SERVICE_ERROR_CODES.COLLECTION_MODIFIED,
    'Manifest was modified since it was last read',
    null,
    cause
  )
}

async function assertManifestNotModified(
  s3Client,
  bucket,
  objectKey,
  expectedEtag
) {
  if (expectedEtag === undefined || expectedEtag === null) {
    return
  }
  const currentEtag = await getExistingEtag(s3Client, bucket, objectKey)
  if (currentEtag !== expectedEtag) {
    raiseManifestModified()
  }
}

async function putManifest(s3Client, bucket, manifest, expectedEtag) {
  const objectKey = buildManifestObjectKey()
  const body = JSON.stringify(manifest)

  await assertManifestNotModified(s3Client, bucket, objectKey, expectedEtag)

  try {
    const uploadedAt = new Date().toISOString()
    const response = await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: body,
        ContentType: 'application/json',
        ChecksumAlgorithm: CHECKSUM_ALGORITHM.toUpperCase(),
        ...(expectedEtag ? { IfMatch: `"${expectedEtag}"` } : {})
      })
    )
    return toObjectMetadata({
      dataset: null,
      objectKey,
      response: {
        ...response,
        ContentType: 'application/json',
        ContentLength: Buffer.byteLength(body)
      },
      checksum: response.ChecksumSHA256 ?? calculateChecksum(body),
      fallbackLastModifiedAt: uploadedAt
    })
  } catch (cause) {
    if (isPreconditionFailedError(cause)) {
      raiseManifestModified(cause)
    }
    throw mapS3Error(cause, {})
  }
}

async function fetchObjectMetadata(s3Client, bucket, target) {
  const objectKey = resolveTargetKey(target)
  const dataset = resolveTargetDataset(target)
  try {
    const response = await headObjectAt(s3Client, bucket, objectKey)
    return toObjectMetadata({
      dataset,
      collectionVersion: target?.collectionVersion,
      objectKey,
      response
    })
  } catch (cause) {
    throw mapS3Error(cause, { dataset })
  }
}

async function checkObjectExists(s3Client, bucket, target) {
  const objectKey = resolveTargetKey(target)
  const dataset = resolveTargetDataset(target)
  try {
    await headObjectAt(s3Client, bucket, objectKey)
    return true
  } catch (cause) {
    if (isNotFoundError(cause)) {
      return false
    }
    throw mapS3Error(cause, { dataset })
  }
}

/**
 * @param {Object} [options]
 * @param {string} [options.region]
 * @param {string} [options.endpointUrl]
 * @param {boolean} [options.forcePathStyle]
 * @param {string} options.bucket
 * @param {Object} [options.client] injected S3 client (test double or adapter)
 */
export function createReferenceDataRepository({
  region,
  endpointUrl,
  forcePathStyle,
  bucket,
  client
} = {}) {
  const s3Client = createS3Client({
    region,
    endpointUrl,
    forcePathStyle,
    client
  })

  return createReferenceDataRepositoryContract({
    readCollection: ({ dataset, collectionVersion }) =>
      fetchCollection(s3Client, bucket, dataset, collectionVersion),
    writeCollection: ({ dataset, collectionVersion, content }) =>
      putCollection(s3Client, bucket, dataset, collectionVersion, content),
    readManifest: () => fetchManifest(s3Client, bucket),
    writeManifest: ({ manifest, expectedEtag } = {}) =>
      putManifest(s3Client, bucket, manifest, expectedEtag),
    getObjectMetadata: (target) =>
      fetchObjectMetadata(s3Client, bucket, target),
    objectExists: (target) => checkObjectExists(s3Client, bucket, target)
  })
}
