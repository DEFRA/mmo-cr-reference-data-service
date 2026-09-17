// Dependency Status service (Step 24). Reads state only through the existing
// Persistence Module contract and Cache Refresh Module — never a second S3,
// Floci, or Authentication Service integration point.

import { SERVICE_ERROR_CODES } from '#/common/domain/errors.js'

export const DEPENDENCY_STATUS = Object.freeze({
  OPERATIONAL: 'operational',
  DEGRADED: 'degraded',
  UNAVAILABLE: 'unavailable',
  UNKNOWN: 'unknown',
  DISABLED: 'disabled'
})

// Higher is worse; used to compute one overall status from several dependencies.
const STATUS_SEVERITY = Object.freeze({
  [DEPENDENCY_STATUS.OPERATIONAL]: 0,
  [DEPENDENCY_STATUS.DISABLED]: 0,
  [DEPENDENCY_STATUS.UNKNOWN]: 1,
  [DEPENDENCY_STATUS.DEGRADED]: 2,
  [DEPENDENCY_STATUS.UNAVAILABLE]: 3
})

const UNAVAILABLE_PERSISTENCE_CODES = new Set([
  SERVICE_ERROR_CODES.FORBIDDEN,
  SERVICE_ERROR_CODES.REFERENCE_STORE_UNAVAILABLE
])

const DEFAULT_CLOCK = { now: () => new Date().toISOString() }

function createTimeoutError() {
  return Object.assign(new Error('Dependency probe timed out'), {
    code: 'timeout'
  })
}

function withTimeout(promise, timeoutMs) {
  let timer
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(createTimeoutError()), timeoutMs)
  })
  return Promise.race([Promise.resolve(promise), timeout]).finally(() =>
    clearTimeout(timer)
  )
}

// Bounded reachability probe using the smallest existing safe Persistence
// Module operation (a HeadObject on the manifest key). Existence of the
// manifest is irrelevant here — only reachability is being classified.
async function probePersistence(persistence, timeoutMs) {
  try {
    await withTimeout(persistence.objectExists({ manifest: true }), timeoutMs)
    return {
      status: DEPENDENCY_STATUS.OPERATIONAL,
      requiredForReadiness: false
    }
  } catch (cause) {
    if (
      cause?.code === 'timeout' ||
      UNAVAILABLE_PERSISTENCE_CODES.has(cause?.code)
    ) {
      return {
        status: DEPENDENCY_STATUS.UNAVAILABLE,
        requiredForReadiness: false
      }
    }
    return { status: DEPENDENCY_STATUS.UNKNOWN, requiredForReadiness: false }
  }
}

// PROVISIONAL (matches the Step 12 provisional Authentication Service
// contract): no approved health/probe operation exists, so this stays
// passive and config-derived rather than inventing an endpoint or spending a
// real user token to determine dependency health.
function probeAuthenticationService(authenticationServiceUrl) {
  return {
    status: authenticationServiceUrl
      ? DEPENDENCY_STATUS.UNKNOWN
      : DEPENDENCY_STATUS.DISABLED,
    requiredForReadiness: false
  }
}

// Derived from the existing Cache Refresh Module readiness state (Step 11) —
// the same signal already used by GET /health/ready, not a second store scan.
function probeReferenceData(cacheRefresh, mandatoryDatasetCount) {
  const state = cacheRefresh.getReadinessState()
  const missing = state.missingMandatoryDatasets.length
  const isAvailable = state.hydrated && missing === 0
  return {
    status: isAvailable
      ? DEPENDENCY_STATUS.OPERATIONAL
      : DEPENDENCY_STATUS.UNAVAILABLE,
    requiredForReadiness: true,
    mandatoryDatasetsLoaded: mandatoryDatasetCount - missing
  }
}

function computeOverallStatus(dependencies) {
  return Object.values(dependencies).reduce(
    (worst, dependency) =>
      STATUS_SEVERITY[dependency.status] > STATUS_SEVERITY[worst]
        ? dependency.status
        : worst,
    DEPENDENCY_STATUS.OPERATIONAL
  )
}

function computeReady(dependencies) {
  return Object.values(dependencies).every(
    (dependency) =>
      !dependency.requiredForReadiness ||
      dependency.status !== DEPENDENCY_STATUS.UNAVAILABLE
  )
}

/**
 * @param {Object} options
 * @param {import('#/common/contracts/reference-data-repository.js').ReferenceDataRepository} options.persistence
 * @param {{ getReadinessState: Function }} options.cacheRefresh
 * @param {number} options.mandatoryDatasetCount
 * @param {string|null} options.authenticationServiceUrl
 * @param {number} options.probeTimeoutMs
 * @param {{ now: () => string }} [options.clock]
 */
export function createDependencyStatusService({
  persistence,
  cacheRefresh,
  mandatoryDatasetCount,
  authenticationServiceUrl,
  probeTimeoutMs,
  clock = DEFAULT_CLOCK
}) {
  async function getStatus() {
    // Only the persistence probe is genuinely asynchronous; the other two read
    // already-available in-process state, so no Promise.all() aggregation is needed.
    const referenceStore = await probePersistence(persistence, probeTimeoutMs)
    const authenticationService = probeAuthenticationService(
      authenticationServiceUrl
    )
    const referenceData = probeReferenceData(
      cacheRefresh,
      mandatoryDatasetCount
    )

    const timestamp = clock.now()
    const dependencies = {
      referenceStore: { ...referenceStore, lastCheckedAt: timestamp },
      authenticationService: {
        ...authenticationService,
        lastCheckedAt: timestamp
      },
      referenceData: { ...referenceData, lastCheckedAt: timestamp }
    }

    return {
      status: computeOverallStatus(dependencies),
      ready: computeReady(dependencies),
      timestamp,
      dependencies
    }
  }

  return { getStatus }
}
