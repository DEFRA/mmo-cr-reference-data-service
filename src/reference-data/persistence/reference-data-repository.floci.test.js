// Floci integration tests: verify the Persistence Module against the real S3-compatible endpoint.
// Requires `npm run floci:up` first; tests self-skip when Floci is unreachable so `npm test`
// never depends on Docker. Run explicitly with `npm run test:floci`.

import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, test } from 'vitest'

import { createReferenceDataRepository } from './reference-data-repository.js'
import { DATASETS } from '#/common/domain/datasets.js'

const FLOCI_HEALTH_URL = 'http://localhost:4566/_floci/health'
const BUCKET = 'mmo-cr-reference-data-service'
// Isolates this suite's objects from developer/seed data without changing production key logic.
const TEST_RUN_PREFIX = `test-${randomUUID()}`

let floccyAvailable = false

try {
  const response = await fetch(FLOCI_HEALTH_URL, {
    signal: AbortSignal.timeout(1000)
  })
  floccyAvailable = response.ok
} catch {
  floccyAvailable = false
}

describe.skipIf(!floccyAvailable)(
  '#referenceDataRepository (Floci integration)',
  () => {
    const repository = createReferenceDataRepository({
      region: 'eu-west-2',
      endpointUrl: 'http://localhost:4566',
      forcePathStyle: true,
      bucket: BUCKET
    })

    beforeAll(async () => {
      const health = await fetch(FLOCI_HEALTH_URL)
      expect(health.ok).toBe(true)
    })

    test('the configured bucket is accessible', async () => {
      await expect(
        repository.objectExists({
          dataset: DATASETS.VESSELS,
          collectionVersion: `${TEST_RUN_PREFIX}-missing`
        })
      ).resolves.toBe(false)
    })

    test('a versioned JSON collection can be written, read back, and its metadata retrieved', async () => {
      const collectionVersion = `${TEST_RUN_PREFIX}-vessels-v1`
      const content = { items: [{ id: randomUUID(), cfr: 'GBR123' }] }

      const writeResult = await repository.writeCollection({
        dataset: DATASETS.VESSELS,
        collectionVersion,
        content
      })
      expect(writeResult.etag).toBeTruthy()

      const { content: readContent } = await repository.readCollection({
        dataset: DATASETS.VESSELS,
        collectionVersion
      })
      expect(readContent).toEqual(content)

      const metadata = await repository.getObjectMetadata({
        dataset: DATASETS.VESSELS,
        collectionVersion
      })
      expect(metadata.etag).toBe(writeResult.etag)

      await expect(
        repository.objectExists({
          dataset: DATASETS.VESSELS,
          collectionVersion
        })
      ).resolves.toBe(true)
    })

    test('an existing collection version is not silently overwritten', async () => {
      const collectionVersion = `${TEST_RUN_PREFIX}-gears-v1`
      await repository.writeCollection({
        dataset: DATASETS.GEARS,
        collectionVersion,
        content: { items: [] }
      })

      await expect(
        repository.writeCollection({
          dataset: DATASETS.GEARS,
          collectionVersion,
          content: { items: [{ id: 'should-not-be-written' }] }
        })
      ).rejects.toMatchObject({ code: 'collection_version_exists' })
    })

    test('GeoJSON content type is preserved', async () => {
      const collectionVersion = `${TEST_RUN_PREFIX}-map-land-v1`
      await repository.writeCollection({
        dataset: DATASETS.MAP_LAND,
        collectionVersion,
        content: { type: 'FeatureCollection', features: [] }
      })

      const metadata = await repository.getObjectMetadata({
        dataset: DATASETS.MAP_LAND,
        collectionVersion
      })
      expect(metadata.contentType).toBe('application/geo+json')
    })

    test('a manifest can be written and read back', async () => {
      const manifest = {
        manifestId: `${TEST_RUN_PREFIX}-manifest`,
        datasets: []
      }
      const writeResult = await repository.writeManifest({ manifest })
      expect(writeResult.etag).toBeTruthy()

      const { manifest: readManifest, metadata } =
        await repository.readManifest()
      expect(readManifest).toEqual(manifest)
      expect(metadata.etag).toBe(writeResult.etag)
    })

    test('a missing object is handled correctly', async () => {
      await expect(
        repository.readCollection({
          dataset: DATASETS.SPECIES,
          collectionVersion: `${TEST_RUN_PREFIX}-does-not-exist`
        })
      ).rejects.toMatchObject({ code: 'dataset_not_found' })
    })
  }
)
