import { health } from '#/routes/health.js'
import { readiness } from '#/routes/readiness.js'

export const router = {
  plugin: {
    name: 'router',
    register: (server, _options) => {
      server.route([health, readiness])
    }
  }
}
