# Reference Data Service Implementation Phases

The implementation plan is divided into **10 phases** . Since **Step 01 is now “Assess and align the existing repository”** , the original project-foundation work moves to Step 02 and subsequent step numbers should be adjusted when we generate the individual prompts.

## Phase 1: Repository and service foundation

- **Step 01:** Assess and align the existing repository
- **Step 02:** Create or complete the Reference Data Service project foundation
- **Step 03:** Establish configuration and environment validation
- **Step 04:** Define shared domain types and module contracts

## Phase 2: Canonical data contracts

- **Step 05:** Define the common collection and manifest schemas
- **Step 06:** Implement the vessel canonical schema
- **Step 07:** Implement the gear canonical schema
- **Step 08:** Implement the port canonical schema
- **Step 09:** Implement the species canonical schema
- **Step 10:** Implement the map-location canonical schemas

## Phase 3: Persistence and local infrastructure

- **Step 11:** Implement the S3 Persistence Module
- **Step 12:** Add LocalStack and local reference-data storage

## Phase 4: In-memory data and refresh behaviour

- **Step 13:** Implement the In-Memory Data Store
- **Step 14:** Implement initial cache loading and readiness behaviour
- **Step 15:** Implement the Cache Refresh Module

## Phase 5: Security and validation

- **Step 16:** Implement Authentication Service integration
- **Step 17:** Implement request and domain validation

## Phase 6: Normalisation and consumer projections

- **Step 18:** Implement canonical upload normalisation
- **Step 19:** Implement mobile response projections

## Phase 7: Query API

- **Step 20:** Implement the manifest endpoint
- **Step 21:** Implement full-collection retrieval
- **Step 22:** Implement dataset search and individual-item retrieval
- **Step 23:** Implement the map-location query endpoints

## Phase 8: Collection management API

- **Step 24:** Implement validation-only full-collection uploads
- **Step 25:** Implement atomic full-collection replacement
- **Step 26:** Implement rollback and partial-failure protection

## Phase 9: Errors and observability

- **Step 27:** Implement the standard API error model
- **Step 28:** Add structured logging, metrics, audit events, and correlation

## Phase 10: Verification and deployment readiness

- **Step 29:** Add comprehensive unit tests
- **Step 30:** Add LocalStack integration tests
- **Step 31:** Add end-to-end API tests
- **Step 32:** Add API documentation and operational guidance
- **Step 33:** Prepare AWS deployment and production hardening

## Important sequencing note

The **individual GitHub prompts should use this revised numbering** , beginning with the existing:

Plain Text

```text
Step 01: Assess and align the existing repository
```

Each phase creates the foundation required by the next one, but testing should also be added incrementally within every implementation step rather than deferred entirely to Phase 10.
