import { config } from '#/config.js'
import { createLogger } from '#/common/helpers/logging/logger.js'
import { createReferenceDataRepository } from './reference-data-repository.js'

export { createReferenceDataRepository }

// Production composition root: builds the one repository instance from central config.
// Constructing the S3 client here performs no network call.
export const persistence = createReferenceDataRepository({
  region: config.get('aws.region'),
  endpointUrl: config.get('aws.endpointUrl'),
  forcePathStyle: config.get('aws.forcePathStyle'),
  bucket: config.get('referenceData.bucket'),
  logger: createLogger()
})
