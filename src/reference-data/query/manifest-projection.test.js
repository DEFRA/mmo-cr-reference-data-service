import { describe, expect, test } from 'vitest'

import { projectManifest } from './manifest-projection.js'

function buildManifest(overrides = {}) {
  return {
    manifestId: 'c7b49c26-d6c0-4ab1-9318-cd1c862f4768',
    version: '2026.09.11.3',
    generatedAt: '2026-09-11T08:32:14Z',
    datasets: [
      {
        dataset: 'ports',
        collectionId: '0be553de-f430-49f7-b120-1e8e5ad972dc',
        schemaVersion: '1.0',
        version: '2026.09.11.1',
        format: 'json',
        etag: '"sha256-1c10d2"',
        checksum: 'sha256:abc123',
        itemCount: 1834,
        sizeBytes: 842312,
        lastModified: '2026-09-11T08:30:00Z'
      },
      {
        dataset: 'map-statistical-areas',
        collectionId: '1d7dd249-3732-4d57-b8cc-7b487c76e916',
        schemaVersion: '1.0',
        version: '2026.08.20.1',
        format: 'geojson',
        etag: '"sha256-e5581c"',
        checksum: 'sha256:def456',
        itemCount: 3465,
        sizeBytes: 2100000,
        lastModified: '2026-08-20T09:15:00Z'
      }
    ],
    ...overrides
  }
}

describe('#projectManifest', () => {
  test('projects manifest-level properties', () => {
    const { body } = projectManifest(buildManifest())
    expect(body.manifestId).toBe('c7b49c26-d6c0-4ab1-9318-cd1c862f4768')
    expect(body.version).toBe('2026.09.11.3')
    expect(body.generatedAt).toBe('2026-09-11T08:32:14Z')
  })

  test('projects a JSON dataset entry with itemCount and no featureCount/crs', () => {
    const { body } = projectManifest(buildManifest())
    const ports = body.datasets.find((entry) => entry.dataset === 'ports')
    expect(ports).toEqual({
      dataset: 'ports',
      collectionId: '0be553de-f430-49f7-b120-1e8e5ad972dc',
      schemaVersion: '1.0',
      version: '2026.09.11.1',
      etag: '"sha256-1c10d2"',
      url: '/api/v1/reference-data/ports',
      format: 'json',
      itemCount: 1834,
      sizeBytes: 842312,
      lastModified: '2026-09-11T08:30:00Z'
    })
  })

  test('projects a GeoJSON dataset entry with featureCount and crs, no itemCount', () => {
    const { body } = projectManifest(buildManifest())
    const areas = body.datasets.find(
      (entry) => entry.dataset === 'map-statistical-areas'
    )
    expect(areas.featureCount).toBe(3465)
    expect(areas.crs).toBe('EPSG:4326')
    expect(areas).not.toHaveProperty('itemCount')
    expect(areas.url).toBe('/api/v1/reference-data/map/statistical-areas')
  })

  test('omits sizeBytes when not a number', () => {
    const manifest = buildManifest({
      datasets: [
        {
          dataset: 'vessels',
          collectionId: '6bd5950c-527c-43c8-88f8-ee853169db1d',
          schemaVersion: '1.0',
          version: '2026.09.11.1',
          format: 'json',
          etag: '"sha256-abc"',
          itemCount: 10,
          lastModified: '2026-09-11T08:30:00Z'
        }
      ]
    })
    const { body } = projectManifest(manifest)
    expect(body.datasets[0]).not.toHaveProperty('sizeBytes')
  })

  test('never exposes objectRef, checksum, or bucket/S3 details', () => {
    const { body } = projectManifest(buildManifest())
    const serialised = JSON.stringify(body)
    expect(serialised).not.toMatch(/checksum|objectRef|bucket|floci|s3:/i)
  })

  test('orders entries deterministically by the canonical dataset registry order', () => {
    // datasets supplied out of canonical order (map-statistical-areas before ports's neighbours)
    const manifest = buildManifest({
      datasets: [
        {
          dataset: 'species',
          collectionId: '11111111-1111-1111-1111-111111111111',
          schemaVersion: '1.0',
          version: '1',
          format: 'json',
          etag: '"a"',
          itemCount: 1,
          lastModified: '2026-01-01T00:00:00Z'
        },
        {
          dataset: 'vessels',
          collectionId: '22222222-2222-2222-2222-222222222222',
          schemaVersion: '1.0',
          version: '1',
          format: 'json',
          etag: '"b"',
          itemCount: 1,
          lastModified: '2026-01-01T00:00:00Z'
        }
      ]
    })
    const { body } = projectManifest(manifest)
    expect(body.datasets.map((entry) => entry.dataset)).toEqual([
      'vessels',
      'species'
    ])
  })

  test('applies the include filter while preserving canonical ordering', () => {
    const { body } = projectManifest(buildManifest(), {
      include: ['map-statistical-areas', 'ports']
    })
    expect(body.datasets.map((entry) => entry.dataset)).toEqual([
      'ports',
      'map-statistical-areas'
    ])
  })

  test('no include filter returns every entry', () => {
    const { body } = projectManifest(buildManifest())
    expect(body.datasets).toHaveLength(2)
  })

  test('does not mutate the input manifest', () => {
    const manifest = buildManifest()
    const clone = JSON.parse(JSON.stringify(manifest))
    projectManifest(manifest, { include: ['ports'] })
    expect(manifest).toEqual(clone)
  })

  describe('#etag', () => {
    test('is stable for an unchanged manifest', () => {
      const first = projectManifest(buildManifest())
      const second = projectManifest(buildManifest())
      expect(first.etag).toBe(second.etag)
    })

    test('changes when the manifest version changes', () => {
      const first = projectManifest(buildManifest())
      const second = projectManifest(buildManifest({ version: '2026.09.12.1' }))
      expect(first.etag).not.toBe(second.etag)
    })

    test('does not depend on generatedAt', () => {
      const first = projectManifest(buildManifest())
      const second = projectManifest(
        buildManifest({ generatedAt: '2027-01-01T00:00:00Z' })
      )
      expect(first.etag).toBe(second.etag)
    })

    test('filtered and unfiltered views share the same manifest ETag', () => {
      const full = projectManifest(buildManifest())
      const filtered = projectManifest(buildManifest(), {
        include: ['ports']
      })
      expect(full.etag).toBe(filtered.etag)
    })

    test('is a quoted string', () => {
      const { etag } = projectManifest(buildManifest())
      expect(etag.startsWith('"')).toBe(true)
      expect(etag.endsWith('"')).toBe(true)
    })
  })
})
