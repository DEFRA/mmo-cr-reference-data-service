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

const CONTENT_TYPE_BY_FORMAT = Object.freeze({
  [DATASET_FORMAT.JSON]: 'application/json',
  [DATASET_FORMAT.GEOJSON]: 'application/geo+json'
})

function resolveContentType(dataset) {
  return CONTENT_TYPE_BY_FORMAT[getDatasetCapabilities(dataset).format]
}

function toObjectMetadata({
  dataset,
  collectionVersion,
  objectKey,
  contentType,
  response,
  checksum
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
    lastModifiedAt: response.LastModified
      ? new Date(response.LastModified).toISOString()
      : null
  }
}

function resolveTargetKey(target) {
  return target?.manifest
    ? buildManifestObjectKey()
    : buildCollectionObjectKey(target.dataset, target.collectionVersion)
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

  async function headObject(key) {
    return s3Client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
        ChecksumMode: 'ENABLED'
      })
    )
  }

  async function existingEtag(key) {
    try {
      const response = await headObject(key)
      return normaliseEtag(response.ETag)
    } catch (cause) {
      if (
        cause?.name === 'NotFound' ||
        cause?.$metadata?.httpStatusCode === 404
      ) {
        return null
      }
      throw mapS3Error(cause, {})
    }
  }

  async function readCollection({ dataset, collectionVersion }) {
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

  async function writeCollection({ dataset, collectionVersion, content }) {
    const objectKey = buildCollectionObjectKey(dataset, collectionVersion)
    const contentType = resolveContentType(dataset)
    const body = JSON.stringify(content)

    // Floci does not enforce If-None-Match, so a pre-check guards local development;
    // the header still protects genuine concurrent writes on real AWS S3.
    const preExistingEtag = await existingEtag(objectKey)
    if (preExistingEtag !== null) {
      raisePersistenceError(
        SERVICE_ERROR_CODES.COLLECTION_VERSION_EXISTS,
        `Collection version already exists: ${dataset}/${collectionVersion}`,
        dataset
      )
    }

    try {
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
        checksum: response.ChecksumSHA256 ?? calculateChecksum(body)
      })
    } catch (cause) {
      if (
        cause?.name === 'PreconditionFailed' ||
        cause?.$metadata?.httpStatusCode === 412
      ) {
        raisePersistenceError(
          SERVICE_ERROR_CODES.COLLECTION_VERSION_EXISTS,
          `Collection version already exists: ${dataset}/${collectionVersion}`,
          dataset,
          cause
        )
      }
      throw mapS3Error(cause, { dataset })
    }
  }

  async function readManifest() {
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

  async function writeManifest({ manifest, expectedEtag } = {}) {
    const objectKey = buildManifestObjectKey()
    const body = JSON.stringify(manifest)

    if (expectedEtag !== undefined && expectedEtag !== null) {
      const currentEtag = await existingEtag(objectKey)
      if (currentEtag !== expectedEtag) {
        raisePersistenceError(
          SERVICE_ERROR_CODES.COLLECTION_MODIFIED,
          'Manifest was modified since it was last read',
          null
        )
      }
    }

    try {
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
        checksum: response.ChecksumSHA256 ?? calculateChecksum(body)
      })
    } catch (cause) {
      if (
        cause?.name === 'PreconditionFailed' ||
        cause?.$metadata?.httpStatusCode === 412
      ) {
        raisePersistenceError(
          SERVICE_ERROR_CODES.COLLECTION_MODIFIED,
          'Manifest was modified since it was last read',
          null,
          cause
        )
      }
      throw mapS3Error(cause, {})
    }
  }

  async function getObjectMetadata(target) {
    const objectKey = resolveTargetKey(target)
    const dataset = target?.manifest ? null : target.dataset
    try {
      const response = await headObject(objectKey)
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

  async function objectExists(target) {
    const objectKey = resolveTargetKey(target)
    const dataset = target?.manifest ? null : target.dataset
    try {
      await headObject(objectKey)
      return true
    } catch (cause) {
      if (
        cause?.name === 'NotFound' ||
        cause?.$metadata?.httpStatusCode === 404
      ) {
        return false
      }
      throw mapS3Error(cause, { dataset })
    }
  }

  return createReferenceDataRepositoryContract({
    readCollection,
    writeCollection,
    readManifest,
    writeManifest,
    getObjectMetadata,
    objectExists
  })
}
