import { describe, expect, test } from 'vitest'

import Joi from 'joi'

import { createCollectionEnvelopeSchema } from './collection-envelope.js'

describe('#createCollectionEnvelopeSchema', () => {
  const schema = createCollectionEnvelopeSchema('ports', {
    items: Joi.array()
      .items(Joi.object({ id: Joi.string().guid() }))
      .required()
  })

  const validEnvelope = {
    dataset: 'ports',
    collectionId: '0be553de-f430-49f7-b120-1e8e5ad972dc',
    schemaVersion: '1.0',
    version: '2026.09.11.1',
    generatedAt: '2026-09-11T08:30:00Z',
    effectiveFrom: '2026-09-11T00:00:00Z',
    itemCount: 1,
    items: [{ id: '73168db4-1996-46f8-91cb-2288fe2e689c' }]
  }

  test('accepts a valid envelope', () => {
    expect(schema.validate(validEnvelope).error).toBeUndefined()
  })

  test('rejects a mismatched dataset value', () => {
    const { error } = schema.validate({ ...validEnvelope, dataset: 'vessels' })

    expect(error).toBeDefined()
  })

  test('rejects a missing required collection field', () => {
    const { dataset, ...withoutDataset } = validEnvelope

    const { error } = schema.validate(withoutDataset)

    expect(error).toBeDefined()
  })

  test('rejects a negative itemCount', () => {
    const { error } = schema.validate({ ...validEnvelope, itemCount: -1 })

    expect(error).toBeDefined()
  })
})
