// Side-effect import: registers the real Step 09 dataset validators over the Step 08 placeholders.
import './datasets/register.js'

import { config } from '#/config.js'
import { createHttpAuthenticationClient } from './authentication/http-authentication-client.js'

export { validateCollection } from './validate-collection.js'
export {
  registerDatasetBusinessValidator,
  resolveDatasetBusinessValidator
} from './dataset-validator-registry.js'
export { VALIDATION_ISSUE_CODE } from './error-codes.js'
export { createHttpAuthenticationClient } from './authentication/http-authentication-client.js'
export { createTestAuthenticationClient } from './authentication/test-authentication-client.js'
export {
  authorize,
  hasExactPermission,
  requireAuthenticatedActor,
  requirePermission,
  requireReadPermission,
  requireWritePermission
} from './authentication/permission-check.js'

// Production composition root for Authentication Service access (Step 12); the sole
// component permitted to construct this concrete client. Constructing it performs
// no network call — every request is only made when authenticate() is invoked.
export const authenticationClient = createHttpAuthenticationClient({
  baseUrl: config.get('authentication.serviceUrl'),
  timeoutMs: config.get('authentication.timeoutMs'),
  retryCount: config.get('authentication.retryCount'),
  retryDelayMs: config.get('authentication.retryDelayMs'),
  tracingHeader: config.get('tracing.header')
})

// Establishes the Validation Module boundary; the sole future integration point with
// the Authentication Service (Step 12). Not a stateful component, so there is no
// factory/singleton composition root here — every export is a pure function.
export const validation = { name: 'validation' }
