// Standalone OpenAPI 3.1 validation entry point (`npm run openapi:validate`).
// Mirrors the checks in `src/openapi-contract.test.js` for ad-hoc/CI use outside
// the Vitest suite — parses the YAML and validates it against the official
// OpenAPI 3.1 meta-schema, failing the process (non-zero exit code) on error.
//
// Core logic is split into two exported, independently testable functions so
// both the valid and invalid outcomes can be exercised directly by
// `validate.test.js` without spawning a subprocess: `validateOpenApiSpec`
// (parse + validate) and `runValidateCli` (report the outcome via injectable
// `log`/`error` functions and return the process exit code, rather than
// calling `process.exit` directly — safe to call from a test).

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as yamlModule from 'js-yaml'
import { Validator } from '@seriousme/openapi-schema-validator'

const yaml = yamlModule.default ?? yamlModule
const OPENAPI_PATH = fileURLToPath(
  new URL('../src/openapi/openapi.yaml', import.meta.url)
)
const EXIT_CODE_SUCCESS = 0
const EXIT_CODE_FAILURE = 1

function readOpenApiYamlSource() {
  return readFileSync(OPENAPI_PATH, 'utf-8')
}

/**
 * Parses and validates the given OpenAPI YAML source (defaults to the
 * committed `src/openapi/openapi.yaml`) against the OpenAPI 3.1 meta-schema.
 * @param {string} [yamlSource]
 * @returns {Promise<{valid: boolean, errors?: object[]}>}
 */
export async function validateOpenApiSpec(
  yamlSource = readOpenApiYamlSource()
) {
  const spec = yaml.load(yamlSource)
  const validator = new Validator()
  return validator.validate(spec)
}

/**
 * Reports the validation outcome via the supplied `log`/`error` functions and
 * returns the exit code the CLI should use (0 valid, 1 invalid).
 * @param {{log?: Function, error?: Function, yamlSource?: string}} [options]
 * @returns {Promise<number>}
 */
export async function runValidateCli({
  log = console.log,
  error = console.error,
  yamlSource
} = {}) {
  const result = await validateOpenApiSpec(yamlSource)

  if (!result.valid) {
    error('src/openapi/openapi.yaml failed OpenAPI 3.1 schema validation:')
    error(JSON.stringify(result.errors, null, 2))
    return EXIT_CODE_FAILURE
  }

  log('src/openapi/openapi.yaml is valid OpenAPI 3.1.')
  return EXIT_CODE_SUCCESS
}

process.exitCode = await runValidateCli()
