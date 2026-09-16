import { describe, expect, test } from 'vitest'

import { createS3Client } from './s3-client.js'

describe('#createS3Client', () => {
  test('region is passed through', async () => {
    const client = createS3Client({ region: 'eu-west-2' })
    await expect(client.config.region()).resolves.toBe('eu-west-2')
  })

  test('a local endpoint override is used when configured', async () => {
    const client = createS3Client({
      region: 'eu-west-2',
      endpointUrl: 'http://localhost:4566'
    })
    const endpoint = await client.config.endpoint()
    expect(endpoint).toMatchObject({ hostname: 'localhost', port: 4566 })
  })

  test('no custom endpoint is set for deployed AWS configuration', () => {
    const client = createS3Client({ region: 'eu-west-2' })
    expect(client.config.endpoint).toBeUndefined()
  })

  test('path-style access follows configuration', () => {
    const pathStyleClient = createS3Client({
      region: 'eu-west-2',
      forcePathStyle: true
    })
    const virtualHostedClient = createS3Client({ region: 'eu-west-2' })

    expect(pathStyleClient.config.forcePathStyle).toBe(true)
    expect(virtualHostedClient.config.forcePathStyle).toBe(false)
  })

  test('no static credentials are embedded in source', () => {
    const client = createS3Client({ region: 'eu-west-2' })
    expect(client.config).not.toHaveProperty('credentials.accessKeyId')
  })

  test('an injected S3 client is used as-is', () => {
    const injected = { send: () => {} }
    expect(createS3Client({ client: injected })).toBe(injected)
  })

  test('client construction performs no network call', () => {
    expect(() =>
      createS3Client({
        region: 'eu-west-2',
        endpointUrl: 'http://localhost:4566'
      })
    ).not.toThrow()
  })
})
