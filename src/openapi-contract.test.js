// Step 33/34: OpenAPI 3.1 contract-drift detection. Confirms `src/openapi/openapi.yaml`
// parses, is schema-valid, and never drifts from the registered Hapi routes — every
// public route has exactly one matching OpenAPI operation and vice versa. Also
// cross-checks operationId uniqueness, the public (Health/Documentation) tags'
// unauthenticated security override, and the shared error envelope shape against the
// runtime implementation.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as yamlModule from 'js-yaml'
import { Validator } from '@seriousme/openapi-schema-validator'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { createServer } from './server.js'
import { createErrorEnvelope } from '#/common/helpers/api/error-envelope.js'

// js-yaml's ESM build exposes its API as a default export under some loaders and as
// named exports under others; normalise once so `yaml.load` always works.
const yaml = yamlModule.default ?? yamlModule

const OPENAPI_PATH = fileURLToPath(
  new URL('./openapi/openapi.yaml', import.meta.url)
)

// Tags whose operations are allowed to opt out of the global bearerAuth requirement
// (unauthenticated routes only — health/readiness/dependency-status and the
// self-describing OpenAPI document endpoints).
const PUBLIC_TAGS = ['Health', 'Documentation']

// Hapi's internal `/{p*}` not-found catch-all and any ad-hoc test-only routes
// registered elsewhere are not part of the published contract.
const EXCLUDED_PATH_PATTERNS = [/^\/__test/]

function isPublishedRoute(path) {
  return !EXCLUDED_PATH_PATTERNS.some((pattern) => pattern.test(path))
}

function loadSpec() {
  return yaml.load(readFileSync(OPENAPI_PATH, 'utf-8'))
}

function collectOperations(spec) {
  const operations = []
  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!['get', 'put', 'post', 'patch', 'delete'].includes(method)) {
        continue
      }
      operations.push({ path, method: method.toUpperCase(), operation })
    }
  }
  return operations
}

describe('#openApiContract', () => {
  let server
  let spec

  beforeAll(async () => {
    spec = loadSpec()
    server = await createServer()
  })

  afterAll(async () => {
    await server.stop()
  })

  test('parses as valid YAML', () => {
    expect(spec).toBeTypeOf('object')
    expect(spec.openapi).toMatch(/^3\.1\./)
  })

  test('validates against the OpenAPI 3.1 meta-schema', async () => {
    const validator = new Validator()
    const result = await validator.validate(spec)
    expect(result.errors ?? result.valid).not.toBe(false)
    expect(result.valid).toBe(true)
  })

  test('every registered public route has a matching OpenAPI operation', () => {
    const registeredRoutes = server
      .table()
      .map((route) => ({
        method: route.method.toUpperCase(),
        path: route.path
      }))
      .filter((route) => isPublishedRoute(route.path))

    const operations = collectOperations(spec)
    const operationKeys = new Set(
      operations.map(({ method, path }) => `${method} ${path}`)
    )

    const missing = registeredRoutes.filter(
      (route) => !operationKeys.has(`${route.method} ${route.path}`)
    )

    expect(missing).toEqual([])
  })

  test('every OpenAPI operation maps to a registered route', () => {
    const registeredRouteKeys = new Set(
      server
        .table()
        .map((route) => `${route.method.toUpperCase()} ${route.path}`)
    )

    const operations = collectOperations(spec)
    const unmapped = operations.filter(
      ({ method, path }) => !registeredRouteKeys.has(`${method} ${path}`)
    )

    expect(unmapped).toEqual([])
  })

  test('every operationId is unique', () => {
    const operations = collectOperations(spec)
    const operationIds = operations.map(
      ({ operation }) => operation.operationId
    )

    expect(
      operationIds.every((id) => typeof id === 'string' && id.length > 0)
    ).toBe(true)
    expect(new Set(operationIds).size).toBe(operationIds.length)
  })

  test('only public-tagged operations opt out of bearer authentication', () => {
    const operations = collectOperations(spec)

    for (const { path, method, operation } of operations) {
      const isPublicTagged = (operation.tags ?? []).some((tag) =>
        PUBLIC_TAGS.includes(tag)
      )
      if (isPublicTagged) {
        expect(
          operation.security,
          `${method} ${path} must explicitly opt out of security`
        ).toEqual([])
      } else {
        expect(
          operation.security,
          `${method} ${path} must not override the global bearerAuth requirement`
        ).toBeUndefined()
      }
    }

    expect(spec.security).toEqual([{ bearerAuth: [] }])
    expect(spec.components.securitySchemes.bearerAuth).toMatchObject({
      type: 'http',
      scheme: 'bearer'
    })
  })

  test('the shared ErrorEnvelope schema matches the runtime error envelope shape', () => {
    const runtimeEnvelope = createErrorEnvelope({
      code: 'invalid_request',
      message: 'example',
      traceId: 'trace-1',
      dataset: 'vessels',
      retryable: false,
      details: [{ path: 'limit', message: 'bad' }]
    })

    const schema = spec.components.schemas.ErrorEnvelope
    const errorProperties = schema.properties.error.properties

    expect(schema.properties.error.required).toEqual(
      expect.arrayContaining(['code', 'message', 'traceId'])
    )
    expect(Object.keys(errorProperties)).toEqual(
      expect.arrayContaining(Object.keys(runtimeEnvelope.error))
    )
  })

  test('the upload route documents every uploadable dataset and excludes map-ports', () => {
    const datasetParam = spec.paths[
      '/api/v1/reference-data/{dataset}'
    ].put.parameters.find((parameter) => parameter.name === 'dataset')

    expect(datasetParam.schema.enum).toEqual([
      'vessels',
      'gears',
      'ports',
      'species',
      'map-land',
      'map-statistical-areas'
    ])
    expect(datasetParam.schema.enum).not.toContain('map-ports')
  })
})
