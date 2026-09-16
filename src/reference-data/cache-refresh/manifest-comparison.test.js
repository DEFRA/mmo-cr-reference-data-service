import { describe, expect, test } from 'vitest'

import { hasManifestEntryChanged } from './manifest-comparison.js'

const BASE_ENTRY = Object.freeze({
  dataset: 'ports',
  version: '2026.09.11.1',
  etag: 'etag-1',
  checksum: 'checksum-1',
  lastModified: '2026-09-11T08:30:00Z'
})

describe('#hasManifestEntryChanged', () => {
  test('treats a dataset with no stored entry as changed', () => {
    expect(hasManifestEntryChanged(BASE_ENTRY, undefined)).toBe(true)
  })

  test('detects no change when every comparison field is identical', () => {
    expect(hasManifestEntryChanged(BASE_ENTRY, { ...BASE_ENTRY })).toBe(false)
  })
  test('detects a changed checksum', () => {
    expect(
      hasManifestEntryChanged(BASE_ENTRY, {
        ...BASE_ENTRY,
        checksum: 'checksum-2'
      })
    ).toBe(true)
  })

  test('falls back to etag when checksum is absent on either side', () => {
    const candidate = { ...BASE_ENTRY, checksum: undefined }
    expect(
      hasManifestEntryChanged(candidate, { ...candidate, etag: 'etag-2' })
    ).toBe(true)
    expect(hasManifestEntryChanged(candidate, { ...candidate })).toBe(false)
  })

  test('falls back to version when checksum and etag are absent', () => {
    const candidate = { ...BASE_ENTRY, checksum: undefined, etag: undefined }
    expect(
      hasManifestEntryChanged(candidate, {
        ...candidate,
        version: '2026.09.12.1'
      })
    ).toBe(true)
  })

  test('falls back to lastModified as the final comparison', () => {
    const candidate = {
      ...BASE_ENTRY,
      checksum: undefined,
      etag: undefined,
      version: undefined
    }
    expect(
      hasManifestEntryChanged(candidate, {
        ...candidate,
        lastModified: '2026-09-12T08:30:00Z'
      })
    ).toBe(true)
    expect(hasManifestEntryChanged(candidate, { ...candidate })).toBe(false)
  })
})
