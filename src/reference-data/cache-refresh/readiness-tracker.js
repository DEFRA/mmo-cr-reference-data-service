// Minimal, pure lifecycle-flag tracker. Mandatory-dataset availability is derived
// directly from the In-Memory Data Store at read time (see cache-refresh-service.js),
// not duplicated here, so "previous valid data retained after a failed refresh"
// requires no separate bookkeeping.
export function createReadinessTracker() {
  let hydrated = false
  let shuttingDown = false
  let lastHydratedAt = null
  let lastRefreshAt = null
  let lastRefreshStatus = null

  function markHydrated(timestamp) {
    hydrated = true
    lastHydratedAt = timestamp
  }

  function markRefreshed({ timestamp, status }) {
    lastRefreshAt = timestamp
    lastRefreshStatus = status
  }

  function markShuttingDown() {
    shuttingDown = true
  }

  function getFlags() {
    return {
      hydrated,
      shuttingDown,
      lastHydratedAt,
      lastRefreshAt,
      lastRefreshStatus
    }
  }

  return { markHydrated, markRefreshed, markShuttingDown, getFlags }
}
