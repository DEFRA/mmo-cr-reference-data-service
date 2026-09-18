---
description: 'Security standards for the MMO Catch Recording Reference Data Service: DEFRA Secure by Design, OWASP Top 10 and API Security Top 10, HTTPS/TLS, boundary validation, Authentication Service token verification, S3 data safety, Boom error envelope, secrets management and PII-safe logging. Use when handling requests, data, config, or reviewing security.'
applyTo: 'src/**/*.js'
---

# Security standards

Precedence: DEFRA security > GDS > OWASP/community. DEFRA services must follow
**[Secure by Design](https://www.security.gov.uk/guidance/secure-by-design/principles/)** principles and
DEFRA [security standards](https://defra.github.io/software-development-standards/standards/security_standards/).
Design the service's security profile **before** finalising scope. Treat every inbound request and every
response from an external service as untrusted.

## Encryption in transit (mandatory)

- **All traffic must be encrypted** (HTTPS/TLS). Never serve or call plain HTTP.
- **Never disable TLS verification** and never bypass `@defra/hapi-secure-context`, which loads the CA
  certificates from environment config.
- Keep the secure response headers configured in `createServer()` — **HSTS**, `xss`, `noSniff` and frame
  protection — enabled.

## Boundary validation & upload security

- **Validate every input at the boundary** with Hapi route `validate` (Joi): `params`, `query`, `payload`
  and `headers`. Keep `abortEarly: false` so all errors surface.
- Use **strict, allow-list** schemas for all canonical dataset uploads (vessels, gears, ports, species, map
  locations). Reject unknown properties; validate structural types, constraints and referential integrity
  before persisting.
- Protect upload endpoints with strict size and rate limits; do not accept unvalidated multipart or raw
  buffers without parsing.

## Authentication & authorisation

- **Enforce authorisation on every protected route.** Read routes (`/reference-data/*`, `/manifest`) and
  management routes verify caller identity and entitlements through the Authentication Service.
- `/health` is the only route that stays unauthenticated and dependency-safe.
- Concrete authentication client must stay isolated inside `src/reference-data/validation/authentication/`
  per architecture boundaries.

## S3 persistence & data safety

- AWS S3 SDK access is restricted exclusively to `src/reference-data/persistence/`.
- S3 bucket names and prefix paths must come from `convict` config, never hard-coded or concatenated from
  untrusted user input.
- Manifest files and dataset snapshots must use atomic writes/replacements to avoid partial corruption.

## Error responses & error envelope

- Use `@hapi/boom` for expected failures (`Boom.badRequest()`, `Boom.notFound()`, `Boom.unauthorized()`,
  `Boom.conflict()`).
- The `errorResponse` plugin maps every error to the standard API error envelope. **Never expose** stack
  traces, driver errors, connection strings, bucket names or internal file paths to the caller.

## Secrets & logging

- **Never commit** API keys, tokens, passwords or certificates. Provide them via environment variables
  injected from the CDP Portal and read through `convict`.
- **Never log PII or secrets** (names, emails, vessel identifiers, coordinates, tokens). Use structured
  pino/ECS logging with configurable levels. Send protective-monitoring events to the SOC via
  `@defra/cdp-auditing`.
- Enable **GitHub Advanced Security** and DEFRA SonarCloud. Run `npm run security-audit`.
