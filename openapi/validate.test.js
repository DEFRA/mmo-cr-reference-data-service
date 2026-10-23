import { describe, expect, test, vi } from 'vitest'

import { validateOpenApiSpec, runValidateCli } from './validate.js'

// A deliberately minimal/invalid OpenAPI document (missing required `info` and
// `paths`) used only to exercise the failure branch — never written to disk.
const INVALID_SPEC_YAML = 'openapi: 3.1.0\n'

describe('#validateOpenApiSpec', () => {
  test('reports the committed src/openapi/openapi.yaml as valid', async () => {
    const result = await validateOpenApiSpec()

    expect(result.valid).toBe(true)
  })

  test('reports an invalid OpenAPI document as invalid with error detail', async () => {
    const result = await validateOpenApiSpec(INVALID_SPEC_YAML)

    expect(result.valid).toBe(false)
    expect(Array.isArray(result.errors)).toBe(true)
    expect(result.errors.length).toBeGreaterThan(0)
  })
})

describe('#runValidateCli', () => {
  test('logs success and returns 0 for a valid spec', async () => {
    const log = vi.fn()
    const error = vi.fn()

    const exitCode = await runValidateCli({ log, error })

    expect(exitCode).toBe(0)
    expect(log).toHaveBeenCalledWith(
      'src/openapi/openapi.yaml is valid OpenAPI 3.1.'
    )
    expect(error).not.toHaveBeenCalled()
  })

  test('reports errors and returns 1 for an invalid spec', async () => {
    const log = vi.fn()
    const error = vi.fn()

    const exitCode = await runValidateCli({
      log,
      error,
      yamlSource: INVALID_SPEC_YAML
    })

    expect(exitCode).toBe(1)
    expect(log).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledWith(
      'src/openapi/openapi.yaml failed OpenAPI 3.1 schema validation:'
    )
    expect(error).toHaveBeenCalledTimes(2)
  })

  test('defaults log/error to console when not supplied', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const exitCode = await runValidateCli()

    expect(exitCode).toBe(0)
    expect(logSpy).toHaveBeenCalledWith(
      'src/openapi/openapi.yaml is valid OpenAPI 3.1.'
    )

    logSpy.mockRestore()
  })
})

describe('#cliEntryPoint', () => {
  test('the module-level invocation already set process.exitCode to 0 for the real (valid) spec', () => {
    // The static `import` at the top of this file already triggered the
    // module's top-level `process.exitCode = await runValidateCli()` line
    // against the real, valid committed spec (ES modules execute top-level
    // code exactly once per resolved specifier, on first import) — assert
    // that real, non-superficial behaviour directly rather than re-importing
    // (which would just return the cached module without re-running it).
    expect(process.exitCode).toBe(0)
  })
})
