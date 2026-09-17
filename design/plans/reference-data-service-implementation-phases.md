# Reference Data Service Implementation Phases

## 1. Purpose

This document groups the approved Reference Data Service implementation steps into delivery phases to support progress tracking.

It does not replace or modify the approved implementation plan.

The following remain authoritative in the approved plan for every step:

- Step number
- Step title
- Objective
- Scope
- Deliverables
- Completion criteria
- Dependencies
- Testing requirements
- Implementation sequence

## 2. Plan governance

The approved implementation plan is locked at its current revision.

The plan must not be changed, reordered, expanded, reduced, combined, or split without explicit owner consent.

If a deviation appears necessary:

1. Identify the exact affected step.
2. Explain the technical or delivery problem.
3. Provide evidence that the problem cannot reasonably be resolved within the approved step.
4. Propose the smallest possible deviation.
5. Explain the impact of accepting or rejecting the deviation.
6. Obtain explicit owner approval before changing the plan or implementation scope.
7. Record any approved deviation in the implementation plan.
   A preference, alternative coding style, or potentially cleaner architecture is not, by itself, a sufficient reason to deviate from the approved plan.

## 3. Testing principle

Testing is performed as part of every implementation step.

Each GitHub Copilot prompt must include the tests required by that step, based on its scope, deliverables, and completion criteria.

Steps 26, 27, and 28 do not postpone all testing until the end:

- Step 26 consolidates and completes automated unit-test coverage.
- Step 27 consolidates and completes Floci integration testing.
- Step 28 consolidates and completes API acceptance and contract testing.
  Earlier steps must still implement and run their required tests before being considered complete.

---

# Phase 1: Repository foundation and canonical contracts

## Purpose

Establish the repository, service structure, shared contracts, and canonical schemas required by all later implementation work.

## Steps

### Step 01: Assess and align the existing repository

Establish the repository baseline, identify reusable template conventions, and remove or classify unsuitable template functionality.

### Step 02: Establish the service structure and configuration

Create the architectural component boundaries and central environment-based configuration.

### Step 03: Define shared domain types and contracts

Define shared dataset identifiers, collection contracts, manifest contracts, component interfaces, query and upload contracts, and service errors.

### Step 04: Define canonical collection schemas

Define versioned, machine-validatable schemas for vessels, gears, ports, species, map land, map statistical areas, collection envelopes, and manifests.

## Status

- Step 01: Implemented
- Step 02: Implemented
- Step 03: Implemented
- Step 04: Implemented

## Phase completion outcome

- Repository aligned with the Reference Data Service.
- No database connection required.
- No Redis-backed cache required.
- Component boundaries established.
- Environment configuration established.
- Shared domain contracts established.
- Canonical schema version `1.0` established.
- Structural schema tests implemented.

---

# Phase 2: In-memory storage and S3-compatible persistence

## Purpose

Implement active in-process storage, configure the existing local S3-compatible environment, and implement the persistence boundary.

## Steps

### Step 05: Implement the In-Memory Data Store

Implement controlled storage and atomic replacement of active canonical collections and manifest metadata as process-local JSON objects.

### Step 06: Configure Floci S3 resources for local development

Configure the repository’s existing Floci environment to create the local reference-data bucket and support the approved object-key convention.

### Step 07: Implement the Persistence Module

Implement the only component permitted to communicate directly with Floci or AWS S3.

## Required sequence

1. Step 05
2. Step 06
3. Step 07

## Phase completion outcome

- Active reference data can be stored safely in process memory.
- Floci provides the local S3-compatible bucket.
- The Persistence Module can read and write collections and manifest data.
- No other component directly accesses S3.
- Unit and Floci integration tests required by these steps pass.

---

# Phase 3: Validation and canonical normalisation

## Purpose

Implement the validation and deterministic transformation pipeline used before data is persisted or activated.

## Steps

### Step 08: Implement common structural and business validation

Implement reusable validation for datasets, GUIDs, metadata, item counts, versions, business codes, relationships, upload size, and content types.

### Step 09: Implement dataset-specific validation

Implement vessel, gear, port, species, and map-specific validation rules.

### Step 10: Implement canonical data normalisation

Implement deterministic transformation of accepted inputs into canonical reference-data representations.

## Required sequence

1. Step 08
2. Step 09
3. Step 10

## Phase completion outcome

- Common validation rules are reusable.
- Dataset-specific business rules are enforced.
- Validation findings use consistent error structures.
- Valid inputs can be transformed deterministically.
- Existing GUIDs and business identifiers are preserved.
- Required tests for common validation, dataset validation, and normalisation pass.

---

# Phase 4: Cache lifecycle, authentication, and common API behaviour

## Purpose

Connect persistence to the in-memory cache, enforce security through the Authentication Service, and establish consistent API transport behaviour.

## Steps

### Step 11: Implement the Cache Refresh Module and startup hydration

Load active persisted collections into memory and refresh only collections whose metadata has changed.

### Step 12: Implement Authentication Service integration

Implement token validation and read/write permission checks through the Validation Module.

### Step 13: Implement common API behaviour and error handling

Implement the reference-data route prefix, correlation identifiers, standard errors, ETag handling, cache headers, media types, and request limits.

## Required sequence

1. Step 11
2. Step 12
3. Step 13
   The dependencies stated in the approved implementation plan remain authoritative.

## Phase completion outcome

- Active collections are hydrated during startup.
- Changed collections can be refreshed safely.
- Authentication and authorisation are enforced.
- Only the Validation Module calls the Authentication Service.
- API responses use consistent transport and error behaviour.
- Required unit, integration, and route-level tests pass.

---

# Phase 5: Manifest, query engine, and read APIs

## Purpose

Expose active reference data through the manifest, reusable query capabilities, canonical responses, mobile projections, and GeoJSON endpoints.

## Steps

### Step 14: Implement the manifest API

Expose active dataset versions and metadata through:

Plain Text

```text
GET /api/v1/reference-data/manifest
```

### Step 15: Implement the common collection query engine

Implement reusable full-collection retrieval, GUID lookup, business-code lookup, filtering, searching, sorting, pagination, and representation selection.

### Step 16: Implement vessel query endpoints and mobile projection

Expose canonical and mobile vessel data and vessel-specific searches.

### Step 17: Implement gear query endpoints and mobile projection

Expose canonical and mobile gear data, including vessel-length applicability and measurement projections.

### Step 18: Implement port query endpoints, location search, and map projection

Expose port queries, radius search, and the derived map-port GeoJSON representation.

### Step 19: Implement species query endpoints and name resolution

Expose species queries and deterministic language and country-aware mobile display-name resolution.

### Step 20: Implement map-location query endpoints

Expose land and statistical-area reference data as GeoJSON, including code, parent-code, text, and bounding-box filters.

## Required sequence

1. Step 14
2. Step 15
3. Step 16
4. Step 17
5. Step 18
6. Step 19
7. Step 20

## Phase completion outcome

- Clients can inspect active collection versions.
- Clients can retrieve complete collections.
- Clients can retrieve individual records by GUID.
- Clients can search and filter datasets.
- Canonical and mobile representations are available.
- Map data is available as GeoJSON.
- `map-ports` remains derived from the ports collection.
- Required tests for each endpoint, query capability, and projection pass.

---

# Phase 6: Full collection management and local bootstrap

## Purpose

Implement validation-only uploads, atomic full collection replacement, and deterministic local reference-data setup.

## Steps

### Step 21: Implement full collection upload validation mode

Allow authorised users to validate complete uploaded collections without changing active state.

### Step 22: Implement atomic full collection replacement

Implement complete collection persistence, manifest activation, in-memory replacement, concurrency protection, and safe failure handling.

### Step 23: Add seed reference data and deterministic local bootstrap

Provide valid local collections, an initial manifest, and an idempotent Floci bootstrap process.

## Required sequence

1. Step 21
2. Step 22
3. Step 23

## Phase completion outcome

- Complete files can be validated without activation.
- Valid collections can be activated atomically.
- Invalid uploads leave active data unchanged.
- Partial failures do not expose incomplete active state.
- Local reference data can be bootstrapped deterministically.
- No item-level mutation API is introduced.
- Required unit and Floci integration tests pass.

---

# Phase 7: Operational readiness and observability

## Purpose

Provide deployment-compatible service status and observability.

## Steps

### Step 24: Implement health, readiness, and dependency status

Expose liveness, readiness, cache-hydration state, and appropriate dependency status.

### Step 25: Add structured logging, metrics, and audit events

Add request correlation, operational metrics, security-conscious logging, and audit events for collection-management activity.

## Required sequence

1. Step 24
2. Step 25

## Phase completion outcome

- Liveness and readiness have distinct meanings.
- Required collection availability affects readiness.
- Transient dependency failures do not incorrectly determine process liveness.
- Requests and collection-management operations are traceable.
- Sensitive values are redacted.
- Required operational tests pass.

---

# Phase 8: Test consolidation and system verification

## Purpose

Complete and consolidate automated coverage after testing has already been performed throughout Steps 01 through 25.

## Steps

### Step 26: Complete automated unit testing

Review and complete unit-test coverage across configuration, schemas, validation, normalisation, storage, refresh, authentication, queries, projections, errors, uploads, and concurrency.

### Step 27: Complete Floci integration testing

Review and complete integration coverage for persistence, hydration, refresh, upload, failure handling, and restart behaviour using the existing Floci service.

### Step 28: Complete API acceptance and contract testing

Verify the complete public API against the approved Reference Data Service API contract.

## Required sequence

1. Step 26
2. Step 27
3. Step 28

## Phase completion outcome

- Unit-test coverage is complete and deterministic.
- S3-compatible behaviour is verified against Floci.
- Public API behaviour matches the approved contract.
- Canonical and mobile representations are independently verified.
- Error and authorisation scenarios are covered.
- Testing from previous steps is retained rather than replaced.

---

# Phase 9: Cleanup, security, privacy, and documentation

## Purpose

Remove any remaining unused artifacts, harden the completed implementation, and ensure the service is fully documented.

## Steps

### Step 29: Remove unused template infrastructure and examples

Remove any remaining unused template artifacts identified after Steps 02 through 28.

The approved deviation remains in effect: MongoDB, Redis, and example functionality were already removed during Step 01. Step 29 must not repeat that completed work unnecessarily.

### Step 30: Complete security and privacy hardening

Review authentication, permissions, upload controls, parser limits, GeoJSON complexity, logging, AWS access, encryption, error disclosure, rate limits, audit integrity, and privacy classification.

### Step 31: Update developer and API documentation

Complete the README, OpenAPI specification, schema documentation, error catalogue, upload guide, operations guide, and troubleshooting guidance.

## Required sequence

1. Step 29
2. Step 30
3. Step 31

## Phase completion outcome

- No unnecessary template artifacts remain.
- Security and privacy controls have been reviewed.
- Security-critical findings are resolved.
- Developer, consumer, administrator, and operational documentation is complete.
- Required checks and tests continue to pass.

---

# Phase 10: Final architecture and release review

## Purpose

Confirm that the completed service conforms to the approved design and is ready for deployment.

## Steps

### Step 32: Final architecture and implementation review

Review implementation evidence against:

- C4 Level 3 boundaries
- Approved API design
- Canonical schemas
- Mobile projections
- GUID strategy
- Full collection replacement
- S3 ownership
- Authentication ownership
- In-memory storage
- Cache refresh
- Error contract
- Security requirements
- Test coverage
- Documentation

## Phase completion outcome

- Design conformance is verified.
- Deviations are corrected or formally accepted.
- Technical debt and operational risks are recorded.
- Required test suites pass.
- Security-critical findings are resolved.
- The Reference Data Service is ready for its first target environment.

---

# Implementation progress

## Completed

- Step 01: Assess and align the existing repository
- Step 02: Establish the service structure and configuration
- Step 03: Define shared domain types and contracts
- Step 04: Define canonical collection schemas
- Step 05: Implement the In-Memory Data Store
- Step 06: Configure Floci S3 resources for local development
- Step 07: Implement the Persistence Module
- Step 08: Implement common structural and business validation
- Step 09: Implement dataset-specific validation
- Step 10: Implement canonical data normalisation
- Step 11: Implement the Cache Refresh Module and startup hydration
- Step 12: Implement Authentication Service integration
- Step 13: Implement common API behaviour and error handling
- Step 14: Implement the manifest API
- Step 15: Implement the common collection query engine
- Step 16: Implement vessel query endpoints and mobile projection
- Step 17: Implement gear query endpoints and mobile projection
- Step 18: Implement port query endpoints, location search, and map projection
- Step 19: Implement species query endpoints and name resolution
- Step 20: Implement map-location query endpoints
- Step 21: Implement full collection upload validation mode
- Step 22: Implement atomic full collection replacement
- Step 23: Add seed reference data and deterministic local bootstrap
- Step 24: Implement health, readiness, and dependency status

## Next approved step

- Step 25: Add structured logging, metrics, and audit events

## Remaining steps

- Steps 25 through 32, in the exact order and scope defined by the approved implementation plan.

---

# Control rule for future GitHub Copilot prompts

Every future GitHub Copilot prompt must:

1. Correspond to exactly one approved implementation step.
2. Preserve the step title.
3. Preserve the step objective.
4. Preserve the step scope.
5. Preserve the deliverables.
6. Preserve the completion criteria.
7. Preserve the dependencies.
8. Include the tests required to complete that step.
9. Exclude work allocated to later steps.
10. Avoid changing the implementation sequence.
11. Avoid adding a database or Redis.
12. Keep S3 access inside the Persistence Module.
13. Keep Authentication Service access inside the Validation Module.
14. Use the existing Floci service for local S3-compatible integration.
15. Preserve GUIDs separately from business identifiers.
16. Request clarification when the approved plan does not provide enough information.
17. Require explicit owner approval before applying any deviation.
