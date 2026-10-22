// Self-describing OpenAPI 3.1 document endpoints (Step 34). Serves the committed
// `src/openapi/openapi.yaml` contract — the same file validated by
// `npm run openapi:validate` and checked for drift by
// `src/openapi-contract.test.js` — as both raw YAML and parsed JSON. Public/
// unauthenticated like `/health`: this is published API documentation, not
// reference data, so it carries no `reference-data.read`/`.write` permission
// requirement. Read once at module load (the spec is a static, committed file;
// it never changes at runtime) rather than re-reading/re-parsing per request.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as yamlModule from 'js-yaml'

import { CACHE_CONTROL } from '#/common/helpers/api/cache-control.js'

// js-yaml's ESM build exposes its API as a default export under some loaders and as
// named exports under others; normalise once so `yaml.load` always works.
const yaml = yamlModule.default ?? yamlModule

const HTTP_STATUS_OK = 200
const OPENAPI_YAML_CONTENT_TYPE = 'application/yaml'

const OPENAPI_YAML_PATH = fileURLToPath(
  new URL('../openapi/openapi.yaml', import.meta.url)
)
const openApiYamlContent = readFileSync(OPENAPI_YAML_PATH, 'utf-8')
const openApiJsonDocument = yaml.load(openApiYamlContent)

function jsonHandler(_request, h) {
  return h
    .response(openApiJsonDocument)
    .code(HTTP_STATUS_OK)
    .header('Cache-Control', CACHE_CONTROL.REFERENCE_DATA_READ)
}

function yamlHandler(_request, h) {
  return h
    .response(openApiYamlContent)
    .code(HTTP_STATUS_OK)
    .type(OPENAPI_YAML_CONTENT_TYPE)
    .header('Cache-Control', CACHE_CONTROL.REFERENCE_DATA_READ)
}

export const openApiJson = {
  method: 'GET',
  path: '/openapi.json',
  handler: jsonHandler
}

export const openApiYaml = {
  method: 'GET',
  path: '/openapi.yaml',
  handler: yamlHandler
}
