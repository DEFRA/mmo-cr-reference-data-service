/**
 * Manifest contracts identifying the active persisted version of each authoritative dataset.
 * Documentation-only shapes; manifest read/write is implemented by a later Persistence Module step.
 *
 * @typedef {Object} ManifestDatasetEntry
 * @property {string} dataset one of the DATASETS identifiers; must be a persisted, non-derived dataset
 * @property {string} collectionId GUID identifying the active collection version
 * @property {string} schemaVersion
 * @property {string} collectionVersion
 * @property {string} format one of DATASET_FORMAT
 * @property {string} etag
 * @property {string} checksum
 * @property {number} itemCount item or feature count
 * @property {number} sizeBytes
 * @property {string} lastModifiedAt ISO-8601 timestamp
 * @property {string} [objectRef] internal persistence reference, not part of any public API projection
 *
 * @typedef {Object} Manifest
 * @property {string} manifestId GUID
 * @property {string} manifestVersion
 * @property {string} generatedAt ISO-8601 timestamp
 * @property {ManifestDatasetEntry[]} datasets entries for persisted, non-derived datasets only; map-ports must never appear here
 * @property {string} [etag]
 * @property {string} [checksum]
 */
