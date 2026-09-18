import { createHash } from 'node:crypto'
import { describe, expect, test, vi } from 'vitest'
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand
} from '@aws-sdk/client-s3'

vi.mock('#/common/helpers/observability/metrics.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, recordCounter: vi.fn(), recordDuration: vi.fn() }
})

import { createReferenceDataRepository } from './reference-data-repository.js'
import { DATASETS } from '#/common/domain/datasets.js'

const BUCKET = 'test-bucket'
const FIXED_DATE = new Date('2024-01-01T00:00:00.000Z')

function createAwsError(name, statusCode) {
  const error = new Error(name)
  error.name = name
  error.$metadata = { httpStatusCode: statusCode }
  return error
}

function createFakeS3Client(seed = {}) {
  const objects = new Map(Object.entries(seed))
  let etagCounter = 0

  const send = vi.fn(async (command) => {
    if (command instanceof PutObjectCommand) {
      const {
        Key,
        Body,
        ContentType,
        IfNoneMatch,
        IfMatch,
        ChecksumAlgorithm
      } = command.input
      const existing = objects.get(Key)
      if (IfNoneMatch === '*' && existing) {
        throw createAwsError('PreconditionFailed', 412)
      }
      if (IfMatch && (!existing || `"${existing.etag}"` !== IfMatch)) {
        throw createAwsError('PreconditionFailed', 412)
      }
      etagCounter += 1
      const etag = `etag-${etagCounter}`
      const checksumSHA256 = ChecksumAlgorithm
        ? createHash('sha256').update(Body).digest('base64')
        : undefined
      objects.set(Key, {
        body: Body,
        contentType: ContentType,
        etag,
        checksumSHA256
      })
      return { ETag: `"${etag}"`, ChecksumSHA256: checksumSHA256 }
    }

    if (command instanceof GetObjectCommand) {
      const existing = objects.get(command.input.Key)
      if (!existing) {
        throw createAwsError('NoSuchKey', 404)
      }
      return {
        Body:
          existing.body === null
            ? undefined
            : { transformToString: async () => existing.body },
        ETag: `"${existing.etag}"`,
        ContentType: existing.contentType,
        ContentLength: Buffer.byteLength(existing.body ?? ''),
        LastModified: FIXED_DATE,
        ...(command.input.ChecksumMode === 'ENABLED'
          ? { ChecksumSHA256: existing.checksumSHA256 }
          : {})
      }
    }

    if (command instanceof HeadObjectCommand) {
      const existing = objects.get(command.input.Key)
      if (!existing) {
        throw createAwsError('NotFound', 404)
      }
      return {
        ETag: `"${existing.etag}"`,
        ContentType: existing.contentType,
        ContentLength: Buffer.byteLength(existing.body ?? ''),
        LastModified: FIXED_DATE,
        ...(command.input.ChecksumMode === 'ENABLED'
          ? { ChecksumSHA256: existing.checksumSHA256 }
          : {})
      }
    }

    throw new Error('Unsupported command in fake S3 client')
  })

  return { send, objects }
}

function createFailingS3Client(error) {
  return { send: vi.fn().mockRejectedValue(error) }
}

function seededObject({
  body,
  contentType = 'application/json',
  etag = 'seed-etag'
}) {
  return {
    body,
    contentType,
    etag,
    checksumSHA256: createHash('sha256').update(body).digest('base64')
  }
}

describe('#readCollection', () => {
  test('a JSON collection is retrieved and parsed', async () => {
    const content = { items: [{ id: 'v-1', cfr: 'GBR123' }] }
    const client = createFakeS3Client({
      'reference-data/vessels/v1.json': seededObject({
        body: JSON.stringify(content)
      })
    })
    const repository = createReferenceDataRepository({ bucket: BUCKET, client })

    const result = await repository.readCollection({
      dataset: DATASETS.VESSELS,
      collectionVersion: 'v1'
    })

    expect(result.content).toEqual(content)
  })

  test('a GeoJSON collection is retrieved and parsed', async () => {
    const content = { type: 'FeatureCollection', features: [] }
    const client = createFakeS3Client({
      'reference-data/map-land/v1.json': seededObject({
        body: JSON.stringify(content),
        contentType: 'application/geo+json'
      })
    })
    const repository = createReferenceDataRepository({ bucket: BUCKET, client })

    const result = await repository.readCollection({
      dataset: DATASETS.MAP_LAND,
      collectionVersion: 'v1'
    })

    expect(result.content).toEqual(content)
  })

  test('relevant metadata is mapped to domain metadata', async () => {
    const body = JSON.stringify({ items: [] })
    const client = createFakeS3Client({
      'reference-data/vessels/v1.json': seededObject({ body, etag: 'abc123' })
    })
    const repository = createReferenceDataRepository({ bucket: BUCKET, client })

    const { metadata } = await repository.readCollection({
      dataset: DATASETS.VESSELS,
      collectionVersion: 'v1'
    })

    expect(metadata).toMatchObject({
      dataset: DATASETS.VESSELS,
      collectionVersion: 'v1',
      objectKey: 'reference-data/vessels/v1.json',
      contentType: 'application/json',
      etag: 'abc123',
      sizeBytes: Buffer.byteLength(body),
      lastModifiedAt: FIXED_DATE.toISOString()
    })
    expect(metadata.checksum).toBeTruthy()
  })

  test('missing objects map to the expected error', async () => {
    const repository = createReferenceDataRepository({
      bucket: BUCKET,
      client: createFakeS3Client()
    })

    await expect(
      repository.readCollection({
        dataset: DATASETS.VESSELS,
        collectionVersion: 'v1'
      })
    ).rejects.toMatchObject({ code: 'dataset_not_found' })
  })

  test('missing response bodies map to the expected error', async () => {
    const client = createFakeS3Client({
      'reference-data/vessels/v1.json': seededObject({ body: '{}' })
    })
    client.objects.get('reference-data/vessels/v1.json').body = null
    const repository = createReferenceDataRepository({ bucket: BUCKET, client })

    await expect(
      repository.readCollection({
        dataset: DATASETS.VESSELS,
        collectionVersion: 'v1'
      })
    ).rejects.toMatchObject({ code: 'reference_data_unavailable' })
  })

  test('malformed JSON maps to the expected error', async () => {
    const client = createFakeS3Client({
      'reference-data/vessels/v1.json': seededObject({
        body: '{not valid json'
      })
    })
    const repository = createReferenceDataRepository({ bucket: BUCKET, client })

    await expect(
      repository.readCollection({
        dataset: DATASETS.VESSELS,
        collectionVersion: 'v1'
      })
    ).rejects.toMatchObject({ code: 'invalid_json' })
  })

  test('access-denied errors are mapped safely', async () => {
    const repository = createReferenceDataRepository({
      bucket: BUCKET,
      client: createFailingS3Client(createAwsError('AccessDenied', 403))
    })

    const error = await repository
      .readCollection({ dataset: DATASETS.VESSELS, collectionVersion: 'v1' })
      .catch((caught) => caught)

    expect(error.code).toBe('forbidden')
    expect(error.message).not.toMatch(/AccessKeyId|credential/i)
  })

  test('connection failures map to store-unavailable errors', async () => {
    const connectionError = new Error('connect ECONNREFUSED 127.0.0.1:4566')
    connectionError.code = 'ECONNREFUSED'
    const repository = createReferenceDataRepository({
      bucket: BUCKET,
      client: createFailingS3Client(connectionError)
    })

    await expect(
      repository.readCollection({
        dataset: DATASETS.VESSELS,
        collectionVersion: 'v1'
      })
    ).rejects.toMatchObject({
      code: 'reference_store_unavailable',
      retryable: true
    })
  })

  test('AWS SDK response objects do not escape the module', async () => {
    const client = createFakeS3Client({
      'reference-data/vessels/v1.json': seededObject({ body: '{"items":[]}' })
    })
    const repository = createReferenceDataRepository({ bucket: BUCKET, client })

    const result = await repository.readCollection({
      dataset: DATASETS.VESSELS,
      collectionVersion: 'v1'
    })

    expect(result).not.toHaveProperty('$metadata')
    expect(result.metadata).not.toHaveProperty('$metadata')
  })

  test('returned data preserves GUIDs, business codes, arrays, and numeric values', async () => {
    const content = {
      items: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          cfr: 'GBR123',
          length: 12.5,
          tags: ['a', 'b']
        }
      ]
    }
    const client = createFakeS3Client({
      'reference-data/vessels/v1.json': seededObject({
        body: JSON.stringify(content)
      })
    })
    const repository = createReferenceDataRepository({ bucket: BUCKET, client })

    const { content: readContent } = await repository.readCollection({
      dataset: DATASETS.VESSELS,
      collectionVersion: 'v1'
    })

    expect(readContent).toEqual(content)
  })
})

describe('#writeCollection', () => {
  test('JSON collections use application/json', async () => {
    const client = createFakeS3Client()
    const repository = createReferenceDataRepository({ bucket: BUCKET, client })

    await repository.writeCollection({
      dataset: DATASETS.VESSELS,
      collectionVersion: 'v1',
      content: { items: [] }
    })

    const putCall = client.send.mock.calls
      .map(([command]) => command)
      .find((command) => command instanceof PutObjectCommand)
    expect(putCall.input.ContentType).toBe('application/json')
  })

  test('GeoJSON collections use application/geo+json', async () => {
    const client = createFakeS3Client()
    const repository = createReferenceDataRepository({ bucket: BUCKET, client })

    await repository.writeCollection({
      dataset: DATASETS.MAP_LAND,
      collectionVersion: 'v1',
      content: { type: 'FeatureCollection', features: [] }
    })

    const putCall = client.send.mock.calls
      .map(([command]) => command)
      .find((command) => command instanceof PutObjectCommand)
    expect(putCall.input.ContentType).toBe('application/geo+json')
  })

  test('the correct bucket and object key are used', async () => {
    const client = createFakeS3Client()
    const repository = createReferenceDataRepository({ bucket: BUCKET, client })

    await repository.writeCollection({
      dataset: DATASETS.PORTS,
      collectionVersion: 'v1',
      content: { items: [] }
    })

    const putCall = client.send.mock.calls
      .map(([command]) => command)
      .find((command) => command instanceof PutObjectCommand)
    expect(putCall.input.Bucket).toBe(BUCKET)
    expect(putCall.input.Key).toBe('reference-data/ports/v1.json')
  })

  test('the complete canonical collection is serialised', async () => {
    const client = createFakeS3Client()
    const repository = createReferenceDataRepository({ bucket: BUCKET, client })
    const content = { items: [{ id: 'g-1', code: 'OTB' }] }

    await repository.writeCollection({
      dataset: DATASETS.GEARS,
      collectionVersion: 'v1',
      content
    })

    const putCall = client.send.mock.calls
      .map(([command]) => command)
      .find((command) => command instanceof PutObjectCommand)
    expect(JSON.parse(putCall.input.Body)).toEqual(content)
  })

  test('input objects are not mutated', async () => {
    const client = createFakeS3Client()
    const repository = createReferenceDataRepository({ bucket: BUCKET, client })
    const content = Object.freeze({ items: Object.freeze([]) })

    await expect(
      repository.writeCollection({
        dataset: DATASETS.GEARS,
        collectionVersion: 'v1',
        content
      })
    ).resolves.toBeDefined()
  })

  test('checksum metadata is returned as defined', async () => {
    const client = createFakeS3Client()
    const repository = createReferenceDataRepository({ bucket: BUCKET, client })

    const metadata = await repository.writeCollection({
      dataset: DATASETS.GEARS,
      collectionVersion: 'v1',
      content: { items: [] }
    })

    expect(metadata.checksum).toBeTruthy()
    expect(metadata.checksumAlgorithm).toBe('sha256')
  })

  test('S3 ETag is preserved separately from the checksum', async () => {
    const client = createFakeS3Client()
    const repository = createReferenceDataRepository({ bucket: BUCKET, client })

    const metadata = await repository.writeCollection({
      dataset: DATASETS.GEARS,
      collectionVersion: 'v1',
      content: { items: [] }
    })

    expect(metadata.etag).not.toBe(metadata.checksum)
  })

  test('lastModifiedAt falls back to a captured upload timestamp (PutObject never returns LastModified)', async () => {
    const client = createFakeS3Client()
    const repository = createReferenceDataRepository({ bucket: BUCKET, client })

    const metadata = await repository.writeCollection({
      dataset: DATASETS.GEARS,
      collectionVersion: 'v1',
      content: { items: [] }
    })

    expect(metadata.lastModifiedAt).toEqual(expect.any(String))
    expect(() => new Date(metadata.lastModifiedAt).toISOString()).not.toThrow()
  })

  test('existing versions produce the expected conflict', async () => {
    const client = createFakeS3Client({
      'reference-data/gears/v1.json': seededObject({ body: '{"items":[]}' })
    })
    const repository = createReferenceDataRepository({ bucket: BUCKET, client })

    await expect(
      repository.writeCollection({
        dataset: DATASETS.GEARS,
        collectionVersion: 'v1',
        content: { items: [] }
      })
    ).rejects.toMatchObject({ code: 'collection_version_exists' })
  })

  test('map-ports cannot be written', async () => {
    const repository = createReferenceDataRepository({
      bucket: BUCKET,
      client: createFakeS3Client()
    })

    await expect(
      repository.writeCollection({
        dataset: DATASETS.MAP_PORTS,
        collectionVersion: 'v1',
        content: { type: 'FeatureCollection', features: [] }
      })
    ).rejects.toMatchObject({ code: 'invalid_dataset' })
  })

  test('unsupported datasets are rejected', async () => {
    const repository = createReferenceDataRepository({
      bucket: BUCKET,
      client: createFakeS3Client()
    })

    await expect(
      repository.writeCollection({
        dataset: 'unknown',
        collectionVersion: 'v1',
        content: {}
      })
    ).rejects.toMatchObject({ code: 'invalid_dataset' })
  })

  test('failed writes produce safe service errors', async () => {
    const repository = createReferenceDataRepository({
      bucket: BUCKET,
      client: createFailingS3Client(createAwsError('AccessDenied', 403))
    })

    const error = await repository
      .writeCollection({
        dataset: DATASETS.VESSELS,
        collectionVersion: 'v1',
        content: {}
      })
      .catch((caught) => caught)

    expect(error.code).toBe('forbidden')
  })

  test('a non-conflict PutObject failure after a clean pre-check is mapped safely', async () => {
    const client = {
      send: vi.fn(async (command) => {
        if (command instanceof HeadObjectCommand) {
          throw createAwsError('NotFound', 404)
        }
        if (command instanceof PutObjectCommand) {
          throw createAwsError('AccessDenied', 403)
        }
        throw new Error('Unsupported command in fake S3 client')
      })
    }
    const repository = createReferenceDataRepository({ bucket: BUCKET, client })

    await expect(
      repository.writeCollection({
        dataset: DATASETS.VESSELS,
        collectionVersion: 'v1',
        content: {}
      })
    ).rejects.toMatchObject({ code: 'forbidden' })
  })

  test('a genuine concurrent-write race (absent at pre-check, rejected by S3) is still a conflict', async () => {
    const client = {
      send: vi.fn(async (command) => {
        if (command instanceof HeadObjectCommand) {
          throw createAwsError('NotFound', 404)
        }
        if (command instanceof PutObjectCommand) {
          throw createAwsError('PreconditionFailed', 412)
        }
        throw new Error('Unsupported command in fake S3 client')
      })
    }
    const repository = createReferenceDataRepository({ bucket: BUCKET, client })

    await expect(
      repository.writeCollection({
        dataset: DATASETS.VESSELS,
        collectionVersion: 'v1',
        content: {}
      })
    ).rejects.toMatchObject({ code: 'collection_version_exists' })
  })

  test('complete collection contents are not included in errors', async () => {
    const sensitiveMarker = 'sensitive-vessel-owner-name'
    const repository = createReferenceDataRepository({
      bucket: BUCKET,
      client: createFailingS3Client(createAwsError('AccessDenied', 403))
    })

    const error = await repository
      .writeCollection({
        dataset: DATASETS.VESSELS,
        collectionVersion: 'v1',
        content: { items: [{ owner: sensitiveMarker }] }
      })
      .catch((caught) => caught)

    expect(error.message).not.toContain(sensitiveMarker)
    expect(JSON.stringify(error)).not.toContain(sensitiveMarker)
  })
})

describe('#readManifest', () => {
  test('the manifest is read from the approved key and parsed correctly', async () => {
    const manifest = { manifestId: 'm-1', datasets: [] }
    const client = createFakeS3Client({
      'reference-data/manifest.json': seededObject({
        body: JSON.stringify(manifest)
      })
    })
    const repository = createReferenceDataRepository({ bucket: BUCKET, client })

    const result = await repository.readManifest()

    expect(result.manifest).toEqual(manifest)
    const getCall = client.send.mock.calls
      .map(([command]) => command)
      .find((command) => command instanceof GetObjectCommand)
    expect(getCall.input.Key).toBe('reference-data/manifest.json')
  })

  test('a missing manifest maps to the expected error', async () => {
    const repository = createReferenceDataRepository({
      bucket: BUCKET,
      client: createFakeS3Client()
    })

    await expect(repository.readManifest()).rejects.toMatchObject({
      code: 'dataset_not_found'
    })
  })

  test('malformed manifest JSON maps to the expected error', async () => {
    const client = createFakeS3Client({
      'reference-data/manifest.json': seededObject({ body: 'not json' })
    })
    const repository = createReferenceDataRepository({ bucket: BUCKET, client })

    await expect(repository.readManifest()).rejects.toMatchObject({
      code: 'invalid_json'
    })
  })
})

describe('#writeManifest', () => {
  test('the manifest is written to the approved key using application/json', async () => {
    const client = createFakeS3Client()
    const repository = createReferenceDataRepository({ bucket: BUCKET, client })

    await repository.writeManifest({
      manifest: { manifestId: 'm-1', datasets: [] }
    })

    const putCall = client.send.mock.calls
      .map(([command]) => command)
      .find((command) => command instanceof PutObjectCommand)
    expect(putCall.input.Key).toBe('reference-data/manifest.json')
    expect(putCall.input.ContentType).toBe('application/json')
  })

  test('lastModifiedAt falls back to a captured upload timestamp (PutObject never returns LastModified)', async () => {
    const client = createFakeS3Client()
    const repository = createReferenceDataRepository({ bucket: BUCKET, client })

    const metadata = await repository.writeManifest({
      manifest: { manifestId: 'm-1', datasets: [] }
    })

    expect(metadata.lastModifiedAt).toEqual(expect.any(String))
  })

  test('expected ETag concurrency information is passed correctly', async () => {
    const client = createFakeS3Client({
      'reference-data/manifest.json': seededObject({
        body: '{"manifestId":"m-1"}',
        etag: 'etag-1'
      })
    })
    const repository = createReferenceDataRepository({ bucket: BUCKET, client })

    await expect(
      repository.writeManifest({
        manifest: { manifestId: 'm-2', datasets: [] },
        expectedEtag: 'etag-1'
      })
    ).resolves.toBeDefined()
  })

  test('conditional write failures map to collection_modified', async () => {
    const client = createFakeS3Client({
      'reference-data/manifest.json': seededObject({
        body: '{"manifestId":"m-1"}',
        etag: 'etag-1'
      })
    })
    const repository = createReferenceDataRepository({ bucket: BUCKET, client })

    await expect(
      repository.writeManifest({
        manifest: { manifestId: 'm-2', datasets: [] },
        expectedEtag: 'stale-etag'
      })
    ).rejects.toMatchObject({ code: 'collection_modified' })
  })

  test('a genuine concurrent manifest write (race at S3 level) still maps to collection_modified', async () => {
    const client = createFakeS3Client({
      'reference-data/manifest.json': seededObject({
        body: '{"manifestId":"m-1"}',
        etag: 'etag-1'
      })
    })
    client.send.mockImplementationOnce(async (command) => {
      if (command instanceof HeadObjectCommand) {
        return {
          ETag: '"etag-1"',
          ContentType: 'application/json',
          ContentLength: 1,
          LastModified: FIXED_DATE
        }
      }
      throw new Error('unexpected first call')
    })
    client.send.mockImplementationOnce(async (command) => {
      if (command instanceof PutObjectCommand) {
        throw createAwsError('PreconditionFailed', 412)
      }
      throw new Error('unexpected second call')
    })
    const repository = createReferenceDataRepository({ bucket: BUCKET, client })

    await expect(
      repository.writeManifest({
        manifest: { manifestId: 'm-2', datasets: [] },
        expectedEtag: 'etag-1'
      })
    ).rejects.toMatchObject({ code: 'collection_modified' })
  })

  test('a non-conflict PutObject failure is mapped safely', async () => {
    const repository = createReferenceDataRepository({
      bucket: BUCKET,
      client: createFailingS3Client(createAwsError('AccessDenied', 403))
    })

    await expect(
      repository.writeManifest({
        manifest: { manifestId: 'm-1', datasets: [] }
      })
    ).rejects.toMatchObject({ code: 'forbidden' })
  })

  test('manifest input is not mutated', async () => {
    const client = createFakeS3Client()
    const repository = createReferenceDataRepository({ bucket: BUCKET, client })
    const manifest = Object.freeze({
      manifestId: 'm-1',
      datasets: Object.freeze([])
    })

    await expect(repository.writeManifest({ manifest })).resolves.toBeDefined()
  })

  test('manifest write does not automatically load or write referenced collections', async () => {
    const client = createFakeS3Client()
    const repository = createReferenceDataRepository({ bucket: BUCKET, client })

    await repository.writeManifest({
      manifest: { manifestId: 'm-1', datasets: [{ dataset: DATASETS.VESSELS }] }
    })

    const keysWritten = client.send.mock.calls
      .map(([command]) => command)
      .filter((command) => command instanceof PutObjectCommand)
      .map((command) => command.input.Key)
    expect(keysWritten).toEqual(['reference-data/manifest.json'])
  })
})

describe('#getObjectMetadata', () => {
  test('metadata can be retrieved without a full collection read', async () => {
    const client = createFakeS3Client({
      'reference-data/vessels/v1.json': seededObject({
        body: '{"items":[]}',
        etag: 'abc'
      })
    })
    const repository = createReferenceDataRepository({ bucket: BUCKET, client })

    await repository.getObjectMetadata({
      dataset: DATASETS.VESSELS,
      collectionVersion: 'v1'
    })

    const commands = client.send.mock.calls.map(([command]) => command)
    expect(
      commands.some((command) => command instanceof GetObjectCommand)
    ).toBe(false)
    expect(
      commands.some((command) => command instanceof HeadObjectCommand)
    ).toBe(true)
  })

  test('ETag, last-modified, size, content type, and checksum are mapped correctly', async () => {
    const body = '{"items":[]}'
    const client = createFakeS3Client({
      'reference-data/vessels/v1.json': seededObject({ body, etag: 'abc' })
    })
    const repository = createReferenceDataRepository({ bucket: BUCKET, client })

    const metadata = await repository.getObjectMetadata({
      dataset: DATASETS.VESSELS,
      collectionVersion: 'v1'
    })

    expect(metadata).toMatchObject({
      etag: 'abc',
      lastModifiedAt: FIXED_DATE.toISOString(),
      sizeBytes: Buffer.byteLength(body),
      contentType: 'application/json'
    })
    expect(metadata.checksum).toBeTruthy()
  })

  test('not-found and unavailable conditions remain distinguishable', async () => {
    const notFoundRepository = createReferenceDataRepository({
      bucket: BUCKET,
      client: createFakeS3Client()
    })
    const unavailableRepository = createReferenceDataRepository({
      bucket: BUCKET,
      client: createFailingS3Client(createAwsError('AccessDenied', 403))
    })

    await expect(
      notFoundRepository.getObjectMetadata({
        dataset: DATASETS.VESSELS,
        collectionVersion: 'v1'
      })
    ).rejects.toMatchObject({ code: 'dataset_not_found' })
    await expect(
      unavailableRepository.getObjectMetadata({
        dataset: DATASETS.VESSELS,
        collectionVersion: 'v1'
      })
    ).rejects.toMatchObject({ code: 'forbidden' })
  })

  test('a not-found condition is also detected purely from the HTTP status code when the error name differs', async () => {
    // getExistingEtag's HeadObjectCommand pre-check treats this as "no pre-existing
    // object", so the write proceeds — exercising isNotFoundError's metadata-only path.
    const client = {
      send: vi.fn(async (command) => {
        if (command instanceof HeadObjectCommand) {
          const error = new Error('Not Found')
          error.name = 'UnexpectedErrorName'
          error.$metadata = { httpStatusCode: 404 }
          throw error
        }
        if (command instanceof PutObjectCommand) {
          return { ETag: '"etag-1"', LastModified: FIXED_DATE }
        }
        throw new Error(`unexpected command: ${command.constructor.name}`)
      })
    }
    const repository = createReferenceDataRepository({
      bucket: BUCKET,
      client
    })

    const result = await repository.writeCollection({
      dataset: DATASETS.VESSELS,
      collectionVersion: 'v1',
      content: { items: [] }
    })

    expect(result.etag).toBe('etag-1')
  })

  test('a precondition-failed write is also detected purely from the HTTP status code when the error name differs', async () => {
    const client = {
      send: vi.fn(async (command) => {
        if (command instanceof HeadObjectCommand) {
          const error = new Error('Not Found')
          error.name = 'NotFound'
          error.$metadata = { httpStatusCode: 404 }
          throw error
        }
        if (command instanceof PutObjectCommand) {
          const error = new Error('Precondition Failed')
          error.name = 'UnexpectedErrorName'
          error.$metadata = { httpStatusCode: 412 }
          throw error
        }
        throw new Error(`unexpected command: ${command.constructor.name}`)
      })
    }
    const repository = createReferenceDataRepository({
      bucket: BUCKET,
      client
    })

    await expect(
      repository.writeCollection({
        dataset: DATASETS.VESSELS,
        collectionVersion: 'v1',
        content: { items: [] }
      })
    ).rejects.toMatchObject({ code: 'collection_version_exists' })
  })

  test('the manifest can be resolved as a metadata target', async () => {
    const client = createFakeS3Client({
      'reference-data/manifest.json': seededObject({
        body: '{"manifestId":"m-1"}'
      })
    })
    const repository = createReferenceDataRepository({ bucket: BUCKET, client })

    const metadata = await repository.getObjectMetadata({ manifest: true })
    expect(metadata.objectKey).toBe('reference-data/manifest.json')
  })
})

describe('#objectExists', () => {
  test('an existing object returns true', async () => {
    const client = createFakeS3Client({
      'reference-data/vessels/v1.json': seededObject({ body: '{}' })
    })
    const repository = createReferenceDataRepository({ bucket: BUCKET, client })

    await expect(
      repository.objectExists({
        dataset: DATASETS.VESSELS,
        collectionVersion: 'v1'
      })
    ).resolves.toBe(true)
  })

  test('a confirmed not-found returns false', async () => {
    const repository = createReferenceDataRepository({
      bucket: BUCKET,
      client: createFakeS3Client()
    })

    await expect(
      repository.objectExists({
        dataset: DATASETS.VESSELS,
        collectionVersion: 'v1'
      })
    ).resolves.toBe(false)
  })

  test('access denied is not reported as absent', async () => {
    const repository = createReferenceDataRepository({
      bucket: BUCKET,
      client: createFailingS3Client(createAwsError('AccessDenied', 403))
    })

    await expect(
      repository.objectExists({
        dataset: DATASETS.VESSELS,
        collectionVersion: 'v1'
      })
    ).rejects.toMatchObject({ code: 'forbidden' })
  })

  test('a connection failure is not reported as absent', async () => {
    const connectionError = new Error('connect ECONNREFUSED')
    connectionError.code = 'ECONNREFUSED'
    const repository = createReferenceDataRepository({
      bucket: BUCKET,
      client: createFailingS3Client(connectionError)
    })

    await expect(
      repository.objectExists({
        dataset: DATASETS.VESSELS,
        collectionVersion: 'v1'
      })
    ).rejects.toMatchObject({ code: 'reference_store_unavailable' })
  })

  test('unsupported datasets are rejected', async () => {
    const repository = createReferenceDataRepository({
      bucket: BUCKET,
      client: createFakeS3Client()
    })

    await expect(
      repository.objectExists({ dataset: 'unknown', collectionVersion: 'v1' })
    ).rejects.toMatchObject({ code: 'invalid_dataset' })
  })

  test('map-ports is rejected as independently persisted data', async () => {
    const repository = createReferenceDataRepository({
      bucket: BUCKET,
      client: createFakeS3Client()
    })

    await expect(
      repository.objectExists({
        dataset: DATASETS.MAP_PORTS,
        collectionVersion: 'v1'
      })
    ).rejects.toMatchObject({ code: 'invalid_dataset' })
  })
})

describe('#errorSafety', () => {
  test('public-safe service errors do not contain credentials', async () => {
    const credentialLeak = new Error(
      'InvalidAccessKeyId: AKIASECRETVALUE is invalid'
    )
    credentialLeak.name = 'InvalidAccessKeyId'
    const repository = createReferenceDataRepository({
      bucket: BUCKET,
      client: createFailingS3Client(credentialLeak)
    })

    const error = await repository
      .readCollection({ dataset: DATASETS.VESSELS, collectionVersion: 'v1' })
      .catch((caught) => caught)

    expect(error.message).not.toContain('AKIASECRETVALUE')
  })

  test('errors do not contain complete AWS SDK responses', async () => {
    const awsError = createAwsError('AccessDenied', 403)
    awsError.$metadata.requestId = 'internal-request-id'
    const repository = createReferenceDataRepository({
      bucket: BUCKET,
      client: createFailingS3Client(awsError)
    })

    const error = await repository
      .readCollection({ dataset: DATASETS.VESSELS, collectionVersion: 'v1' })
      .catch((caught) => caught)

    expect(error).not.toHaveProperty('$metadata')
  })

  test('internal causes remain available only through the approved internal mechanism', async () => {
    const awsError = createAwsError('AccessDenied', 403)
    const repository = createReferenceDataRepository({
      bucket: BUCKET,
      client: createFailingS3Client(awsError)
    })

    const error = await repository
      .readCollection({ dataset: DATASETS.VESSELS, collectionVersion: 'v1' })
      .catch((caught) => caught)

    expect(error.cause).toBe(awsError)
  })
})

describe('#observability', () => {
  function createSpyLogger() {
    return { debug: vi.fn(), warn: vi.fn() }
  }

  test('a successful operation logs a safe completion summary and records metrics', async () => {
    const { recordDuration } =
      await import('#/common/helpers/observability/metrics.js')
    const content = { items: [{ id: 'v-1', cfr: 'GBR123' }] }
    const client = createFakeS3Client({
      'reference-data/vessels/v1.json': seededObject({
        body: JSON.stringify(content)
      })
    })
    const logger = createSpyLogger()
    const repository = createReferenceDataRepository({
      bucket: BUCKET,
      client,
      logger
    })

    await repository.readCollection({
      dataset: DATASETS.VESSELS,
      collectionVersion: 'v1'
    })

    expect(logger.debug).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'reference_data.persistence_operation_completed',
        operation: 'readCollection',
        dataset: DATASETS.VESSELS
      }),
      'persistence: operation completed'
    )
    expect(recordDuration).toHaveBeenCalledWith(
      'reference_data_persistence_operation_duration_ms',
      expect.any(Number),
      { operation: 'readCollection', dataset: DATASETS.VESSELS }
    )
  })

  test('a failed operation logs a safe warning with the classified error code and records a failure metric', async () => {
    const { recordCounter } =
      await import('#/common/helpers/observability/metrics.js')
    const awsError = createAwsError('AccessDenied', 403)
    const logger = createSpyLogger()
    const repository = createReferenceDataRepository({
      bucket: BUCKET,
      client: createFailingS3Client(awsError),
      logger
    })

    await repository
      .readCollection({ dataset: DATASETS.VESSELS, collectionVersion: 'v1' })
      .catch(() => {})

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'reference_data.persistence_operation_failed',
        operation: 'readCollection',
        dataset: DATASETS.VESSELS,
        errorCode: 'forbidden'
      }),
      'persistence: operation failed'
    )
    expect(recordCounter).toHaveBeenCalledWith(
      'reference_data_persistence_failures_total',
      1,
      {
        operation: 'readCollection',
        dataset: DATASETS.VESSELS,
        error_code: 'forbidden'
      }
    )
  })

  test('never logs object content, credentials, or raw AWS responses', async () => {
    const content = { items: [{ id: 'v-1', cfr: 'GBR123', secret: 'nope' }] }
    const client = createFakeS3Client({
      'reference-data/vessels/v1.json': seededObject({
        body: JSON.stringify(content)
      })
    })
    const logger = createSpyLogger()
    const repository = createReferenceDataRepository({
      bucket: BUCKET,
      client,
      logger
    })

    await repository.readCollection({
      dataset: DATASETS.VESSELS,
      collectionVersion: 'v1'
    })

    const serialised = JSON.stringify(logger.debug.mock.calls)
    expect(serialised).not.toContain('GBR123')
    expect(serialised).not.toContain('secret')
  })

  test('manifest operations record no dataset dimension', async () => {
    const { recordDuration } =
      await import('#/common/helpers/observability/metrics.js')
    const client = createFakeS3Client({
      'reference-data/manifest.json': seededObject({
        body: JSON.stringify({ manifestId: 'm1', datasets: [] })
      })
    })
    const repository = createReferenceDataRepository({ bucket: BUCKET, client })

    await repository.readManifest()

    expect(recordDuration).toHaveBeenCalledWith(
      'reference_data_persistence_operation_duration_ms',
      expect.any(Number),
      { operation: 'readManifest', dataset: null }
    )
  })
})
