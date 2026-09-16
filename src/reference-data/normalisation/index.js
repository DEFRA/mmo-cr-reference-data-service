import { normaliseCollection } from './normalise-collection.js'
import {
  registerDatasetNormaliser,
  resolveDatasetNormaliser
} from './dataset-normaliser-registry.js'
import { NORMALISATION_WARNING_CODE } from './warning-codes.js'
// Side-effect import: registers the real Step 10 dataset normalisers over the identity placeholders.
import './datasets/register.js'

export {
  normaliseCollection,
  registerDatasetNormaliser,
  resolveDatasetNormaliser,
  NORMALISATION_WARNING_CODE
}

// Establishes the Data Normalisation Module boundary. Not a stateful component, so
// there is no factory/singleton composition root here — every export is a pure function.
export const normalisation = { name: 'normalisation' }
