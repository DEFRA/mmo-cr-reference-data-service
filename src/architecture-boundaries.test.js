// Confirms the AWS S3 SDK is only imported inside the Persistence Module (Step 07 boundary rule).

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

const SRC_ROOT = fileURLToPath(new URL('.', import.meta.url))
const ALLOWED_PREFIX = join('reference-data', 'persistence')
const S3_SDK_IMPORT_PATTERN = /['"]@aws-sdk\/client-s3['"]/

const AUTH_CLIENT_ALLOWED_PREFIX = join('reference-data', 'validation')
const HTTP_AUTH_CLIENT_IMPORT_PATTERN =
  /['"].*\/authentication\/http-authentication-client\.js['"]/

function collectJsFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = join(directory, entry)
    const stats = statSync(fullPath)
    if (stats.isDirectory()) {
      return collectJsFiles(fullPath)
    }
    return entry.endsWith('.js') ? [fullPath] : []
  })
}

describe('#architectureBoundaries', () => {
  test('only the Persistence Module imports the AWS S3 SDK', () => {
    const offendingFiles = collectJsFiles(SRC_ROOT)
      .filter(
        (filePath) => !relative(SRC_ROOT, filePath).startsWith(ALLOWED_PREFIX)
      )
      .filter((filePath) =>
        S3_SDK_IMPORT_PATTERN.test(readFileSync(filePath, 'utf-8'))
      )

    expect(offendingFiles).toEqual([])
  })

  test('only the Validation Module imports the concrete Authentication Service client', () => {
    const offendingFiles = collectJsFiles(SRC_ROOT)
      .filter(
        (filePath) =>
          !relative(SRC_ROOT, filePath).startsWith(AUTH_CLIENT_ALLOWED_PREFIX)
      )
      .filter((filePath) =>
        HTTP_AUTH_CLIENT_IMPORT_PATTERN.test(readFileSync(filePath, 'utf-8'))
      )

    expect(offendingFiles).toEqual([])
  })
})
