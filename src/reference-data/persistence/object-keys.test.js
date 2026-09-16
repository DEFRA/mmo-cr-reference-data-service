import { describe, expect, test } from 'vitest'

import {
  buildCollectionObjectKey,
  buildManifestObjectKey,
  MANIFEST_OBJECT_KEY,
  REFERENCE_DATA_PREFIX
} from './object-keys.js'
import { DATASETS } from '#/common/domain/datasets.js'

const PERSISTED_DATASETS = [
  DATASETS.VESSELS,
  DATASETS.GEARS,
  DATASETS.PORTS,
  DATASETS.SPECIES,
  DATASETS.MAP_LAND,
  DATASETS.MAP_STATISTICAL_AREAS
]

describe('#buildManifestObjectKey', () => {
  test('resolves to the approved manifest key', () => {
    expect(buildManifestObjectKey()).toBe(MANIFEST_OBJECT_KEY)
    expect(buildManifestObjectKey()).toBe(
      `${REFERENCE_DATA_PREFIX}/manifest.json`
    )
  })
})

describe('#buildCollectionObjectKey', () => {
  test.each(PERSISTED_DATASETS)(
    '%s resolves to the approved prefix',
    (dataset) => {
      expect(buildCollectionObjectKey(dataset, '2024-01-01T00-00-00Z')).toBe(
        `reference-data/${dataset}/2024-01-01T00-00-00Z.json`
      )
    }
  )

  test('collection versions resolve to deterministic keys', () => {
    expect(buildCollectionObjectKey(DATASETS.VESSELS, 'v1')).toBe(
      buildCollectionObjectKey(DATASETS.VESSELS, 'v1')
    )
  })

  test('map-ports is rejected', () => {
    expect(() => buildCollectionObjectKey(DATASETS.MAP_PORTS, 'v1')).toThrow(
      /not a persisted reference-data dataset/
    )
  })

  test('an unsupported dataset is rejected', () => {
    expect(() => buildCollectionObjectKey('unknown', 'v1')).toThrow(
      /not a persisted reference-data dataset/
    )
  })

  test.each([
    '../escape',
    '/leading-slash',
    'back\\slash',
    'has space',
    'query?x=1',
    'http://example.com',
    'a/b',
    '',
    '.',
    '..',
    'control\u0000char'
  ])('rejects unsafe collection version %j', (unsafeVersion) => {
    expect(() =>
      buildCollectionObjectKey(DATASETS.VESSELS, unsafeVersion)
    ).toThrow(/Invalid collection version/)
  })

  test('no caller can escape the approved reference-data prefix', () => {
    const key = buildCollectionObjectKey(DATASETS.VESSELS, 'v1')
    expect(key.startsWith(`${REFERENCE_DATA_PREFIX}/`)).toBe(true)
  })
})
