import { describe, expect, test } from 'vitest'

import { getCollectionSchema } from '#/common/schemas/schema-registry.js'
import { validVesselsCollection } from './vessels.js'
import { validGearsCollection } from './gears.js'
import { validPortsCollection } from './ports.js'
import { validSpeciesCollection } from './species.js'
import { validMapLandCollection } from './map-land.js'
import { validMapStatisticalAreasCollection } from './map-statistical-areas.js'

describe('#validExamples', () => {
  test.each([
    ['vessels', validVesselsCollection],
    ['gears', validGearsCollection],
    ['ports', validPortsCollection],
    ['species', validSpeciesCollection],
    ['map-land', validMapLandCollection],
    ['map-statistical-areas', validMapStatisticalAreasCollection]
  ])('%s valid example passes its registered schema', (dataset, example) => {
    const schema = getCollectionSchema(dataset, '1.0')

    expect(schema.validate(example).error).toBeUndefined()
  })
})
