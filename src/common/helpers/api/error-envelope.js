// Standard public API error envelope: { error: { code, message, traceId, ... } }.
// Optional properties are included only when defined — never as explicit `undefined`.
export function createErrorEnvelope({
  code,
  message,
  traceId,
  dataset,
  retryable,
  details
}) {
  return {
    error: {
      code,
      message,
      traceId,
      ...(dataset !== undefined ? { dataset } : {}),
      ...(retryable !== undefined ? { retryable } : {}),
      ...(details !== undefined ? { details } : {})
    }
  }
}
