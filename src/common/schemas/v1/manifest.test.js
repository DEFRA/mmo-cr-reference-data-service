import { describe, expect, test } from 'vitest'

import { manifestDatasetEntrySchema, manifestSchema } from './manifest.js'

describe('#manifestDatasetEntrySchema', () => {
  const validEntry = {
    dataset: 'ports',
    collectionId: '0be553de-f430-49f7-b120-1e8e5ad972dc',
    schemaVersion: '1.0',
    version: '2026.09.11.1',
    format: 'json',
    etag: '"abc123"',
    checksum: 'sha256:abc123',
    itemCount: 1,
    sizeBytes: 1024,
    lastModified: '2026-09-11T08:30:00Z'
  }

  test('accepts a valid entry', () => {
    expect(
      manifestDatasetEntrySchema.validate(validEntry).error
    ).toBeUndefined()
  })

  test('rejects map-ports as a manifest entry dataset', () => {
    const { error } = manifestDatasetEntrySchema.validate({
      ...validEntry,
      dataset: 'map-ports'
    })

    expect(error).toBeDefined()
  })

  test('rejects an unsupported dataset', () => {
    const { error } = manifestDatasetEntrySchema.validate({
      ...validEntry,
      dataset: 'unknown-dataset'
    })

    expect(error).toBeDefined()
  })
})

describe('#manifestSchema', () => {
  test('accepts a valid manifest with no independent map-ports entry', () => {
    const { error } = manifestSchema.validate({
      manifestId: 'c7b49c26-d6c0-4ab1-9318-cd1c862f4768',
      version: '2026.09.11.3',
      generatedAt: '2026-09-11T08:32:14Z',
      datasets: []
    })

    expect(error).toBeUndefined()
  })

  test('rejects an invalid manifestId', () => {
    const { error } = manifestSchema.validate({
      manifestId: 'not-a-guid',
      version: '2026.09.11.3',
      generatedAt: '2026-09-11T08:32:14Z',
      datasets: []
    })

    expect(error).toBeDefined()
  })
})
