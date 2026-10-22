// Standalone OpenAPI 3.1 validation entry point (`npm run openapi:validate`).
// Mirrors the checks in `src/openapi-contract.test.js` for ad-hoc/CI use outside
// the Vitest suite — parses the YAML and validates it against the official
// OpenAPI 3.1 meta-schema, failing the process (non-zero exit code) on error.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as yamlModule from 'js-yaml'
import { Validator } from '@seriousme/openapi-schema-validator'

const yaml = yamlModule.default ?? yamlModule
const OPENAPI_PATH = fileURLToPath(
  new URL('../src/openapi/openapi.yaml', import.meta.url)
)

const spec = yaml.load(readFileSync(OPENAPI_PATH, 'utf-8'))
const validator = new Validator()
const result = await validator.validate(spec)

if (!result.valid) {
  console.error(
    'src/openapi/openapi.yaml failed OpenAPI 3.1 schema validation:'
  )
  console.error(JSON.stringify(result.errors, null, 2))
  process.exit(1)
}

console.log('src/openapi/openapi.yaml is valid OpenAPI 3.1.')
