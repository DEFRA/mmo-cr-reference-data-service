// map-statistical-areas query configuration. Per
// docs/adr/0001-map-statistical-areas-raw-epsg3857-contract.md this dataset is served
// as the raw upstream ArcGIS export: the item identifier is `properties.OBJECTID`
// (not a GUID), exact filters/search are repointed to `sub_code`/`ICESNAME` (the
// fields that actually exist in the raw shape), and `bbox` is removed — a WGS84-
// degree bounding box cannot be applied to EPSG:3857 metre coordinates without
// reprojection, which this dataset deliberately avoids.

import Joi from 'joi'

import { createQueryConfiguration } from './query-configuration.js'
import { DATASETS } from '#/common/domain/datasets.js'

const OBJECT_ID_PATTERN = /^\d+$/

export const mapStatisticalAreasQueryConfiguration = createQueryConfiguration({
  dataset: DATASETS.MAP_STATISTICAL_AREAS,
  format: 'geojson',
  getGuid: (feature) => String(feature.properties.OBJECTID),
  idSchema: Joi.string().pattern(OBJECT_ID_PATTERN),
  crs: 'EPSG:3857',
  exactFilters: [
    {
      param: 'sub_code',
      caseInsensitive: true,
      getValue: (feature) => feature.properties.sub_code
    },
    {
      param: 'ICESNAME',
      caseInsensitive: true,
      getValue: (feature) => feature.properties.ICESNAME
    }
  ],
  textSearchFields: [
    (feature) => feature.properties.ICESNAME,
    (feature) => feature.properties.sub_code
  ],
  sortFields: {
    OBJECTID: (feature) => feature.properties.OBJECTID,
    sub_code: (feature) => feature.properties.sub_code
  },
  defaultSort: [{ field: 'OBJECTID', direction: 'asc' }],
  pagination: { allowPagination: false }
})
