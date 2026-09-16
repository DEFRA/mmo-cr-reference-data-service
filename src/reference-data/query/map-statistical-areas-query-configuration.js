// Step 20: map-statistical-areas query configuration. GeoJSON; `code`/`parentCode`
// are exact, case-insensitive; general search covers name/code/areaType/parentCode/
// parentName (owner-approved broad option, 2026-09-16); `bbox` uses true polygon
// intersection via geometry-intersection.js.

import { createQueryConfiguration } from './query-configuration.js'
import { DATASETS } from '#/common/domain/datasets.js'
import { parseBoundingBox } from './bounding-box.js'
import { featureGeometryIntersectsBoundingBox } from './geometry-intersection.js'

export const mapStatisticalAreasQueryConfiguration = createQueryConfiguration({
  dataset: DATASETS.MAP_STATISTICAL_AREAS,
  format: 'geojson',
  getGuid: (feature) => feature.id,
  exactFilters: [
    {
      param: 'code',
      caseInsensitive: true,
      getValue: (feature) => feature.properties.code
    },
    {
      param: 'parentCode',
      caseInsensitive: true,
      getValue: (feature) => feature.properties.parentCode
    }
  ],
  customFilters: {
    bbox: {
      parse: (raw) => parseBoundingBox(raw),
      predicate: (feature, bbox) =>
        featureGeometryIntersectsBoundingBox(feature.geometry, bbox)
    }
  },
  textSearchFields: [
    (feature) => feature.properties.name,
    (feature) => feature.properties.code,
    (feature) => feature.properties.areaType,
    (feature) => feature.properties.parentCode,
    (feature) => feature.properties.parentName
  ],
  sortFields: {
    name: (feature) => feature.properties.name,
    code: (feature) => feature.properties.code
  },
  defaultSort: [{ field: 'name', direction: 'asc' }],
  pagination: { allowPagination: false }
})
