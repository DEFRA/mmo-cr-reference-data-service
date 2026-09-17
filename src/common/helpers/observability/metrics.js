// Bounded application-metrics abstraction (Step 25). Business modules depend only on
// this helper, never on `@defra/cdp-metrics` directly, so the underlying vendor can be
// swapped without touching call sites. Metrics failures are always isolated: they are
// logged and never thrown/rejected back to a caller.

import { Metrics } from '@defra/cdp-metrics'

import { config } from '#/config.js'
import { createLogger } from '#/common/helpers/logging/logger.js'

// The only dimension keys any metric call may use — a defensive allowlist filter,
// independent of how carefully each call site is written, so a future accidental
// high-cardinality key (correlationId, objectKey, filename, business identifier...)
// is silently dropped rather than reaching the metrics backend.
const ALLOWED_DIMENSION_KEYS = new Set([
  'route',
  'method',
  'status_code',
  'dataset',
  'view',
  'operation',
  'result',
  'failure_stage',
  'error_code',
  'trigger'
])

export const METRIC_NAMES = Object.freeze({
  HTTP_REQUESTS_TOTAL: 'reference_data_http_requests_total',
  HTTP_REQUEST_DURATION_MS: 'reference_data_http_request_duration_ms',
  QUERY_REQUESTS_TOTAL: 'reference_data_query_requests_total',
  QUERY_DURATION_MS: 'reference_data_query_duration_ms',
  HYDRATION_DURATION_MS: 'reference_data_hydration_duration_ms',
  HYDRATION_FAILURES_TOTAL: 'reference_data_hydration_failures_total',
  REFRESH_DURATION_MS: 'reference_data_refresh_duration_ms',
  REFRESH_FAILURES_TOTAL: 'reference_data_refresh_failures_total',
  REFRESH_CHANGED_DATASETS_TOTAL:
    'reference_data_refresh_changed_datasets_total',
  VALIDATION_UPLOAD_DURATION_MS: 'reference_data_validation_upload_duration_ms',
  VALIDATION_UPLOAD_FAILURES_TOTAL:
    'reference_data_validation_upload_failures_total',
  COLLECTION_REPLACEMENT_DURATION_MS:
    'reference_data_collection_replacement_duration_ms',
  COLLECTION_REPLACEMENT_FAILURES_TOTAL:
    'reference_data_collection_replacement_failures_total',
  PERSISTENCE_OPERATION_DURATION_MS:
    'reference_data_persistence_operation_duration_ms',
  PERSISTENCE_FAILURES_TOTAL: 'reference_data_persistence_failures_total',
  READINESS: 'reference_data_readiness'
})

function sanitiseDimensions(dimensions = {}) {
  return Object.fromEntries(
    Object.entries(dimensions).filter(([key, value]) =>
      ALLOWED_DIMENSION_KEYS.has(key) ? value !== undefined : false
    )
  )
}

let metricsInstance

// Lazily constructed so `createLogger()` (and its config read) only runs once
// actually needed, and so tests can reset the singleton between cases.
function getMetricsInstance() {
  if (!metricsInstance) {
    metricsInstance = new Metrics(createLogger())
  }
  return metricsInstance
}

// `Metrics`' own methods already self-catch and log internally, but this extra
// layer also protects against a failure in `isEnabled()`/`sanitiseDimensions()`
// themselves, and guarantees business code is never blocked on the returned promise.
function isolate(operation, name) {
  try {
    const outcome = operation()
    if (outcome && typeof outcome.catch === 'function') {
      outcome.catch((cause) => logMetricsFailure(name, cause))
    }
  } catch (cause) {
    logMetricsFailure(name, cause)
  }
}

function logMetricsFailure(name, cause) {
  createLogger().warn(
    { err: cause, metric: name },
    'metrics: failed to record metric'
  )
}

function isEnabled() {
  return config.get('observability.metricsEnabled')
}

export function recordCounter(name, value = 1, dimensions) {
  if (!isEnabled()) {
    return
  }
  isolate(
    () =>
      getMetricsInstance().counter(name, value, sanitiseDimensions(dimensions)),
    name
  )
}

export function recordDuration(name, valueMs, dimensions) {
  if (!isEnabled()) {
    return
  }
  isolate(
    () =>
      getMetricsInstance().millis(
        name,
        valueMs,
        sanitiseDimensions(dimensions)
      ),
    name
  )
}

export function recordGauge(name, value, dimensions) {
  if (!isEnabled()) {
    return
  }
  isolate(
    () =>
      getMetricsInstance().gauge(name, value, sanitiseDimensions(dimensions)),
    name
  )
}
