// Step 18: derived map-ports GeoJSON projection. Deliberately NOT routed through the
// generic collection query engine (owner decision, 2026-09-16) — `map-ports` is a
// dedicated, pure projection of the active `ports` snapshot, never independently
// persisted, never an authoritative manifest entry.

import { isPointInBoundingBox } from './bounding-box.js'

const GEOJSON_CRS = 'EPSG:4326'

function toFeature(port) {
  return {
    type: 'Feature',
    id: port.id,
    properties: { id: port.id, code: port.code, name: port.name },
    geometry: {
      type: 'Point',
      coordinates: [port.coordinate.longitude, port.coordinate.latitude]
    }
  }
}

/**
 * @param {object} collection active canonical ports collection ({ items: [...] })
 * @param {object} metadata active ports collection metadata
 * @param {{ bbox?: {minLongitude:number,minLatitude:number,maxLongitude:number,maxLatitude:number} }} [options]
 */
export function projectPortsToMapPorts(collection, metadata, { bbox } = {}) {
  const featuresWithCoordinates = collection.items.filter(
    (port) => port.coordinate
  )
  const features = (
    bbox
      ? featuresWithCoordinates.filter((port) =>
          isPointInBoundingBox(
            port.coordinate.longitude,
            port.coordinate.latitude,
            bbox
          )
        )
      : featuresWithCoordinates
  ).map(toFeature)

  return {
    type: 'FeatureCollection',
    metadata: {
      dataset: 'map-ports',
      sourceDataset: 'ports',
      sourceCollectionId: metadata.collectionId,
      version: metadata.version,
      crs: GEOJSON_CRS,
      featureCount: features.length
    },
    features
  }
}
