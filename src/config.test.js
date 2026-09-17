import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const originalEnv = { ...process.env }

async function loadConfig() {
  vi.resetModules()
  return (await import('./config.js')).config
}

describe('#config', () => {
  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  test('loads valid local configuration with safe defaults', async () => {
    const config = await loadConfig()

    expect(config.get('port')).toBe(3001)
    expect(config.get('aws.region')).toBe('eu-west-2')
    expect(config.get('aws.endpointUrl')).toBeNull()
    expect(config.get('aws.forcePathStyle')).toBe(false)
    expect(config.get('referenceData.bucket')).toBe(
      'mmo-cr-reference-data-service'
    )
    expect(config.get('referenceData.refreshIntervalMs')).toBe(60000)
    expect(config.get('referenceData.maxUploadBytes')).toBe(26214400)
    expect(config.get('referenceData.refreshEnabled')).toBe(true)
    expect(config.get('referenceData.refreshInitialDelayMs')).toBe(0)
    expect(config.get('referenceData.hydrationTimeoutMs')).toBe(10000)
    expect(config.get('referenceData.refreshConcurrency')).toBe(3)
    expect(config.get('referenceData.mandatoryDatasets')).toEqual([
      'vessels',
      'gears',
      'ports',
      'species',
      'map-land',
      'map-statistical-areas'
    ])
    expect(config.get('referenceData.autoStartCacheRefresh')).toBe(false)
    expect(config.get('health.dependencyProbeTimeoutMs')).toBe(2000)
    expect(config.get('authentication.serviceUrl')).toBeNull()
    expect(config.get('authentication.timeoutMs')).toBe(2000)
    expect(config.get('authentication.retryCount')).toBe(1)
    expect(config.get('authentication.retryDelayMs')).toBe(100)
  })

  test('loads valid deployed-style configuration without a custom AWS endpoint', async () => {
    process.env.AWS_REGION = 'eu-west-1'
    process.env.REFERENCE_DATA_BUCKET = 'mmo-cr-reference-data-prod'
    process.env.AUTHENTICATION_SERVICE_URL = 'https://auth.internal.example'

    const config = await loadConfig()

    expect(config.get('aws.region')).toBe('eu-west-1')
    expect(config.get('aws.endpointUrl')).toBeNull()
    expect(config.get('referenceData.bucket')).toBe(
      'mmo-cr-reference-data-prod'
    )
    expect(config.get('authentication.serviceUrl')).toBe(
      'https://auth.internal.example'
    )
  })

  test('rejects an invalid port', async () => {
    process.env.PORT = '999999'

    await expect(loadConfig()).rejects.toThrow()
  })

  test('rejects an invalid AWS endpoint URL', async () => {
    process.env.AWS_ENDPOINT_URL = 'not-a-url'

    await expect(loadConfig()).rejects.toThrow()
  })

  test('rejects an invalid boolean for S3_FORCE_PATH_STYLE', async () => {
    process.env.S3_FORCE_PATH_STYLE = 'not-a-boolean'

    await expect(loadConfig()).rejects.toThrow()
  })

  describe('aws.forcePathStyle strict boolean parsing', () => {
    test('defaults to false when S3_FORCE_PATH_STYLE is not set', async () => {
      const config = await loadConfig()

      expect(config.get('aws.forcePathStyle')).toBe(false)
    })

    test('parses "true" as true', async () => {
      process.env.S3_FORCE_PATH_STYLE = 'true'

      const config = await loadConfig()

      expect(config.get('aws.forcePathStyle')).toBe(true)
    })

    test('parses "false" as false', async () => {
      process.env.S3_FORCE_PATH_STYLE = 'false'

      const config = await loadConfig()

      expect(config.get('aws.forcePathStyle')).toBe(false)
    })

    test.each(['not-a-boolean', 'yes', 'no', '1', '0', ''])(
      'rejects invalid value %j',
      async (value) => {
        process.env.S3_FORCE_PATH_STYLE = value

        await expect(loadConfig()).rejects.toThrow()
      }
    )
  })

  test('rejects an invalid refresh interval', async () => {
    process.env.REFERENCE_DATA_REFRESH_INTERVAL_MS = '0'

    await expect(loadConfig()).rejects.toThrow()
  })

  test('rejects an invalid upload limit', async () => {
    process.env.REFERENCE_DATA_MAX_UPLOAD_BYTES = '-1'

    await expect(loadConfig()).rejects.toThrow()
  })

  test('rejects an invalid hydration timeout', async () => {
    process.env.REFERENCE_DATA_HYDRATION_TIMEOUT_MS = '0'

    await expect(loadConfig()).rejects.toThrow()
  })

  test('rejects an invalid refresh concurrency', async () => {
    process.env.REFERENCE_DATA_REFRESH_CONCURRENCY = '0'

    await expect(loadConfig()).rejects.toThrow()
  })

  test('rejects an invalid health dependency probe timeout', async () => {
    process.env.HEALTH_DEPENDENCY_PROBE_TIMEOUT_MS = '0'

    await expect(loadConfig()).rejects.toThrow()
  })

  test('rejects a negative refresh initial delay', async () => {
    process.env.REFERENCE_DATA_REFRESH_INITIAL_DELAY_MS = '-1'

    await expect(loadConfig()).rejects.toThrow()
  })

  test('accepts a zero refresh initial delay', async () => {
    process.env.REFERENCE_DATA_REFRESH_INITIAL_DELAY_MS = '0'

    const config = await loadConfig()

    expect(config.get('referenceData.refreshInitialDelayMs')).toBe(0)
  })

  test('parses a comma-separated mandatory dataset list', async () => {
    process.env.REFERENCE_DATA_MANDATORY_DATASETS = 'vessels,ports'

    const config = await loadConfig()

    expect(config.get('referenceData.mandatoryDatasets')).toEqual([
      'vessels',
      'ports'
    ])
  })

  test('rejects an unsupported mandatory dataset', async () => {
    process.env.REFERENCE_DATA_MANDATORY_DATASETS = 'vessels,not-a-dataset'

    await expect(loadConfig()).rejects.toThrow()
  })

  test('rejects the derived map-ports dataset as mandatory', async () => {
    process.env.REFERENCE_DATA_MANDATORY_DATASETS = 'map-ports'

    await expect(loadConfig()).rejects.toThrow()
  })

  test('rejects an empty mandatory dataset list', async () => {
    process.env.REFERENCE_DATA_MANDATORY_DATASETS = ''

    await expect(loadConfig()).rejects.toThrow()
  })

  test('rejects an empty bucket name', async () => {
    process.env.REFERENCE_DATA_BUCKET = '   '

    await expect(loadConfig()).rejects.toThrow()
  })

  test('does not include secret values in validation errors', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'super-secret-access-key'
    process.env.AWS_SECRET_ACCESS_KEY = 'super-secret-secret-key'
    process.env.PORT = '999999'

    await expect(loadConfig()).rejects.toThrow()

    try {
      await loadConfig()
    } catch (error) {
      expect(String(error.message)).not.toContain('super-secret')
    }
  })
})
