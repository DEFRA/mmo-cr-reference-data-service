/**
 * Map-land has no dataset-specific business rules beyond the common envelope and
 * common GeoJSON foundation already applied by Step 08 (feature GUID uniqueness,
 * WGS84 coordinate range, closed polygon rings, non-empty geometry). This explicit,
 * named no-op documents that decision instead of silently relying on the Step 08
 * placeholder.
 */
export function validateMapLandCollection() {
  return { valid: true, errors: [], warnings: [] }
}
