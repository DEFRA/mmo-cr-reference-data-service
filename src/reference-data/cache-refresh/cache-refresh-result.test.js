import { describe, expect, test } from 'vitest'

import {
  createCacheRefreshResult,
  createDatasetFailure,
  createFailedManifestResult,
  createSkippedResult,
  REFRESH_STAGE,
  REFRESH_STATUS
} from './cache-refresh-result.js'

describe('#createCacheRefreshResult', () => {
  test('reports "completed" when there are no failures', () => {
    const result = createCacheRefreshResult({
      startedAt: '2026-09-11T08:00:00Z',
      completedAt: '2026-09-11T08:00:01Z',
      manifestChanged: true,
      refreshedDatasets: ['ports']
    })

    expect(result.status).toBe(REFRESH_STATUS.COMPLETED)
  })

  test('reports "completed-with-errors" when one dataset failed', () => {
    const result = createCacheRefreshResult({
      startedAt: '2026-09-11T08:00:00Z',
      completedAt: '2026-09-11T08:00:01Z',
      manifestChanged: true,
      refreshedDatasets: ['ports'],
      failedDatasets: [
        createDatasetFailure({
          dataset: 'species',
          stage: REFRESH_STAGE.BUSINESS_VALIDATION,
          code: 'business_validation_failed',
          message: 'invalid'
        })
      ]
    })

    expect(result.status).toBe(REFRESH_STATUS.COMPLETED_WITH_ERRORS)
  })

  test('orders dataset lists deterministically regardless of input order', () => {
    const result = createCacheRefreshResult({
      startedAt: '2026-09-11T08:00:00Z',
      completedAt: '2026-09-11T08:00:01Z',
      manifestChanged: true,
      refreshedDatasets: ['species', 'gears'],
      unchangedDatasets: ['vessels', 'ports']
    })

    expect(result.refreshedDatasets).toEqual(['gears', 'species'])
    expect(result.unchangedDatasets).toEqual(['ports', 'vessels'])
  })

  test('orders failed datasets deterministically by dataset name', () => {
    const result = createCacheRefreshResult({
      startedAt: '2026-09-11T08:00:00Z',
      completedAt: '2026-09-11T08:00:01Z',
      manifestChanged: true,
      failedDatasets: [
        createDatasetFailure({
          dataset: 'species',
          stage: 'persistence',
          code: 'x',
          message: 'x'
        }),
        createDatasetFailure({
          dataset: 'gears',
          stage: 'persistence',
          code: 'x',
          message: 'x'
        })
      ]
    })

    expect(result.failedDatasets.map((f) => f.dataset)).toEqual([
      'gears',
      'species'
    ])
  })
})

describe('#createSkippedResult', () => {
  test('reports "skipped" status', () => {
    const result = createSkippedResult({
      startedAt: '2026-09-11T08:00:00Z',
      completedAt: '2026-09-11T08:00:00Z'
    })
    expect(result.status).toBe(REFRESH_STATUS.SKIPPED)
    expect(result.failedDatasets).toEqual([])
  })
})

describe('#createFailedManifestResult', () => {
  test('reports "failed" status with a manifest-stage failure', () => {
    const result = createFailedManifestResult({
      startedAt: '2026-09-11T08:00:00Z',
      completedAt: '2026-09-11T08:00:00Z',
      code: 'reference_data_unavailable',
      message: 'manifest unreadable'
    })

    expect(result.status).toBe(REFRESH_STATUS.FAILED)
    expect(result.failedDatasets[0]).toEqual(
      expect.objectContaining({ stage: REFRESH_STAGE.MANIFEST, dataset: null })
    )
  })
})
