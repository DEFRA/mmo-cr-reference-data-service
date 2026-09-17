import { describe, expect, test, vi } from 'vitest'

import {
  createDependencyStatusService,
  DEPENDENCY_STATUS
} from './dependency-status-service.js'

const FIXED_TIMESTAMP = '2026-09-17T10:00:00.000Z'
const FIXED_CLOCK = { now: () => FIXED_TIMESTAMP }

function createReadyCacheRefresh(overrides = {}) {
  return {
    getReadinessState: () => ({
      ready: true,
      hydrated: true,
      missingMandatoryDatasets: [],
      ...overrides
    })
  }
}

describe('#dependencyStatusService', () => {
  test('reports every dependency operational when all checks succeed', async () => {
    const persistence = { objectExists: vi.fn().mockResolvedValue(true) }
    const service = createDependencyStatusService({
      persistence,
      cacheRefresh: createReadyCacheRefresh(),
      mandatoryDatasetCount: 6,
      authenticationServiceUrl: 'https://auth.example',
      probeTimeoutMs: 50,
      clock: FIXED_CLOCK
    })

    const result = await service.getStatus()

    expect(result.ready).toBe(true)
    expect(result.status).toBe(DEPENDENCY_STATUS.UNKNOWN) // auth is unknown (provisional)
    expect(result.dependencies.referenceStore).toEqual({
      status: DEPENDENCY_STATUS.OPERATIONAL,
      requiredForReadiness: false,
      lastCheckedAt: FIXED_TIMESTAMP
    })
    expect(result.dependencies.referenceData).toEqual({
      status: DEPENDENCY_STATUS.OPERATIONAL,
      requiredForReadiness: true,
      mandatoryDatasetsLoaded: 6,
      lastCheckedAt: FIXED_TIMESTAMP
    })
    expect(result.timestamp).toBe(FIXED_TIMESTAMP)
  })

  test('reports disabled authentication status when no service URL is configured', async () => {
    const persistence = { objectExists: vi.fn().mockResolvedValue(true) }
    const service = createDependencyStatusService({
      persistence,
      cacheRefresh: createReadyCacheRefresh(),
      mandatoryDatasetCount: 6,
      authenticationServiceUrl: null,
      probeTimeoutMs: 50,
      clock: FIXED_CLOCK
    })

    const result = await service.getStatus()

    expect(result.dependencies.authenticationService.status).toBe(
      DEPENDENCY_STATUS.DISABLED
    )
    expect(result.dependencies.authenticationService.requiredForReadiness).toBe(
      false
    )
  })

  test('classifies a mapped forbidden/unavailable persistence error as unavailable', async () => {
    const persistence = {
      objectExists: vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error('denied'), { code: 'forbidden' })
        )
    }
    const service = createDependencyStatusService({
      persistence,
      cacheRefresh: createReadyCacheRefresh(),
      mandatoryDatasetCount: 6,
      authenticationServiceUrl: null,
      probeTimeoutMs: 50,
      clock: FIXED_CLOCK
    })

    const result = await service.getStatus()

    expect(result.dependencies.referenceStore.status).toBe(
      DEPENDENCY_STATUS.UNAVAILABLE
    )
    expect(result.dependencies.referenceStore.requiredForReadiness).toBe(false)
    // Not required for readiness, so overall readiness is unaffected.
    expect(result.ready).toBe(true)
  })

  test('classifies an unmapped persistence error as unknown', async () => {
    const persistence = {
      objectExists: vi.fn().mockRejectedValue(new Error('boom'))
    }
    const service = createDependencyStatusService({
      persistence,
      cacheRefresh: createReadyCacheRefresh(),
      mandatoryDatasetCount: 6,
      authenticationServiceUrl: null,
      probeTimeoutMs: 50,
      clock: FIXED_CLOCK
    })

    const result = await service.getStatus()

    expect(result.dependencies.referenceStore.status).toBe(
      DEPENDENCY_STATUS.UNKNOWN
    )
  })

  test('classifies a persistence probe that never resolves as unavailable via timeout', async () => {
    const persistence = {
      objectExists: vi.fn().mockReturnValue(new Promise(() => {}))
    }
    const service = createDependencyStatusService({
      persistence,
      cacheRefresh: createReadyCacheRefresh(),
      mandatoryDatasetCount: 6,
      authenticationServiceUrl: null,
      probeTimeoutMs: 10,
      clock: FIXED_CLOCK
    })

    const result = await service.getStatus()

    expect(result.dependencies.referenceStore.status).toBe(
      DEPENDENCY_STATUS.UNAVAILABLE
    )
  })

  test('marks referenceData unavailable and overall not-ready when a mandatory dataset is missing', async () => {
    const persistence = { objectExists: vi.fn().mockResolvedValue(true) }
    const service = createDependencyStatusService({
      persistence,
      cacheRefresh: createReadyCacheRefresh({
        ready: false,
        missingMandatoryDatasets: ['species']
      }),
      mandatoryDatasetCount: 6,
      authenticationServiceUrl: null,
      probeTimeoutMs: 50,
      clock: FIXED_CLOCK
    })

    const result = await service.getStatus()

    expect(result.dependencies.referenceData).toEqual({
      status: DEPENDENCY_STATUS.UNAVAILABLE,
      requiredForReadiness: true,
      mandatoryDatasetsLoaded: 5,
      lastCheckedAt: FIXED_TIMESTAMP
    })
    expect(result.ready).toBe(false)
    expect(result.status).toBe(DEPENDENCY_STATUS.UNAVAILABLE)
  })

  test('marks referenceData unavailable before startup hydration completes', async () => {
    const persistence = { objectExists: vi.fn().mockResolvedValue(true) }
    const service = createDependencyStatusService({
      persistence,
      cacheRefresh: createReadyCacheRefresh({
        ready: false,
        hydrated: false
      }),
      mandatoryDatasetCount: 6,
      authenticationServiceUrl: null,
      probeTimeoutMs: 50,
      clock: FIXED_CLOCK
    })

    const result = await service.getStatus()

    expect(result.dependencies.referenceData.status).toBe(
      DEPENDENCY_STATUS.UNAVAILABLE
    )
    expect(result.ready).toBe(false)
  })

  test('never exposes raw dependency errors, URLs, or bucket details', async () => {
    const persistence = {
      objectExists: vi.fn().mockRejectedValue(
        Object.assign(new Error('AccessDenied on bucket my-secret-bucket'), {
          code: 'forbidden'
        })
      )
    }
    const service = createDependencyStatusService({
      persistence,
      cacheRefresh: createReadyCacheRefresh(),
      mandatoryDatasetCount: 6,
      authenticationServiceUrl: 'https://internal-auth.example',
      probeTimeoutMs: 50,
      clock: FIXED_CLOCK
    })

    const result = await service.getStatus()
    const serialised = JSON.stringify(result)

    expect(serialised).not.toContain('my-secret-bucket')
    expect(serialised).not.toContain('internal-auth.example')
    expect(serialised).not.toContain('AccessDenied')
  })
})
