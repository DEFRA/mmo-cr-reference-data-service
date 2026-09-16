// Side-effect import: registers the real Step 09 dataset validators over the Step 08 placeholders.
import './datasets/register.js'

export { validateCollection } from './validate-collection.js'
export {
  registerDatasetBusinessValidator,
  resolveDatasetBusinessValidator
} from './dataset-validator-registry.js'
export { VALIDATION_ISSUE_CODE } from './error-codes.js'

// Establishes the Validation Module boundary; the sole future integration point with
// the Authentication Service (Step 12). Not a stateful component, so there is no
// factory/singleton composition root here — every export is a pure function.
export const validation = { name: 'validation' }
