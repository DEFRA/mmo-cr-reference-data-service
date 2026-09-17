// Central, stable, machine-readable structured-log event names (Step 25).
// Format: reference_data.<area>_<action>. Never embed IDs, dataset values, or
// error messages in the event name itself — those belong in structured fields.

export const LOG_EVENTS = Object.freeze({
  HYDRATION_STARTED: 'reference_data.hydration_started',
  HYDRATION_COMPLETED: 'reference_data.hydration_completed',
  HYDRATION_FAILED: 'reference_data.hydration_failed',
  DATASET_HYDRATION_FAILED: 'reference_data.dataset_hydration_failed',

  REFRESH_STARTED: 'reference_data.refresh_started',
  REFRESH_SKIPPED: 'reference_data.refresh_skipped',
  REFRESH_COMPLETED: 'reference_data.refresh_completed',
  REFRESH_COMPLETED_WITH_ERRORS: 'reference_data.refresh_completed_with_errors',
  REFRESH_FAILED: 'reference_data.refresh_failed',

  VALIDATION_UPLOAD_STARTED: 'reference_data.validation_upload_started',
  VALIDATION_UPLOAD_COMPLETED: 'reference_data.validation_upload_completed',
  VALIDATION_UPLOAD_FAILED: 'reference_data.validation_upload_failed',

  COLLECTION_REPLACEMENT_STARTED:
    'reference_data.collection_replacement_started',
  COLLECTION_REPLACEMENT_COMPLETED:
    'reference_data.collection_replacement_completed',
  COLLECTION_REPLACEMENT_CONFLICTED:
    'reference_data.collection_replacement_conflicted',
  COLLECTION_REPLACEMENT_IDEMPOTENT:
    'reference_data.collection_replacement_idempotent',
  COLLECTION_REPLACEMENT_PARTIAL_FAILURE:
    'reference_data.collection_replacement_partial_failure',
  COLLECTION_REPLACEMENT_FAILED: 'reference_data.collection_replacement_failed',

  PERSISTENCE_OPERATION_COMPLETED:
    'reference_data.persistence_operation_completed',
  PERSISTENCE_OPERATION_FAILED: 'reference_data.persistence_operation_failed',

  QUERY_COMPLETED: 'reference_data.query_completed',

  AUDIT_DELIVERY_FAILED: 'reference_data.audit_delivery_failed'
})
