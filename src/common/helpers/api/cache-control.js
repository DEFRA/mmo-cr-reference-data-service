// Explicit, route-specific Cache-Control policies. Never applied blindly to
// error, health, readiness, or caller-specific responses.

const ONE_HOUR_SECONDS = 3600
const ONE_DAY_SECONDS = 86400

export const CACHE_CONTROL = Object.freeze({
  REFERENCE_DATA_READ: `public, max-age=${ONE_HOUR_SECONDS}, stale-while-revalidate=${ONE_DAY_SECONDS}`,
  NO_STORE: 'no-store'
})
