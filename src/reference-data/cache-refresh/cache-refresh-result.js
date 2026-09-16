// Framework-neutral cache-refresh result contracts (Step 11).

export const REFRESH_STAGE = Object.freeze({
  MANIFEST: 'manifest',
  PERSISTENCE: 'persistence',
  STRUCTURAL_VALIDATION: 'structural-validation',
  NORMALISATION: 'normalisation',
  BUSINESS_VALIDATION: 'business-validation',
  PUBLICATION: 'publication'
})

export const REFRESH_STATUS = Object.freeze({
  COMPLETED: 'completed',
  COMPLETED_WITH_ERRORS: 'completed-with-errors',
  SKIPPED: 'skipped',
  FAILED: 'failed'
})

export function createDatasetFailure({
  dataset,
  stage,
  code,
  message,
  retryable = false
}) {
  return { dataset, stage, code, message, retryable }
}

function resolveStatus(failedDatasets) {
  return failedDatasets.length === 0
    ? REFRESH_STATUS.COMPLETED
    : REFRESH_STATUS.COMPLETED_WITH_ERRORS
}

// Sorts by dataset name so result ordering is deterministic regardless of the
// concurrency order datasets were actually processed in.
function sortedByDataset(entries) {
  return [...entries].sort((a, b) => a.localeCompare(b))
}

export function createCacheRefreshResult({
  startedAt,
  completedAt,
  manifestChanged,
  refreshedDatasets = [],
  unchangedDatasets = [],
  failedDatasets = [],
  removedDatasets = []
}) {
  return {
    status: resolveStatus(failedDatasets),
    startedAt,
    completedAt,
    manifestChanged,
    refreshedDatasets: sortedByDataset(refreshedDatasets),
    unchangedDatasets: sortedByDataset(unchangedDatasets),
    failedDatasets: [...failedDatasets].sort((a, b) =>
      a.dataset.localeCompare(b.dataset)
    ),
    removedDatasets: sortedByDataset(removedDatasets)
  }
}

export function createSkippedResult({ startedAt, completedAt }) {
  return {
    status: REFRESH_STATUS.SKIPPED,
    startedAt,
    completedAt,
    manifestChanged: false,
    refreshedDatasets: [],
    unchangedDatasets: [],
    failedDatasets: [],
    removedDatasets: []
  }
}

export function createFailedManifestResult({
  startedAt,
  completedAt,
  code,
  message
}) {
  return {
    status: REFRESH_STATUS.FAILED,
    startedAt,
    completedAt,
    manifestChanged: false,
    refreshedDatasets: [],
    unchangedDatasets: [],
    failedDatasets: [
      createDatasetFailure({
        dataset: null,
        stage: REFRESH_STAGE.MANIFEST,
        code,
        message,
        retryable: true
      })
    ],
    removedDatasets: []
  }
}
