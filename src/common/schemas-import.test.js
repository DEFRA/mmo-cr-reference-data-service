import { describe, expect, test } from 'vitest'

import * as guid from '#/common/schemas/fragments/guid.js'
import * as date from '#/common/schemas/fragments/date.js'
import * as timestamp from '#/common/schemas/fragments/timestamp.js'
import * as coordinate from '#/common/schemas/fragments/coordinate.js'
import * as geojson from '#/common/schemas/fragments/geojson.js'
import * as collectionMetadata from '#/common/schemas/fragments/collection-metadata.js'
import * as schemaVersions from '#/common/schemas/schema-versions.js'
import * as validate from '#/common/schemas/validate.js'
import * as collectionEnvelope from '#/common/schemas/v1/collection-envelope.js'
import * as manifest from '#/common/schemas/v1/manifest.js'
import * as vessels from '#/common/schemas/v1/vessels.js'
import * as gears from '#/common/schemas/v1/gears.js'
import * as ports from '#/common/schemas/v1/ports.js'
import * as species from '#/common/schemas/v1/species.js'
import * as mapLand from '#/common/schemas/v1/map-land.js'
import * as mapStatisticalAreas from '#/common/schemas/v1/map-statistical-areas.js'
import * as mapPorts from '#/common/schemas/v1/map-ports.js'
import * as schemaRegistry from '#/common/schemas/schema-registry.js'

describe('#schemasModules', () => {
  test.each([
    ['fragments/guid', guid],
    ['fragments/date', date],
    ['fragments/timestamp', timestamp],
    ['fragments/coordinate', coordinate],
    ['fragments/geojson', geojson],
    ['fragments/collection-metadata', collectionMetadata],
    ['schema-versions', schemaVersions],
    ['validate', validate],
    ['v1/collection-envelope', collectionEnvelope],
    ['v1/manifest', manifest],
    ['v1/vessels', vessels],
    ['v1/gears', gears],
    ['v1/ports', ports],
    ['v1/species', species],
    ['v1/map-land', mapLand],
    ['v1/map-statistical-areas', mapStatisticalAreas],
    ['v1/map-ports', mapPorts],
    ['schema-registry', schemaRegistry]
  ])('%s loads without circular-dependency failures', (_label, module) => {
    expect(module).toBeDefined()
  })
})
