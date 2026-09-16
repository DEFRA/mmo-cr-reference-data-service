/**
 * Query contracts for retrieving and searching reference-data collections.
 * Documentation-only shapes; query behaviour is implemented by a later step.
 *
 * @typedef {Object} PaginationRequest
 * @property {number} [offset]
 * @property {number} [limit]
 *
 * @typedef {Object} SortingRequest
 * @property {string} [field]
 * @property {'asc' | 'desc'} [direction]
 *
 * @typedef {Object} QueryFilters
 * @property {string} [freeTextQuery]
 * @property {string} [businessCode]
 * @property {string[]} [ids] multiple GUIDs
 * @property {string[]} [businessCodes] multiple business codes
 * @property {boolean} [includeInactive]
 * @property {Object.<string, *>} [datasetSpecificFilters]
 *
 * @typedef {Object} QueryRequest
 * @property {string} dataset one of the DATASETS identifiers
 * @property {string} representation one of the REPRESENTATIONS identifiers
 * @property {QueryFilters} [filters]
 * @property {PaginationRequest} [pagination]
 * @property {SortingRequest} [sorting]
 * @property {string} [correlationId]
 *
 * @typedef {Object} QueryMetadata
 * @property {string} [correlationId]
 *
 * @typedef {Object} QueryResult
 * @property {string} dataset
 * @property {string} collectionId GUID
 * @property {string} collectionVersion
 * @property {string} representation
 * @property {number} totalCount
 * @property {number} [offset]
 * @property {number} [limit]
 * @property {*[]} items returned items or features
 * @property {QueryMetadata} [context]
 */

export {}
