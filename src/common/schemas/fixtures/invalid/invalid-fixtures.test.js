import { describe, expect, test } from 'vitest'

import { getCollectionSchema } from '#/common/schemas/schema-registry.js'
import missingRequiredCollectionField from './missing-required-collection-field.json' with { type: 'json' }
import unsupportedDataset from './unsupported-dataset.json' with { type: 'json' }
import invalidCollectionGuid from './invalid-collection-guid.json' with { type: 'json' }
import unsupportedSchemaVersion from './unsupported-schema-version.json' with { type: 'json' }
import invalidGeneratedTimestamp from './invalid-generated-timestamp.json' with { type: 'json' }
import negativeItemCount from './negative-item-count.json' with { type: 'json' }
import invalidItemGuid from './invalid-item-guid.json' with { type: 'json' }
import wrongPropertyType from './wrong-property-type.json' with { type: 'json' }
import unexpectedAdditionalProperty from './unexpected-additional-property.json' with { type: 'json' }
import invalidPortCoordinateRange from './invalid-port-coordinate-range.json' with { type: 'json' }
import incompletePortCoordinate from './incomplete-port-coordinate.json' with { type: 'json' }
import invalidSpeciesCommonName from './invalid-species-common-name.json' with { type: 'json' }
import invalidSpeciesLocalName from './invalid-species-local-name.json' with { type: 'json' }
import invalidGearApplicability from './invalid-gear-applicability.json' with { type: 'json' }
import invalidGeojsonRootType from './invalid-geojson-root-type.json' with { type: 'json' }
import invalidGeojsonGeometryType from './invalid-geojson-geometry-type.json' with { type: 'json' }
import nonNumericGeojsonCoordinate from './non-numeric-geojson-coordinate.json' with { type: 'json' }
import missingStatisticalAreaCode from './missing-statistical-area-code.json' with { type: 'json' }

const FIXTURES = [
  [
    'missing required collection field',
    'ports',
    missingRequiredCollectionField
  ],
  ['unsupported dataset', 'ports', unsupportedDataset],
  ['invalid collection GUID', 'ports', invalidCollectionGuid],
  ['unsupported schema version', 'ports', unsupportedSchemaVersion],
  ['invalid generated timestamp', 'ports', invalidGeneratedTimestamp],
  ['negative item count', 'ports', negativeItemCount],
  ['invalid item GUID', 'ports', invalidItemGuid],
  ['wrong property type', 'ports', wrongPropertyType],
  ['unexpected additional property', 'ports', unexpectedAdditionalProperty],
  ['invalid port coordinate range', 'ports', invalidPortCoordinateRange],
  ['incomplete port coordinate', 'ports', incompletePortCoordinate],
  [
    'invalid species common-name structure',
    'species',
    invalidSpeciesCommonName
  ],
  ['invalid species local-name structure', 'species', invalidSpeciesLocalName],
  ['invalid gear applicability structure', 'gears', invalidGearApplicability],
  ['invalid GeoJSON root type', 'map-land', invalidGeojsonRootType],
  ['invalid GeoJSON geometry type', 'map-land', invalidGeojsonGeometryType],
  ['non-numeric GeoJSON coordinate', 'map-land', nonNumericGeojsonCoordinate],
  [
    'missing statistical-area code',
    'map-statistical-areas',
    missingStatisticalAreaCode
  ]
]

describe('#invalidFixtures', () => {
  test.each(FIXTURES)(
    '%s fails structural validation',
    (_label, targetDataset, invalidPayload) => {
      const schema = getCollectionSchema(targetDataset, '1.0')

      expect(schema.validate(invalidPayload).error).toBeDefined()
    }
  )
})
