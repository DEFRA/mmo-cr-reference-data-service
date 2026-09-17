// Projects the internal active manifest (Step 11 In-Memory Data Store shape) into
// the public Manifest API response. Pure, stateless, and mutation-free.

import { createHash } from 'node:crypto'

import {
  DATASETS,
  DATASET_FORMAT,
  isPersistedDataset
} from '#/common/domain/datasets.js'
import { getDatasetRoutePath } from '#/common/domain/route-paths.js'

const GEOJSON_CRS = 'EPSG:4326'

// Deterministic public dataset ordering, independent of manifest storage/write order.
const DATASET_ORDER = Object.values(DATASETS).filter(isPersistedDataset)

function orderEntries(entries) {
  const entriesByDataset = new Map(
    entries.map((entry) => [entry.dataset, entry])
  )
  return DATASET_ORDER.filter((dataset) => entriesByDataset.has(dataset)).map(
    (dataset) => entriesByDataset.get(dataset)
  )
}

function projectDatasetEntry(entry) {
  const isGeoJson = entry.format === DATASET_FORMAT.GEOJSON

  return {
    dataset: entry.dataset,
    collectionId: entry.collectionId,
    schemaVersion: entry.schemaVersion,
    version: entry.version,
    etag: entry.etag,
    url: getDatasetRoutePath(entry.dataset),
    format: entry.format,
    ...(isGeoJson
      ? { featureCount: entry.itemCount, crs: GEOJSON_CRS }
      : { itemCount: entry.itemCount }),
    ...(typeof entry.sizeBytes === 'number'
      ? { sizeBytes: entry.sizeBytes }
      : {}),
    lastModified: entry.lastModified
  }
}

// Filtered-manifest ETag policy (documented decision, see saved Step 14 plan): every
// filtered view shares the same full-manifest ETag, derived only from stable
// revision identifiers (manifestId + version) — never generatedAt, request time,
// correlation id, or object identity.
function calculateManifestEtag(manifest) {
  const digest = createHash('sha256')
    .update(`${manifest.manifestId}:${manifest.version}`)
    .digest('base64')
  return `"sha256-${digest}"`
}

/**
 * @param {import('#/common/domain/manifest.js').Manifest} manifest active manifest snapshot
 * @param {{ include?: string[]|null }} [options]
 * @returns {{ etag: string, body: object }}
 */
export function projectManifest(manifest, { include = null } = {}) {
  const orderedEntries = orderEntries(manifest.datasets)
  const filteredEntries = include
    ? orderedEntries.filter((entry) => include.includes(entry.dataset))
    : orderedEntries

  return {
    etag: calculateManifestEtag(manifest),
    body: {
      manifestId: manifest.manifestId,
      version: manifest.version,
      generatedAt: manifest.generatedAt,
      datasets: filteredEntries.map(projectDatasetEntry)
    }
  }
}
