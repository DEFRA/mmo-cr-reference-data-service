/**
 * Shared collection contracts. Documentation-only shapes; canonical dataset
 * schemas are defined in a later step.
 *
 * @typedef {null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }} JsonValue
 *
 * @typedef {Object} CollectionEnvelope
 * @property {string} dataset one of the DATASETS identifiers
 * @property {string} collectionId GUID identifying this collection version
 * @property {string} schemaVersion
 * @property {string} collectionVersion
 * @property {string} generatedAt ISO-8601 timestamp
 * @property {string} [effectiveFrom] optional ISO-8601 timestamp
 * @property {number} itemCount item or feature count
 * @property {JsonValue} content complete JSON or GeoJSON collection content
 *
 * @typedef {Object} CollectionMetadata
 * @property {string} dataset
 * @property {string} collectionId
 * @property {string} schemaVersion
 * @property {string} collectionVersion
 * @property {string} format one of DATASET_FORMAT
 * @property {number} itemCount
 * @property {string} etag
 * @property {string} checksum
 * @property {number} sizeBytes
 * @property {string} lastModifiedAt ISO-8601 timestamp
 * @property {string} [uploadedAt] ISO-8601 timestamp, when available
 * @property {string} [actorId] audit reference, when available
 * @property {string} [objectRef] internal persistence reference, not part of any public API projection
 * @property {boolean} [active]
 */

export {}
