// Shared setup for the Floci integration test suites (persistence, bootstrap,
// cache-refresh, replace-collection) — avoids re-declaring the same Floci
// reachability probe, bucket name, and repository construction in every file.

import { createReferenceDataRepository } from '#/reference-data/persistence/reference-data-repository.js'
import { createInMemoryDataStore } from '#/reference-data/in-memory-store/index.js'
import { validateManifest } from '#/reference-data/cache-refresh/manifest-validation.js'
import {
  bootstrapLocalReferenceData,
  SEED_MANIFEST_ID,
  SEED_TIMESTAMP
} from '#/reference-data/command/bootstrap-local-reference-data.js'
import { SEED_DATASET_ORDER } from '#/reference-data/command/seed-loader.js'

export const FLOCI_HEALTH_URL = 'http://localhost:4566/_floci/health'
export const BUCKET = 'mmo-cr-reference-data-service'
export const FLOCI_ENDPOINT_URL = 'http://localhost:4566'

export const LOCAL_CONFIG = {
  get: (key) =>
    ({
      cdpEnvironment: 'local',
      'aws.endpointUrl': FLOCI_ENDPOINT_URL,
      'referenceData.bucket': BUCKET
    })[key]
}

export const SILENT_LOGGER = { info: () => {}, error: () => {}, warn: () => {} }

/**
 * Probes Floci reachability so every Floci suite can self-skip
 * (`describe.skipIf(!(await isFlociAvailable()))`) without depending on Docker.
 */
export async function isFlociAvailable() {
  try {
    const response = await fetch(FLOCI_HEALTH_URL, {
      signal: AbortSignal.timeout(1000)
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * @param {{ bucket?: string }} [overrides] e.g. a deliberately nonexistent bucket
 *   for a missing-bucket test — never the real configured bucket by default.
 */
export function createFlociRepository({ bucket = BUCKET } = {}) {
  return createReferenceDataRepository({
    region: 'eu-west-2',
    endpointUrl: FLOCI_ENDPOINT_URL,
    forcePathStyle: true,
    bucket
  })
}

/**
 * Guarantees a valid, complete active manifest exists before a Floci suite's own
 * tests run — reuses the existing, already-tested idempotent Step 23 provisioning
 * rather than a second bootstrap mechanism. Only (re-)bootstraps when no valid
 * manifest yet covers every mandatory dataset: an already-complete manifest may
 * have since been replaced (e.g. by the replace-collection Floci suite) with a
 * non-seed active version, and unconditionally re-running bootstrap against that
 * would collide with the original immutable seed object still sitting at the
 * fixed seed version.
 */
export async function ensureSeededManifest(persistence) {
  const hasValidCompleteManifest = async () => {
    try {
      const { manifest } = await persistence.readManifest()
      if (!validateManifest(manifest).valid) {
        return false
      }
      return SEED_DATASET_ORDER.every((dataset) =>
        manifest.datasets.some((entry) => entry.dataset === dataset)
      )
    } catch {
      return false
    }
  }

  if (await hasValidCompleteManifest()) {
    return
  }

  await persistence.writeManifest({
    manifest: {
      manifestId: SEED_MANIFEST_ID,
      version: 'reset-baseline',
      generatedAt: SEED_TIMESTAMP,
      datasets: []
    }
  })
  const summary = await bootstrapLocalReferenceData({
    config: LOCAL_CONFIG,
    persistence,
    store: createInMemoryDataStore(),
    logger: SILENT_LOGGER
  })
  if (summary.status !== 'completed') {
    throw new Error(
      `ensureSeededManifest: bootstrap did not complete (status: ${summary.status})`
    )
  }
}
