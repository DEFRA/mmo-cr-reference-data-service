import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import Joi from 'joi'

import { createServer } from './server.js'
import { config } from './config.js'

const TRACING_HEADER = config.get('tracing.header')

let server

beforeAll(async () => {
  server = await createServer()

  server.route([
    {
      method: 'GET',
      path: '/__test/ok',
      handler: () => ({ hello: 'world' })
    },
    {
      method: 'GET',
      path: '/__test/known-error',
      handler: () => {
        const error = new Error('Species collection is not available')
        error.code = 'reference_data_unavailable'
        error.dataset = 'species'
        error.retryable = true
        throw error
      }
    },
    {
      method: 'GET',
      path: '/__test/unexpected-error',
      handler: () => {
        throw new Error('something truly unexpected')
      }
    },
    {
      method: 'GET',
      path: '/__test/validated',
      options: {
        validate: {
          query: Joi.object({
            limit: Joi.number().integer().min(1).required()
          })
        }
      },
      handler: (request) => ({ limit: request.query.limit })
    }
  ])

  await server.initialize()
})

afterAll(async () => {
  await server.stop()
})

describe('#server common API behaviour', () => {
  test('a successful response includes the correlation header and JSON content type', async () => {
    const response = await server.inject({ method: 'GET', url: '/__test/ok' })

    expect(response.statusCode).toBe(200)
    expect(response.headers[TRACING_HEADER]).toBeDefined()
    expect(response.headers['content-type']).toContain('application/json')
  })

  test('a valid supplied correlation id is preserved in the response header', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/__test/ok',
      headers: { [TRACING_HEADER]: 'my-correlation-id-123' }
    })

    expect(response.headers[TRACING_HEADER]).toBe('my-correlation-id-123')
  })

  test('an invalid supplied correlation id is replaced with a generated one', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/__test/ok',
      headers: { [TRACING_HEADER]: 'invalid header value with spaces' }
    })

    expect(response.headers[TRACING_HEADER]).toBeDefined()
    expect(response.headers[TRACING_HEADER]).not.toBe(
      'invalid header value with spaces'
    )
  })

  test('a missing correlation id is generated', async () => {
    const response = await server.inject({ method: 'GET', url: '/__test/ok' })

    expect(response.headers[TRACING_HEADER]).toMatch(/^[\w-]{1,100}$/)
  })

  test('a known domain/service error maps to its configured status and envelope', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/__test/known-error'
    })

    expect(response.statusCode).toBe(503)
    const body = JSON.parse(response.payload)
    expect(body.error).toEqual({
      code: 'reference_data_unavailable',
      message: 'Species collection is not available',
      traceId: expect.any(String),
      dataset: 'species',
      retryable: true
    })
    expect(response.headers[TRACING_HEADER]).toBe(body.error.traceId)
  })

  test('an unexpected error becomes a safe 500 with no stack trace', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/__test/unexpected-error'
    })

    expect(response.statusCode).toBe(500)
    const body = JSON.parse(response.payload)
    expect(body.error.code).toBe('internal_server_error')
    expect(body.error.message).toBe('An unexpected error occurred.')
    expect(response.payload).not.toContain('something truly unexpected')
    expect(response.payload).not.toContain('.js:')
  })

  test('an unmatched route returns a JSON route_not_found error', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/this-route-does-not-exist'
    })

    expect(response.statusCode).toBe(404)
    expect(response.headers['content-type']).toContain('application/json')
    const body = JSON.parse(response.payload)
    expect(body.error.code).toBe('route_not_found')
    expect(response.headers[TRACING_HEADER]).toBeDefined()
  })

  test('a route query-validation failure returns structured, allowlisted details', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/__test/validated?limit=not-a-number'
    })

    expect(response.statusCode).toBe(400)
    const body = JSON.parse(response.payload)
    expect(body.error.code).toBe('invalid_request')
    expect(Array.isArray(body.error.details)).toBe(true)
    expect(body.error.details.length).toBeGreaterThan(0)
    expect(body.error.details[0]).toHaveProperty('path')
    expect(body.error.details[0]).toHaveProperty('message')
  })

  test('a valid query passes through to the handler unaffected', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/__test/validated?limit=10'
    })

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.payload)).toEqual({ limit: 10 })
  })

  test('health and readiness contracts remain intact and are not treated as errors', async () => {
    const health = await server.inject({ method: 'GET', url: '/health' })
    expect(health.statusCode).toBe(200)

    const readiness = await server.inject({
      method: 'GET',
      url: '/health/ready'
    })
    expect([200, 503]).toContain(readiness.statusCode)
    expect(readiness.headers[TRACING_HEADER]).toBeDefined()
  })
})
