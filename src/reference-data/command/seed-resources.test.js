import { describe, expect, test } from 'vitest'

import { loadSeedCollection, SEED_DATASET_ORDER } from './seed-loader.js'
import { validateCollectionUpload } from './validate-collection-upload.js'
import { SEED_SCHEMA_VERSION } from './bootstrap-local-reference-data.js'
import {
  DATASETS,
  DATASET_FORMAT,
  getDatasetCapabilities
} from '#/common/domain/datasets.js'
import { isSupportedVesselLengthBand } from '#/reference-data/validation/vessel-length-bands.js'

const GUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Recursively collects every string value found under a key literally named "id"
// (works across the JSON envelope and every nested gear/species shape). GeoJSON
// `properties.id` is deliberately excluded: the schema requires it to duplicate the
// feature's own top-level `id`, so it is the same identity, not a second one.
function collectIds(value, found = [], parentKey = null) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectIds(item, found, parentKey))
  } else if (value !== null && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      if (
        key === 'id' &&
        typeof nested === 'string' &&
        parentKey !== 'properties'
      ) {
        found.push(nested)
      } else {
        collectIds(nested, found, key)
      }
    }
  }
  return found
}

const seedCollections = Object.fromEntries(
  SEED_DATASET_ORDER.map((dataset) => [dataset, loadSeedCollection(dataset)])
)

describe('seed resources (Step 23)', () => {
  test.each(SEED_DATASET_ORDER)(
    '%s declares the matching dataset, fixed schemaVersion, and fixed version',
    (dataset) => {
      const collection = seedCollections[dataset]
      expect(collection.dataset).toBe(dataset)
      expect(collection.schemaVersion).toBe(SEED_SCHEMA_VERSION)
      expect(collection.version).toBe('local-seed-1')
      expect(collection.generatedAt).toBe('2026-01-01T00:00:00Z')
    }
  )

  test.each(SEED_DATASET_ORDER)(
    '%s collectionId is a fixed valid GUID',
    (dataset) => {
      expect(seedCollections[dataset].collectionId).toMatch(GUID_PATTERN)
    }
  )

  test.each(SEED_DATASET_ORDER)(
    '%s passes structural validation, canonical normalisation, and business validation',
    (dataset) => {
      const result = validateCollectionUpload({
        dataset,
        schemaVersion: SEED_SCHEMA_VERSION,
        collection: seedCollections[dataset]
      })
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    }
  )

  test.each(SEED_DATASET_ORDER)(
    '%s is already canonical (normalisation makes no changes)',
    (dataset) => {
      const result = validateCollectionUpload({
        dataset,
        schemaVersion: SEED_SCHEMA_VERSION,
        collection: seedCollections[dataset]
      })
      expect(result.changed).toBe(false)
      expect(result.warnings).toEqual([])
    }
  )

  test.each(SEED_DATASET_ORDER)(
    '%s itemCount matches its content',
    (dataset) => {
      const collection = seedCollections[dataset]
      const format = getDatasetCapabilities(dataset).format
      const count =
        format === DATASET_FORMAT.GEOJSON
          ? collection.features.length
          : collection.items.length
      expect(collection.itemCount).toBe(count)
    }
  )

  test('no seed resource contains an authorization/token/secret/password field', () => {
    const serialised = JSON.stringify(seedCollections).toLowerCase()
    for (const forbidden of [
      'password',
      'secret',
      'token',
      'authorization',
      'apikey'
    ]) {
      expect(serialised).not.toContain(forbidden)
    }
  })

  test('deterministic identifiers do not collide across every seed collection', () => {
    const allIds = SEED_DATASET_ORDER.flatMap((dataset) =>
      collectIds(seedCollections[dataset])
    )
    expect(allIds.length).toBeGreaterThan(0)
    expect(new Set(allIds).size).toBe(allIds.length)
  })
})

describe('vessel seed', () => {
  const { items } = seedCollections[DATASETS.VESSELS]

  test('every vessel has a valid GUID and at least one natural identifier', () => {
    for (const vessel of items) {
      expect(vessel.id).toMatch(GUID_PATTERN)
      const identifiers = vessel.identifiers
      expect(
        Object.values(identifiers).some(
          (value) => value !== null && value !== ''
        )
      ).toBe(true)
    }
  })

  test('MMSI values remain strings with no duplicate identifiers', () => {
    const mmsiValues = items.map((vessel) => vessel.identifiers.mmsi)
    for (const mmsi of mmsiValues) {
      expect(typeof mmsi).toBe('string')
    }
    expect(new Set(mmsiValues).size).toBe(mmsiValues.length)
  })

  test('every vessel has a positive length and a valid active-date range', () => {
    for (const vessel of items) {
      expect(vessel.lengthOverallMetres).toBeGreaterThan(0)
      expect(vessel.activeFrom <= (vessel.activeTo ?? '9999-12-31')).toBe(true)
    }
  })

  test('demonstrates both active and inactive status values', () => {
    const statuses = new Set(items.map((vessel) => vessel.status))
    expect(statuses.has('active')).toBe(true)
    expect(statuses.has('inactive')).toBe(true)
  })
})

describe('gear seed', () => {
  const { items, categories, characteristics } = seedCollections[DATASETS.GEARS]

  test('every category and characteristic reference resolves', () => {
    const categoryIds = new Set(categories.map((category) => category.id))
    const characteristicIds = new Set(
      characteristics.map((characteristic) => characteristic.id)
    )
    for (const gear of items) {
      expect(categoryIds.has(gear.categoryId)).toBe(true)
      for (const relationship of gear.applicableCharacteristics) {
        expect(characteristicIds.has(relationship.characteristicId)).toBe(true)
      }
    }
  })

  test('every characteristic uses the approved "number" data type with a valid range', () => {
    for (const characteristic of characteristics) {
      expect(characteristic.dataType).toBe('number')
      expect(characteristic.minValue).toBeLessThanOrEqual(
        characteristic.maxValue
      )
    }
  })

  test('every approved vessel-length band is represented across gear items', () => {
    const bands = new Set(
      items.flatMap((gear) =>
        gear.applicableCharacteristics.flatMap(
          (relationship) => relationship.vesselLengthApplicability
        )
      )
    )
    expect(bands.has('under-10m')).toBe(true)
    expect(bands.has('10-to-12m')).toBe(true)
    expect(bands.has('over-12m')).toBe(true)
    for (const band of bands) {
      expect(isSupportedVesselLengthBand(band)).toBe(true)
    }
  })

  test('fixed and required are preserved independently per relationship', () => {
    const relationships = items.flatMap(
      (gear) => gear.applicableCharacteristics
    )
    expect(
      relationships.some((relationship) => relationship.fixed === true)
    ).toBe(true)
    expect(
      relationships.some((relationship) => relationship.fixed === false)
    ).toBe(true)
    expect(
      relationships.some((relationship) => relationship.required === true)
    ).toBe(true)
    expect(
      relationships.some((relationship) => relationship.required === false)
    ).toBe(true)
  })

  test('demonstrates both single and pair fishing gears', () => {
    expect(items.some((gear) => gear.pairFishing === true)).toBe(true)
    expect(items.some((gear) => gear.pairFishing === false)).toBe(true)
  })
})

describe('port seed', () => {
  const { items } = seedCollections[DATASETS.PORTS]

  test('port codes are unique strings, including a leading-zero code', () => {
    const codes = items.map((port) => port.code)
    expect(new Set(codes).size).toBe(codes.length)
    expect(codes.some((code) => /^[A-Z]{2}0/.test(code))).toBe(true)
  })

  test('every supplied coordinate is within WGS84 ranges', () => {
    for (const port of items.filter((item) => item.coordinate)) {
      expect(port.coordinate.latitude).toBeGreaterThanOrEqual(-90)
      expect(port.coordinate.latitude).toBeLessThanOrEqual(90)
      expect(port.coordinate.longitude).toBeGreaterThanOrEqual(-180)
      expect(port.coordinate.longitude).toBeLessThanOrEqual(180)
    }
  })

  test('at least one port has coordinates (map-port projection) and one does not', () => {
    expect(items.some((port) => port.coordinate !== null)).toBe(true)
    expect(items.some((port) => port.coordinate === null)).toBe(true)
  })
})

describe('species seed', () => {
  const { items } = seedCollections[DATASETS.SPECIES]

  test('FAO codes are unique', () => {
    const codes = items.map((species) => species.faoCode)
    expect(new Set(codes).size).toBe(codes.length)
  })

  test('demonstrates the mobile name-resolution fallback chain', () => {
    const withOfficialLocalName = items.find((species) =>
      species.localNames.some((name) => name.official)
    )
    const withCommonNameOnly = items.find(
      (species) =>
        species.commonNames.length > 0 && species.localNames.length === 0
    )
    const withNoNames = items.find(
      (species) =>
        species.commonNames.length === 0 && species.localNames.length === 0
    )
    expect(withOfficialLocalName).toBeDefined()
    expect(withCommonNameOnly).toBeDefined()
    expect(withNoNames).toBeDefined()
  })
})

describe('map seed', () => {
  test.each([DATASETS.MAP_LAND, DATASETS.MAP_STATISTICAL_AREAS])(
    '%s is a FeatureCollection of valid, closed, non-empty Polygon geometries',
    (dataset) => {
      const collection = seedCollections[dataset]
      expect(collection.type).toBe('FeatureCollection')
      for (const feature of collection.features) {
        expect(feature.type).toBe('Feature')
        expect(feature.geometry.type).toBe('Polygon')
        const [ring] = feature.geometry.coordinates
        expect(ring.length).toBeGreaterThanOrEqual(4)
        expect(ring[0]).toEqual(ring[ring.length - 1])
        for (const [longitude, latitude] of ring) {
          expect(longitude).toBeGreaterThanOrEqual(-180)
          expect(longitude).toBeLessThanOrEqual(180)
          expect(latitude).toBeGreaterThanOrEqual(-90)
          expect(latitude).toBeLessThanOrEqual(90)
        }
      }
    }
  )

  test('map-statistical-areas codes are unique and parent-code links are consistent', () => {
    const { features } = seedCollections[DATASETS.MAP_STATISTICAL_AREAS]
    const codes = features.map((feature) => feature.properties.code)
    expect(new Set(codes).size).toBe(codes.length)
    const withParent = features.filter(
      (feature) => feature.properties.parentCode
    )
    expect(withParent.length).toBeGreaterThan(0)
    for (const feature of withParent) {
      expect(codes).toContain(feature.properties.parentCode)
    }
  })
})
