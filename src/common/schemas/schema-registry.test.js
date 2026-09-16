import { describe, expect, test } from 'vitest'

import { getCollectionSchema, getManifestSchema } from './schema-registry.js'

describe('#getCollectionSchema', () => {
  test('resolves a supported dataset at a supported schema version', () => {
    expect(() => getCollectionSchema('ports', '1.0')).not.toThrow()
  })

  test('rejects an unsupported schema version', () => {
    expect(() => getCollectionSchema('ports', '2.0')).toThrow(
      /unsupported schema version/i
    )
  })

  test('rejects an unsupported dataset', () => {
    expect(() => getCollectionSchema('unknown-dataset', '1.0')).toThrow()
  })

  test('map-ports cannot resolve as a persisted, uploadable schema', () => {
    expect(() => getCollectionSchema('map-ports', '1.0')).toThrow(
      /not an uploadable, persisted dataset/i
    )
  })
})

describe('#getManifestSchema', () => {
  test('resolves the manifest schema for a supported version', () => {
    expect(() => getManifestSchema('1.0')).not.toThrow()
  })

  test('rejects an unsupported schema version', () => {
    expect(() => getManifestSchema('2.0')).toThrow(
      /unsupported schema version/i
    )
  })
})
