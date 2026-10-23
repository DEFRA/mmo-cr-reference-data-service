import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { createServer } from '#/server.js'
import { openApiJson, openApiYaml } from './openapi.js'

describe('#openApiRoutes', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
  })

  afterAll(async () => {
    await server.stop()
  })

  test('is registered as GET /openapi.json', () => {
    expect(openApiJson.method).toBe('GET')
    expect(openApiJson.path).toBe('/openapi.json')
  })

  test('is registered as GET /openapi.yaml', () => {
    expect(openApiYaml.method).toBe('GET')
    expect(openApiYaml.path).toBe('/openapi.yaml')
  })

  test('GET /openapi.json returns the parsed contract with no authentication required', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/openapi.json'
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('application/json')
    expect(response.headers['cache-control']).toBe(
      'public, max-age=3600, stale-while-revalidate=86400'
    )
    expect(response.result.openapi).toMatch(/^3\.1\./)
    expect(response.result.paths['/openapi.json']).toBeDefined()
    expect(response.result.paths['/openapi.yaml']).toBeDefined()
  })

  test('GET /openapi.yaml returns the raw YAML file with no authentication required', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/openapi.yaml'
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('application/yaml')
    expect(response.headers['cache-control']).toBe(
      'public, max-age=3600, stale-while-revalidate=86400'
    )
    expect(response.payload).toContain('openapi: 3.1.')
    expect(response.payload).toContain('/openapi.json:')
  })

  test('GET /openapi.json and /openapi.yaml describe the same contract', async () => {
    const jsonResponse = await server.inject({
      method: 'GET',
      url: '/openapi.json'
    })
    const yamlResponse = await server.inject({
      method: 'GET',
      url: '/openapi.yaml'
    })

    expect(yamlResponse.payload).toContain(
      `title: ${jsonResponse.result.info.title}`
    )
  })
})
