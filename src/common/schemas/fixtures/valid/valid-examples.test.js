import { describe, expect, test } from 'vitest'

import { getCollectionSchema } from '#/common/schemas/schema-registry.js'
import validVesselsCollection from './vessels.json' with { type: 'json' }
import validGearsCollection from './gears.json' with { type: 'json' }
import validPortsCollection from './ports.json' with { type: 'json' }
import validSpeciesCollection from './species.json' with { type: 'json' }
import validMapLandCollection from './map-land.json' with { type: 'json' }
import validMapStatisticalAreasCollection from './map-statistical-areas.json' with { type: 'json' }

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
