/**
 * Upload contracts for full reference-data collection replacement.
 * Documentation-only shapes; upload handling is implemented by a later step.
 *
 * @typedef {Object} OptimisticConcurrencyInfo
 * @property {string} [expectedEtag] expected ETag from an `If-Match` header
 *
 * @typedef {Object} UploadCommand
 * @property {string} dataset one of the DATASETS identifiers; must be uploadable
 * @property {*} content uploaded content
 * @property {string} contentType
 * @property {string} [fileName]
 * @property {string} schemaVersion
 * @property {string} collectionVersion
 * @property {string} [effectiveFrom] ISO-8601 timestamp
 * @property {string} [description]
 * @property {boolean} [validateOnly]
 * @property {OptimisticConcurrencyInfo} [concurrency]
 * @property {string} [correlationId]
 * @property {string} [actorId] authorised actor identifier
 *
 * @typedef {Object} UploadWarning
 * @property {string} code
 * @property {string} message
 *
 * @typedef {Object} PreviousCollectionMetadata
 * @property {string} collectionId
 * @property {string} collectionVersion
 * @property {string} etag
 *
 * @typedef {Object} UploadResult
 * @property {string} dataset
 * @property {string} collectionId GUID
 * @property {string} schemaVersion
 * @property {string} collectionVersion
 * @property {string} status
 * @property {number} itemCount
 * @property {string} etag
 * @property {string} checksum
 * @property {number} sizeBytes
 * @property {string} uploadedAt ISO-8601 timestamp
 * @property {string} [actorId]
 * @property {PreviousCollectionMetadata} [previousCollection]
 * @property {UploadWarning[]} [warnings]
 */

export {}
