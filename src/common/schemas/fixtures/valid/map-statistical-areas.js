// Synthetic, schema-valid example map-statistical-areas collection (structural fixture, not seed data).
export const validMapStatisticalAreasCollection = {
  dataset: 'map-statistical-areas',
  collectionId: 'd4e5f6a7-4444-4444-8444-444444444444',
  schemaVersion: '1.0',
  version: '2026.09.11.1',
  generatedAt: '2026-09-11T08:30:00Z',
  itemCount: 1,
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: '12639177-7614-4616-83cd-6141ecb83924',
      properties: {
        id: '12639177-7614-4616-83cd-6141ecb83924',
        code: '27D86',
        name: 'ICES subrectangle 27D86',
        areaType: 'ices-subrectangle',
        parentCode: '27D8',
        parentName: 'ICES rectangle 27D8',
        areaKm2: 312.48,
        centroid: { latitude: 50.25, longitude: -4.5 }
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-4.6, 50.2],
            [-4.6, 50.3],
            [-4.4, 50.3],
            [-4.6, 50.2]
          ]
        ]
      }
    }
  ]
}
