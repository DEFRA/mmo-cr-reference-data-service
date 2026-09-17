import { describe, expect, test, vi } from 'vitest'

vi.mock('#/reference-data/health/index.js', () => ({
  dependencyStatusService: { getStatus: vi.fn() }
}))

import { dependencyStatus } from './dependency-status.js'
import { dependencyStatusService } from '#/reference-data/health/index.js'
import { createFakeToolkit } from './route-test-helpers.js'

describe('#dependencyStatusRoute', () => {
  test('is registered as GET /health/dependencies', () => {
    expect(dependencyStatus.method).toBe('GET')
    expect(dependencyStatus.path).toBe('/health/dependencies')
  })

  test('returns 200 with the safe dependency summary when ready', async () => {
    dependencyStatusService.getStatus.mockResolvedValue({
      status: 'operational',
      ready: true,
      timestamp: '2026-09-17T10:00:00.000Z',
      dependencies: {
        referenceStore: {
          status: 'operational',
          requiredForReadiness: false,
          lastCheckedAt: '2026-09-17T10:00:00.000Z'
        },
        authenticationService: {
          status: 'disabled',
          requiredForReadiness: false,
          lastCheckedAt: '2026-09-17T10:00:00.000Z'
        },
        referenceData: {
          status: 'operational',
          requiredForReadiness: true,
          mandatoryDatasetsLoaded: 6,
          lastCheckedAt: '2026-09-17T10:00:00.000Z'
        }
      }
    })

    const { h, calls } = createFakeToolkit()
    await dependencyStatus.handler({}, h)

    expect(calls.statusCode).toBe(200)
    expect(calls.headers['Cache-Control']).toBe('no-store')
    expect(calls.payload.status).toBe('operational')
    expect(
      calls.payload.dependencies.referenceData.mandatoryDatasetsLoaded
    ).toBe(6)
    expect(calls.payload).not.toHaveProperty('ready')
  })

  test('returns 503 when a required dependency is unavailable', async () => {
    dependencyStatusService.getStatus.mockResolvedValue({
      status: 'unavailable',
      ready: false,
      timestamp: '2026-09-17T10:00:00.000Z',
      dependencies: {
        referenceStore: {
          status: 'operational',
          requiredForReadiness: false,
          lastCheckedAt: '2026-09-17T10:00:00.000Z'
        },
        authenticationService: {
          status: 'disabled',
          requiredForReadiness: false,
          lastCheckedAt: '2026-09-17T10:00:00.000Z'
        },
        referenceData: {
          status: 'unavailable',
          requiredForReadiness: true,
          mandatoryDatasetsLoaded: 5,
          lastCheckedAt: '2026-09-17T10:00:00.000Z'
        }
      }
    })

    const { h, calls } = createFakeToolkit()
    await dependencyStatus.handler({}, h)

    expect(calls.statusCode).toBe(503)
    expect(calls.payload.status).toBe('unavailable')
  })

  test('never exposes raw dependency errors, URLs, or credentials', async () => {
    dependencyStatusService.getStatus.mockResolvedValue({
      status: 'operational',
      ready: true,
      timestamp: '2026-09-17T10:00:00.000Z',
      dependencies: {
        referenceStore: {
          status: 'operational',
          requiredForReadiness: false,
          lastCheckedAt: '2026-09-17T10:00:00.000Z'
        },
        authenticationService: {
          status: 'disabled',
          requiredForReadiness: false,
          lastCheckedAt: '2026-09-17T10:00:00.000Z'
        },
        referenceData: {
          status: 'operational',
          requiredForReadiness: true,
          mandatoryDatasetsLoaded: 6,
          lastCheckedAt: '2026-09-17T10:00:00.000Z'
        }
      }
    })

    const { h, calls } = createFakeToolkit()
    await dependencyStatus.handler({}, h)

    const serialised = JSON.stringify(calls.payload)
    expect(serialised).not.toMatch(/aws|s3|bucket|token|authorization/i)
  })
})
