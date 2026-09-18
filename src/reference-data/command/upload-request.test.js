import { describe, expect, test } from 'vitest'

import {
  extractSingleUploadedFile,
  parseUploadedFileContent,
  resolveUploadMetadata
} from './upload-request.js'

function filePart({ contentType = 'application/json', payload } = {}) {
  return {
    filename: 'collection.json',
    headers: { 'content-type': contentType },
    payload
  }
}

describe('#extractSingleUploadedFile', () => {
  test('extracts the single uploaded file', () => {
    const file = extractSingleUploadedFile({
      file: filePart({ payload: { a: 1 } })
    })
    expect(file.contentType).toBe('application/json')
    expect(file.payload).toEqual({ a: 1 })
  })

  test('normalises a missing content-type header to null rather than throwing', () => {
    const file = extractSingleUploadedFile({
      file: { filename: 'collection.json', headers: {}, payload: { a: 1 } }
    })
    expect(file.contentType).toBeNull()
  })

  test('rejects a missing file', () => {
    expect(() => extractSingleUploadedFile({})).toThrow(/required/)
  })

  test('rejects a non-file field value', () => {
    expect(() => extractSingleUploadedFile({ file: 'not-a-file' })).toThrow()
  })

  test('rejects multiple files', () => {
    expect(() =>
      extractSingleUploadedFile({
        file: [filePart({ payload: { a: 1 } }), filePart({ payload: { b: 2 } })]
      })
    ).toThrow(/Exactly one file/)
  })

  test('normalises content type parameters and casing', () => {
    const file = extractSingleUploadedFile({
      file: filePart({
        contentType: 'Application/JSON; charset=utf-8',
        payload: {}
      })
    })
    expect(file.contentType).toBe('application/json')
  })
})

describe('#parseUploadedFileContent', () => {
  test('returns the parsed collection for a matching JSON dataset', () => {
    const collection = parseUploadedFileContent({
      dataset: 'ports',
      file: { contentType: 'application/json', payload: { items: [] } }
    })
    expect(collection).toEqual({ items: [] })
  })

  test('returns the parsed collection for a matching GeoJSON dataset', () => {
    const collection = parseUploadedFileContent({
      dataset: 'map-land',
      file: {
        contentType: 'application/geo+json',
        payload: { type: 'FeatureCollection', features: [] }
      }
    })
    expect(collection.type).toBe('FeatureCollection')
  })

  test('rejects a mismatched media type', () => {
    expect(() =>
      parseUploadedFileContent({
        dataset: 'ports',
        file: { contentType: 'text/csv', payload: 'a,b,c' }
      })
    ).toThrow(/content type/)
  })

  test('rejects a malformed JSON file (raw Buffer fallback)', () => {
    expect(() =>
      parseUploadedFileContent({
        dataset: 'ports',
        file: {
          contentType: 'application/json',
          payload: Buffer.from('not json')
        }
      })
    ).toThrow(/not valid JSON/)
  })

  test('rejects an empty file', () => {
    expect(() =>
      parseUploadedFileContent({
        dataset: 'ports',
        file: { contentType: 'application/json', payload: {} }
      })
    ).toThrow(/empty/)
  })
})

describe('#resolveUploadMetadata', () => {
  test('resolves schemaVersion/version from the collection when fields are absent', () => {
    const metadata = resolveUploadMetadata({
      fields: {},
      collection: { schemaVersion: '1.0', version: '2026.09.17.1' }
    })
    expect(metadata).toEqual({
      schemaVersion: '1.0',
      version: '2026.09.17.1',
      effectiveFrom: undefined,
      description: undefined
    })
  })

  test('accepts matching field and envelope values', () => {
    const metadata = resolveUploadMetadata({
      fields: { schemaVersion: '1.0', version: '2026.09.17.1' },
      collection: { schemaVersion: '1.0', version: '2026.09.17.1' }
    })
    expect(metadata.schemaVersion).toBe('1.0')
  })

  test('rejects a conflicting schemaVersion', () => {
    expect(() =>
      resolveUploadMetadata({
        fields: { schemaVersion: '2.0' },
        collection: { schemaVersion: '1.0' }
      })
    ).toThrow(/schemaVersion/)
  })

  test('rejects a conflicting version', () => {
    expect(() =>
      resolveUploadMetadata({
        fields: { version: '2026.01.01.1' },
        collection: { version: '2026.09.17.1' }
      })
    ).toThrow(/version/)
  })

  test('rejects an invalid effectiveFrom', () => {
    expect(() =>
      resolveUploadMetadata({
        fields: { effectiveFrom: 'not-a-date' },
        collection: {}
      })
    ).toThrow(/effectiveFrom/)
  })

  test('accepts a valid effectiveFrom', () => {
    const metadata = resolveUploadMetadata({
      fields: { effectiveFrom: '2026-09-17T00:00:00Z' },
      collection: {}
    })
    expect(metadata.effectiveFrom).toBe('2026-09-17T00:00:00Z')
  })

  test('rejects an over-long description', () => {
    expect(() =>
      resolveUploadMetadata({
        fields: { description: 'x'.repeat(501) },
        collection: {}
      })
    ).toThrow(/description/)
  })

  test('does not mutate the supplied collection', () => {
    const collection = { schemaVersion: '1.0', version: '2026.09.17.1' }
    const before = structuredClone(collection)
    resolveUploadMetadata({ fields: {}, collection })
    expect(collection).toEqual(before)
  })

  test('treats a missing/non-object collection as an empty envelope', () => {
    const metadata = resolveUploadMetadata({
      fields: { schemaVersion: '1.0', version: '2026.09.17.1' }
    })
    expect(metadata.schemaVersion).toBe('1.0')
    expect(metadata.version).toBe('2026.09.17.1')
  })
})
