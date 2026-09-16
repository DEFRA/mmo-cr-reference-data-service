import { describe, expect, test } from 'vitest'

import { validateManifest } from './manifest-validation.js'

function baseManifest(overrides = {}) {
  return {
    manifestId: '0be553de-f430-49f7-b120-1e8e5ad972dc',
    version: '2026.09.11.1',
    generatedAt: '2026-09-11T08:30:00Z',
    datasets: [
      {
        dataset: 'ports',
        collectionId: '11111111-1111-4111-8111-111111111111',
        schemaVersion: '1.0',
        version: '2026.09.11.1',
        format: 'json',
        etag: 'etag-1',
        checksum: 'checksum-1',
        itemCount: 1,
        sizeBytes: 100,
        lastModified: '2026-09-11T08:30:00Z'
      }
    ],
    ...overrides
  }
}

describe('#validateManifest', () => {
  test('accepts a valid manifest', () => {
    const result = validateManifest(baseManifest())
    expect(result.valid).toBe(true)
    expect(result.entries).toHaveLength(1)
  })

  test('rejects a structurally invalid manifest', () => {
    const result = validateManifest({ manifestId: 'not-a-guid' })
    expect(result.valid).toBe(false)
    expect(result.issues.length).toBeGreaterThan(0)
  })

  test('rejects an unsupported dataset entry', () => {
    const manifest = baseManifest()
    manifest.datasets[0].dataset = 'unknown-dataset'
    // Structural schema already restricts `dataset` to persisted datasets, so this
    // is expected to fail at the structural stage.
    expect(validateManifest(manifest).valid).toBe(false)
  })

  test('rejects duplicate manifest entries for the same dataset', () => {
    const manifest = baseManifest()
    manifest.datasets.push({ ...manifest.datasets[0] })
    const result = validateManifest(manifest)
    expect(result.valid).toBe(false)
    expect(
      result.issues.some((issue) =>
        issue.message.includes('Duplicate manifest entry')
      )
    ).toBe(true)
  })

  test('does not mutate the supplied manifest', () => {
    const manifest = baseManifest()
    const before = structuredClone(manifest)
    validateManifest(manifest)
    expect(manifest).toEqual(before)
  })
})
