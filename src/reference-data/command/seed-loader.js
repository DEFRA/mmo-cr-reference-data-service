// Loads the committed, deterministic local seed resources for bootstrapLocalReferenceData
// (Step 23). Uses a fixed, allowlisted dataset-to-file mapping only — never a dynamic or
// caller-supplied path — so no path traversal or arbitrary file access is possible.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { DATASETS } from '#/common/domain/datasets.js'

export const SEED_DIRECTORY_URL = new URL(
  '../../../resources/reference-data/seed/',
  import.meta.url
)

// Fixed, explicit allowlist — every uploadable dataset maps to exactly one committed file.
const SEED_FILES = Object.freeze({
  [DATASETS.VESSELS]: 'vessels.json',
  [DATASETS.GEARS]: 'gears.json',
  [DATASETS.PORTS]: 'ports.json',
  [DATASETS.SPECIES]: 'species.json',
  [DATASETS.MAP_LAND]: 'map-land.geojson',
  [DATASETS.MAP_STATISTICAL_AREAS]: 'map-statistical-areas.geojson'
})

// Canonical seed processing order (also the manifest's own deterministic dataset order).
export const SEED_DATASET_ORDER = Object.freeze(Object.keys(SEED_FILES))

export function getSeedFilePath(dataset) {
  const fileName = SEED_FILES[dataset]
  if (!fileName) {
    throw new Error(`No seed file is registered for dataset "${dataset}".`)
  }
  return fileURLToPath(new URL(fileName, SEED_DIRECTORY_URL))
}

/**
 * Reads and parses one committed seed resource. Throws a plain `Error` (caught and
 * classified by the bootstrap orchestrator) on a missing file or malformed JSON —
 * never silently returns partial content.
 */
export function loadSeedCollection(dataset) {
  const filePath = getSeedFilePath(dataset)
  const raw = readFileSync(filePath, 'utf8')
  return JSON.parse(raw)
}
