// Step 20: map-land query configuration. GeoJSON, bbox-only spatial filter (no
// code/parentCode — the schema has no such properties), general search limited to
// `name` (the only text property the schema defines).

import { createQueryConfiguration } from './query-configuration.js'
import { DATASETS } from '#/common/domain/datasets.js'
import { parseBoundingBox } from './bounding-box.js'
import { featureGeometryIntersectsBoundingBox } from './geometry-intersection.js'

export const mapLandQueryConfiguration = createQueryConfiguration({
  dataset: DATASETS.MAP_LAND,
  format: 'geojson',
  getGuid: (feature) => feature.id,
  customFilters: {
    bbox: {
      parse: (raw) => parseBoundingBox(raw),
      predicate: (feature, bbox) =>
        featureGeometryIntersectsBoundingBox(feature.geometry, bbox)
    }
  },
  textSearchFields: [(feature) => feature.properties.name],
  sortFields: {
    name: (feature) => feature.properties.name
  },
  defaultSort: [{ field: 'name', direction: 'asc' }],
  pagination: { allowPagination: false }
})
