import { describe, expect, test } from 'vitest'

import { getCollectionSchema } from '#/common/schemas/schema-registry.js'
import * as missingRequiredCollectionField from './missing-required-collection-field.js'
import * as unsupportedDataset from './unsupported-dataset.js'
import * as invalidCollectionGuid from './invalid-collection-guid.js'
import * as unsupportedSchemaVersion from './unsupported-schema-version.js'
import * as invalidGeneratedTimestamp from './invalid-generated-timestamp.js'
import * as negativeItemCount from './negative-item-count.js'
import * as invalidItemGuid from './invalid-item-guid.js'
import * as wrongPropertyType from './wrong-property-type.js'
import * as unexpectedAdditionalProperty from './unexpected-additional-property.js'
import * as invalidPortCoordinateRange from './invalid-port-coordinate-range.js'
import * as incompletePortCoordinate from './incomplete-port-coordinate.js'
import * as invalidSpeciesCommonName from './invalid-species-common-name.js'
import * as invalidSpeciesLocalName from './invalid-species-local-name.js'
import * as invalidGearApplicability from './invalid-gear-applicability.js'
import * as invalidGeojsonRootType from './invalid-geojson-root-type.js'
import * as invalidGeojsonGeometryType from './invalid-geojson-geometry-type.js'
import * as nonNumericGeojsonCoordinate from './non-numeric-geojson-coordinate.js'
import * as missingStatisticalAreaCode from './missing-statistical-area-code.js'

const FIXTURES = [
  ['missing required collection field', missingRequiredCollectionField],
  ['unsupported dataset', unsupportedDataset],
  ['invalid collection GUID', invalidCollectionGuid],
  ['unsupported schema version', unsupportedSchemaVersion],
  ['invalid generated timestamp', invalidGeneratedTimestamp],
  ['negative item count', negativeItemCount],
  ['invalid item GUID', invalidItemGuid],
  ['wrong property type', wrongPropertyType],
  ['unexpected additional property', unexpectedAdditionalProperty],
  ['invalid port coordinate range', invalidPortCoordinateRange],
  ['incomplete port coordinate', incompletePortCoordinate],
  ['invalid species common-name structure', invalidSpeciesCommonName],
  ['invalid species local-name structure', invalidSpeciesLocalName],
  ['invalid gear applicability structure', invalidGearApplicability],
  ['invalid GeoJSON root type', invalidGeojsonRootType],
  ['invalid GeoJSON geometry type', invalidGeojsonGeometryType],
  ['non-numeric GeoJSON coordinate', nonNumericGeojsonCoordinate],
  ['missing statistical-area code', missingStatisticalAreaCode]
]

describe('#invalidFixtures', () => {
  test.each(FIXTURES)('%s fails structural validation', (_label, fixture) => {
    const schema = getCollectionSchema(fixture.dataset, '1.0')

    expect(schema.validate(fixture.invalidPayload).error).toBeDefined()
  })
})
