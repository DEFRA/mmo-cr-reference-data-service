import { describe, expect, test } from 'vitest'

import * as datasets from '#/common/domain/datasets.js'
import * as representations from '#/common/domain/representations.js'
import * as collections from '#/common/domain/collections.js'
import * as manifest from '#/common/domain/manifest.js'
import * as validation from '#/common/domain/validation.js'
import * as query from '#/common/domain/query.js'
import * as upload from '#/common/domain/upload.js'
import * as errors from '#/common/domain/errors.js'
import * as referenceDataRepository from '#/common/contracts/reference-data-repository.js'
import * as inMemoryDataStore from '#/common/contracts/in-memory-data-store.js'
import * as authenticationClient from '#/common/contracts/authentication-client.js'
import * as referenceDataProjector from '#/common/contracts/reference-data-projector.js'

describe('#domainAndContractsModules', () => {
  test.each([
    ['datasets', datasets],
    ['representations', representations],
    ['collections', collections],
    ['manifest', manifest],
    ['validation', validation],
    ['query', query],
    ['upload', upload],
    ['errors', errors],
    ['reference-data-repository', referenceDataRepository],
    ['in-memory-data-store', inMemoryDataStore],
    ['authentication-client', authenticationClient],
    ['reference-data-projector', referenceDataProjector]
  ])('%s loads without circular-dependency failures', (_label, module) => {
    expect(module).toBeDefined()
  })
})
