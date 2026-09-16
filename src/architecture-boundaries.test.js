// Confirms the AWS S3 SDK is only imported inside the Persistence Module (Step 07 boundary rule).

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

const SRC_ROOT = fileURLToPath(new URL('.', import.meta.url))
const ALLOWED_PREFIX = join('reference-data', 'persistence')
const S3_SDK_IMPORT_PATTERN = /['"]@aws-sdk\/client-s3['"]/

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
})
