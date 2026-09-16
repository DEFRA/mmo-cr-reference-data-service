import { describe, expect, test } from 'vitest'

import Joi from 'joi'

import { collectionMetadataKeys } from './collection-metadata.js'

describe('#collectionMetadataKeys', () => {
  const schema = Joi.object(collectionMetadataKeys)

  const validMetadata = {
    collectionId: '0be553de-f430-49f7-b120-1e8e5ad972dc',
    schemaVersion: '1.0',
    version: '2026.09.11.1',
    generatedAt: '2026-09-11T08:30:00Z',
    effectiveFrom: '2026-09-11T00:00:00Z',
    itemCount: 1
  }

  test('accepts valid metadata including optional effectiveFrom', () => {
    expect(schema.validate(validMetadata).error).toBeUndefined()
  })

  test('accepts metadata with effectiveFrom omitted', () => {
    const { effectiveFrom, ...withoutEffectiveFrom } = validMetadata

    expect(schema.validate(withoutEffectiveFrom).error).toBeUndefined()
  })

  test('rejects an unsupported schema version', () => {
    const { error } = schema.validate({
      ...validMetadata,
      schemaVersion: '2.0'
    })

    expect(error).toBeDefined()
  })

  test('rejects a negative itemCount', () => {
    const { error } = schema.validate({ ...validMetadata, itemCount: -1 })

    expect(error).toBeDefined()
  })

  test('rejects an invalid collectionId', () => {
    const { error } = schema.validate({
      ...validMetadata,
      collectionId: 'not-a-guid'
    })

    expect(error).toBeDefined()
  })

  test('rejects an invalid generatedAt timestamp', () => {
    const { error } = schema.validate({
      ...validMetadata,
      generatedAt: 'not-a-timestamp'
    })

    expect(error).toBeDefined()
  })
})
