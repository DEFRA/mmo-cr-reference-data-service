// Side-effect import: registers the real Step 10 dataset normalisers over the identity placeholders.
import './datasets/register.js'

export { normaliseCollection } from './normalise-collection.js'
export {
  registerDatasetNormaliser,
  resolveDatasetNormaliser
} from './dataset-normaliser-registry.js'
export { NORMALISATION_WARNING_CODE } from './warning-codes.js'

// Establishes the Data Normalisation Module boundary. Not a stateful component, so
// there is no factory/singleton composition root here — every export is a pure function.
export const normalisation = { name: 'normalisation' }
