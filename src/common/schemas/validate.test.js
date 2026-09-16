import { describe, expect, test } from 'vitest'

import Joi from 'joi'

import { mapValidationErrorDetails, validateAgainstSchema } from './validate.js'

describe('#validateAgainstSchema', () => {
  const schema = Joi.object({
    id: Joi.string().guid().required(),
    count: Joi.number().integer().required()
  })

  test('does not mutate the supplied input', () => {
    const input = Object.freeze({
      id: '73168db4-1996-46f8-91cb-2288fe2e689c',
      count: 1
    })

    expect(() => validateAgainstSchema(schema, input)).not.toThrow()
    expect(input).toEqual({
      id: '73168db4-1996-46f8-91cb-2288fe2e689c',
      count: 1
    })
  })

  test('does not coerce numeric strings', () => {
    const { error } = validateAgainstSchema(schema, {
      id: '73168db4-1996-46f8-91cb-2288fe2e689c',
      count: '1'
    })

    expect(error).toBeDefined()
  })

  test('rejects unknown properties', () => {
    const { error } = validateAgainstSchema(schema, {
      id: '73168db4-1996-46f8-91cb-2288fe2e689c',
      count: 1,
      extra: 'not allowed'
    })

    expect(error).toBeDefined()
  })

  test('collects all errors rather than aborting early', () => {
    const { error } = validateAgainstSchema(schema, {})

    expect(error.details.length).toBeGreaterThan(1)
  })
})

describe('#mapValidationErrorDetails', () => {
  const schema = Joi.object({ id: Joi.string().guid().required() })

  test('returns an empty array when there is no error', () => {
    expect(mapValidationErrorDetails(undefined)).toEqual([])
  })

  test('maps details to safe path/message/type entries only', () => {
    const { error } = validateAgainstSchema(schema, { id: 'not-a-guid' })

    const issues = mapValidationErrorDetails(error)

    expect(issues).toEqual([
      {
        path: 'id',
        message: expect.any(String),
        type: expect.any(String)
      }
    ])
    expect(issues[0]).not.toHaveProperty('context')
    expect(issues[0].message).not.toContain('not-a-guid')
  })
})
