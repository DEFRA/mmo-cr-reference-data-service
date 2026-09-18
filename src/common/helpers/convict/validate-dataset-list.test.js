import { describe, expect, test } from 'vitest'

import { convictValidateDatasetList } from './validate-dataset-list.js'

describe('#convictValidateDatasetList coerce', () => {
  test('splits a comma-separated env string into a trimmed dataset list', () => {
    expect(convictValidateDatasetList.coerce('vessels, gears ,ports')).toEqual([
      'vessels',
      'gears',
      'ports'
    ])
  })

  test('drops empty entries produced by trailing commas', () => {
    expect(convictValidateDatasetList.coerce('vessels,,gears')).toEqual([
      'vessels',
      'gears'
    ])
  })

  test('passes through a non-string value unchanged', () => {
    expect(convictValidateDatasetList.coerce(['vessels', 'gears'])).toEqual([
      'vessels',
      'gears'
    ])
  })
})

describe('#convictValidateDatasetList validate', () => {
  test('accepts a list of supported, persisted datasets', () => {
    expect(() =>
      convictValidateDatasetList.validate(['vessels', 'gears'])
    ).not.toThrow()
  })

  test('rejects an empty list', () => {
    expect(() => convictValidateDatasetList.validate([])).toThrow()
  })

  test('rejects an unsupported dataset identifier', () => {
    expect(() =>
      convictValidateDatasetList.validate(['not-a-real-dataset'])
    ).toThrow(/Unsupported or non-persisted dataset/)
  })

  test('rejects a derived (non-persisted) dataset such as map-ports', () => {
    expect(() => convictValidateDatasetList.validate(['map-ports'])).toThrow(
      /Unsupported or non-persisted dataset/
    )
  })
})
