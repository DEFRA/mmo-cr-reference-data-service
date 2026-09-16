import { describe, expect, test } from 'vitest'

import {
  CURRENT_SCHEMA_VERSION,
  isSupportedSchemaVersion,
  schemaVersionSchema,
  SCHEMA_VERSIONS,
  SUPPORTED_SCHEMA_VERSIONS
} from './schema-versions.js'

describe('#schemaVersions', () => {
  test('defines exactly version 1.0 as current', () => {
    expect(SCHEMA_VERSIONS.V1).toBe('1.0')
    expect(CURRENT_SCHEMA_VERSION).toBe('1.0')
    expect(SUPPORTED_SCHEMA_VERSIONS).toEqual(['1.0'])
  })

  test('recognises supported versions', () => {
    expect(isSupportedSchemaVersion('1.0')).toBe(true)
  })

  test('rejects unsupported versions', () => {
    expect(isSupportedSchemaVersion('2.0')).toBe(false)
    expect(isSupportedSchemaVersion('not-a-version')).toBe(false)
  })

  test('schemaVersionSchema rejects unsupported versions', () => {
    expect(schemaVersionSchema.validate('1.0').error).toBeUndefined()
    expect(schemaVersionSchema.validate('2.0').error).toBeDefined()
  })
})
