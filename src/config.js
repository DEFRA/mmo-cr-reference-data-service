import convict from 'convict'
import convictFormatWithValidator from 'convict-format-with-validator'

import { convictValidateOptionalUrl } from '#/common/helpers/convict/validate-optional-url.js'
import { convictValidateNonEmptyString } from '#/common/helpers/convict/validate-non-empty-string.js'
import { convictValidatePositiveInteger } from '#/common/helpers/convict/validate-positive-integer.js'
import { convictValidateNonNegativeInteger } from '#/common/helpers/convict/validate-non-negative-integer.js'
import { convictValidateStrictBoolean } from '#/common/helpers/convict/validate-strict-boolean.js'
import { convictValidateDatasetList } from '#/common/helpers/convict/validate-dataset-list.js'

convict.addFormats(convictFormatWithValidator)
convict.addFormat(convictValidateOptionalUrl)
convict.addFormat(convictValidateNonEmptyString)
convict.addFormat(convictValidatePositiveInteger)
convict.addFormat(convictValidateNonNegativeInteger)
convict.addFormat(convictValidateStrictBoolean)
convict.addFormat(convictValidateDatasetList)

const isProduction = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test'

export const config = convict({
  serviceVersion: {
    doc: 'The service version, this variable is injected into your docker container in CDP environments',
    format: String,
    nullable: true,
    default: null,
    env: 'SERVICE_VERSION'
  },
  host: {
    doc: 'The IP address to bind',
    format: 'ipaddress',
    default: '0.0.0.0',
    env: 'HOST'
  },
  port: {
    doc: 'The port to bind',
    format: 'port',
    default: 3001,
    env: 'PORT'
  },
  serviceName: {
    doc: 'Api Service Name',
    format: String,
    default: 'mmo-cr-reference-data-service'
  },
  cdpEnvironment: {
    doc: 'The CDP environment the app is running in. With the addition of "local" for local development',
    format: [
      'local',
      'infra-dev',
      'management',
      'dev',
      'test',
      'perf-test',
      'ext-test',
      'prod'
    ],
    default: 'local',
    env: 'ENVIRONMENT'
  },
  log: {
    isEnabled: {
      doc: 'Is logging enabled',
      format: Boolean,
      default: !isTest,
      env: 'LOG_ENABLED'
    },
    level: {
      doc: 'Logging level',
      format: ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'],
      default: 'info',
      env: 'LOG_LEVEL'
    },
    format: {
      doc: 'Format to output logs in',
      format: ['ecs', 'pino-pretty'],
      default: isProduction ? 'ecs' : 'pino-pretty',
      env: 'LOG_FORMAT'
    },
    redact: {
      doc: 'Log paths to redact',
      format: Array,
      default: isProduction
        ? ['req.headers.authorization', 'req.headers.cookie', 'res.headers']
        : ['req', 'res', 'responseTime']
    }
  },
  httpProxy: {
    doc: 'HTTP Proxy URL',
    format: String,
    nullable: true,
    default: null,
    env: 'HTTP_PROXY'
  },
  tracing: {
    header: {
      doc: 'CDP tracing header name',
      format: String,
      default: 'x-cdp-request-id',
      env: 'TRACING_HEADER'
    }
  },
  aws: {
    region: {
      doc: 'AWS region used for S3-compatible reference-data storage',
      format: 'non-empty-string',
      default: 'eu-west-2',
      env: 'AWS_REGION'
    },
    endpointUrl: {
      doc: 'Optional S3-compatible endpoint override, e.g. Floci for local development. Leave unset in deployed AWS environments to use the default AWS endpoint.',
      format: 'optional-url',
      nullable: true,
      default: null,
      env: 'AWS_ENDPOINT_URL'
    },
    forcePathStyle: {
      doc: 'Use path-style S3 addressing, required by Floci and most S3-compatible local emulators. Accepts only "true" or "false".',
      format: 'strict-boolean',
      default: false,
      env: 'S3_FORCE_PATH_STYLE'
    }
  },
  referenceData: {
    bucket: {
      doc: 'S3-compatible bucket name storing reference-data collections. Deployed environments must set an explicit, environment-specific value.',
      format: 'non-empty-string',
      default: 'mmo-cr-reference-data-service',
      env: 'REFERENCE_DATA_BUCKET'
    },
    refreshIntervalMs: {
      doc: 'Interval in milliseconds between reference-data cache-refresh checks',
      format: convictValidatePositiveInteger.name,
      default: 60000,
      env: 'REFERENCE_DATA_REFRESH_INTERVAL_MS'
    },
    maxUploadBytes: {
      doc: 'Maximum accepted size in bytes for a reference-data collection upload',
      format: convictValidatePositiveInteger.name,
      default: 26214400,
      env: 'REFERENCE_DATA_MAX_UPLOAD_BYTES'
    },
    refreshEnabled: {
      doc: 'Whether periodic background cache-refresh scheduling is enabled',
      format: 'strict-boolean',
      default: true,
      env: 'REFERENCE_DATA_REFRESH_ENABLED'
    },
    refreshInitialDelayMs: {
      doc: 'Delay in milliseconds before the first scheduled cache refresh after startup hydration completes',
      format: convictValidateNonNegativeInteger.name,
      default: 0,
      env: 'REFERENCE_DATA_REFRESH_INITIAL_DELAY_MS'
    },
    hydrationTimeoutMs: {
      doc: 'Maximum time in milliseconds allowed for startup cache hydration before it is treated as failed',
      format: convictValidatePositiveInteger.name,
      default: 10000,
      env: 'REFERENCE_DATA_HYDRATION_TIMEOUT_MS'
    },
    refreshConcurrency: {
      doc: 'Maximum number of datasets processed concurrently during a cache refresh',
      format: convictValidatePositiveInteger.name,
      default: 3,
      env: 'REFERENCE_DATA_REFRESH_CONCURRENCY'
    },
    mandatoryDatasets: {
      doc: 'Datasets that must be successfully hydrated before the service reports readiness',
      format: 'dataset-list',
      default: [
        'vessels',
        'gears',
        'ports',
        'species',
        'map-land',
        'map-statistical-areas'
      ],
      env: 'REFERENCE_DATA_MANDATORY_DATASETS'
    },
    autoStartCacheRefresh: {
      doc: 'Whether to automatically hydrate and start the cache-refresh scheduler when the server starts. Disabled by default in the test environment so normal test runs never require Floci/S3.',
      format: Boolean,
      default: !isTest,
      env: 'REFERENCE_DATA_AUTO_START_CACHE_REFRESH'
    }
  },
  health: {
    dependencyProbeTimeoutMs: {
      doc: 'Timeout in milliseconds for bounded health-check dependency probes (e.g. persistence reachability)',
      format: convictValidatePositiveInteger.name,
      default: 2000,
      env: 'HEALTH_DEPENDENCY_PROBE_TIMEOUT_MS'
    }
  },
  observability: {
    metricsEnabled: {
      doc: 'Whether application metrics are emitted via @defra/cdp-metrics',
      format: Boolean,
      default: !isTest,
      env: 'METRICS_ENABLED'
    },
    auditEnabled: {
      doc: 'Whether administrative audit events are emitted via @defra/cdp-auditing',
      format: Boolean,
      default: !isTest,
      env: 'AUDIT_ENABLED'
    }
  },
  authentication: {
    serviceUrl: {
      doc: 'Base URL of the Authentication Service. Only consumed by the Validation Module.',
      format: 'optional-url',
      nullable: true,
      default: null,
      env: 'AUTHENTICATION_SERVICE_URL'
    },
    timeoutMs: {
      doc: 'Timeout in milliseconds for Authentication Service token-validation requests',
      format: convictValidatePositiveInteger.name,
      default: 2000,
      env: 'AUTHENTICATION_SERVICE_TIMEOUT_MS'
    },
    retryCount: {
      doc: 'Number of bounded retries for approved transient Authentication Service failures',
      format: convictValidateNonNegativeInteger.name,
      default: 1,
      env: 'AUTHENTICATION_SERVICE_RETRY_COUNT'
    },
    retryDelayMs: {
      doc: 'Delay in milliseconds between bounded Authentication Service retries',
      format: convictValidateNonNegativeInteger.name,
      default: 100,
      env: 'AUTHENTICATION_SERVICE_RETRY_DELAY_MS'
    }
  }
})

config.validate({ allowed: 'strict' })
