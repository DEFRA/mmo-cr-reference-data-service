import { health } from '#/routes/health.js'
import { readiness } from '#/routes/readiness.js'
import { manifest } from '#/routes/manifest.js'
import { vesselsCollection, vesselsItem } from '#/routes/vessels.js'
import { gearsCollection, gearsItem } from '#/routes/gears.js'
import { portsCollection, portsItem } from '#/routes/ports.js'
import { mapPorts } from '#/routes/map-ports.js'
import { speciesCollection, speciesItem } from '#/routes/species.js'
import { mapLand } from '#/routes/map-land.js'
import {
  mapStatisticalAreasCollection,
  mapStatisticalAreasItem
} from '#/routes/map-statistical-areas.js'
import { uploadValidation } from '#/routes/upload-validation.js'

export const router = {
  plugin: {
    name: 'router',
    register: (server, _options) => {
      server.route([
        health,
        readiness,
        manifest,
        vesselsCollection,
        vesselsItem,
        gearsCollection,
        gearsItem,
        portsCollection,
        portsItem,
        mapPorts,
        speciesCollection,
        speciesItem,
        mapLand,
        mapStatisticalAreasCollection,
        mapStatisticalAreasItem,
        uploadValidation
      ])
    }
  }
}
