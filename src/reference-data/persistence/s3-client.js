// The only file in the repository that constructs an S3 client. No network call happens here.

import { S3Client } from '@aws-sdk/client-s3'

/**
 * @param {Object} [options]
 * @param {string} [options.region]
 * @param {string} [options.endpointUrl] optional S3-compatible endpoint override (e.g. Floci)
 * @param {boolean} [options.forcePathStyle]
 * @param {Object} [options.client] an injected test/adapter client, returned as-is when supplied
 */
export function createS3Client({
  region,
  endpointUrl,
  forcePathStyle,
  client
} = {}) {
  if (client) {
    return client
  }

  return new S3Client({
    region,
    ...(endpointUrl ? { endpoint: endpointUrl } : {}),
    forcePathStyle: Boolean(forcePathStyle)
  })
}
