// Establishes the Command Module boundary; full collection replacement (persistence,
// manifest activation, in-memory publication) is added in a later step.
export const command = { name: 'command' }

export {
  extractSingleUploadedFile,
  parseUploadedFileContent,
  resolveUploadMetadata
} from './upload-request.js'
export { validateCollectionUpload } from './validate-collection-upload.js'
export { replaceCollection } from './replace-collection.js'
export {
  bootstrapLocalReferenceData,
  SEED_MANIFEST_ID,
  SEED_SCHEMA_VERSION,
  SEED_TIMESTAMP
} from './bootstrap-local-reference-data.js'
export {
  loadSeedCollection,
  getSeedFilePath,
  SEED_DATASET_ORDER
} from './seed-loader.js'
