# Step 05: Implement the In-Memory Data Store

## Recommended reasoning effort

- Planning phase: High
- Implementation phase: High

## Role

Act as a senior Node.js backend engineer implementing the Reference Data Service for the Catch Recording application.

Implement the In-Memory Data Store exactly as defined by Step 05 of the approved implementation plan.

Do not modify, reorder, expand, or reinterpret the approved implementation plan.

## Approved objective

Provide a controlled in-process store for active JSON collections and metadata.

## Required working mode

Start in Plan mode.

Before proposing any changes:

1. Inspect the complete repository.
2. Read the approved Reference Data Service implementation plan.
3. Read the approved plans for Steps 01 through 04.
4. Inspect the implementation completed in Steps 01 through 04.
5. Inspect the In-Memory Data Store module boundary established in Step 02.
6. Inspect the shared In-Memory Data Store contract defined in Step 03.
7. Inspect the following Step 03 contracts:

- Dataset identifiers
- Dataset capabilities
- Collection envelope
- Collection metadata
- Manifest
- Manifest dataset entry
- Service error

8. Inspect the canonical schemas and fixtures introduced in Step 04.
9. Inspect the existing test framework, test conventions, assertion style, linting rules, and formatting rules.
10. Inspect existing immutability, cloning, object-freezing, and dependency-injection conventions.
11. Review the current Git working tree:
    Shell

```text
git status --short
git diff --stat
```

1. Identify any difference between the Step 03 store contract and the approved Step 05 scope.
2. Identify any ambiguity before proposing implementation.
   Do not modify files during the planning phase.

Produce a concise file-by-file implementation plan and wait for approval.

After the plan is approved, the first implementation action must be to save the approved plan as:

Plain Text

```text
github-prompts/Step 05-implement-in-memory-data-store-plan.md
```

Only after saving the approved plan may source-code implementation begin.

## Approved scope

Implement operations to:

- Store a canonical collection.
- Retrieve a complete collection.
- Retrieve collection metadata.
- Determine whether a collection is loaded.
- Replace a collection atomically.
- Remove a collection for test and recovery scenarios.
- Store and retrieve the active manifest.
- List loaded datasets.
- Clear the store during tests.
- Prevent mutable references from unintentionally changing active data.
  Do not expand this scope without explicit approval.

## Architecture context

The In-Memory Data Store:

- Holds active canonical reference-data collections as process-local JSON-compatible objects.
- Holds collection metadata.
- Holds the active manifest.
- Is an in-process cache.
- Is not durable persistence.
- Is not shared between application instances.
- Must be rebuilt from S3-compatible storage after a process restart in a later step.
- Must not communicate with S3 or Floci.
- Must not communicate with the Authentication Service.
- Must not depend on Hapi request or response objects.
- Must not implement query, validation, normalisation, or API behaviour.
  The supported authoritative datasets are:

- `vessels`
- `gears`
- `ports`
- `species`
- `map-land`
- `map-statistical-areas`
  `map-ports` is derived from ports. It is not independently uploaded or persisted.

Use the dataset capabilities defined in Step 03 rather than creating another dataset registry.

## Mandatory constraints

### No database

The Reference Data Service does not use a database.

Do not introduce:

- MongoDB
- Redis
- DynamoDB
- PostgreSQL
- MySQL
- SQLite
- An ORM
- An ODM
- Database models
- Database repositories
- Database migrations
- Database connections
- Database transactions
- Database query syntax
  The word `collection` means a complete versioned reference-data collection, not a database collection.

### No external storage integration

Do not implement:

- AWS SDK usage
- S3 access
- Floci access
- File-system persistence
- Manifest file loading
- Startup hydration
- Cache refresh scheduling
- External cache access
  S3 and Floci integration belong to later approved steps.

### No business workflow

Do not implement:

- Querying or filtering collection items
- Collection validation
- Dataset-specific validation
- Data normalisation
- Mobile projections
- Upload processing
- Manifest activation
- Authentication
- Authorisation
- API routes
- HTTP error mapping

## Implementation requirements

### 1. Implement the existing store contract

Implement the In-Memory Data Store contract created in Step 03.

Do not create a competing interface.

If the existing contract is incomplete or incompatible with the approved Step 05 scope:

1. Stop before modifying the contract.
2. Explain the exact mismatch.
3. Propose the smallest required correction.
4. Wait for approval.
   The implementation must remain substitutable through the Step 03 contract.

### 2. Store a canonical collection

Provide an operation that stores a complete canonical collection and its metadata for one supported dataset.

The operation must:

- Require a supported dataset identifier.
- Store the complete collection.
- Store the associated collection metadata.
- Keep the collection and metadata logically associated.
- Avoid modifying other datasets.
- Reject unsupported datasets deterministically.
- Reject derived `map-ports` as an independently stored authoritative collection unless the Step 03 contract explicitly defines an approved derived-data mechanism.
- Avoid applying schema or business validation that belongs to Steps 08 and 09.
- Avoid normalising the collection.
  The caller is responsible for supplying an already accepted canonical collection.

### 3. Retrieve a complete collection

Provide an operation that retrieves the active complete collection for a dataset.

Define deterministic behaviour when:

- The dataset is unsupported.
- The supported dataset has not been loaded.
- The collection exists.
- The stored value is `null` , empty, or otherwise valid JSON-compatible content according to the existing contract.
  Use the existing service-error model where the Step 03 contract requires errors.

Do not invent HTTP status codes or Hapi responses.

### 4. Retrieve collection metadata

Provide an operation that retrieves the active metadata for a dataset.

The returned metadata must correspond to the same active collection returned by the collection-retrieval operation.

A collection replacement must never leave new collection data paired with old metadata, or old collection data paired with new metadata.

### 5. Determine whether a collection is loaded

Provide a deterministic operation that reports whether an active collection is currently loaded for a supported dataset.

The operation must distinguish:

- Unsupported dataset
- Supported but unloaded dataset
- Supported and loaded dataset
  Do not treat an empty but valid collection as unloaded merely because it contains zero items.

### 6. Replace one collection atomically

Provide an operation that replaces one dataset’s active collection and metadata as one logical operation.

Atomicity in this step means:

- Readers observe either the previous collection and metadata pair or the replacement pair.
- Readers must not observe a partially applied replacement.
- A failed replacement must leave the previous collection and metadata unchanged.
- Replacing one dataset must not alter any other dataset.
- No asynchronous external dependency may be involved.
  Construct and defensively prepare the replacement before publishing it to the active store.

If the language runtime is single-threaded, still structure the operation so the active entry is assigned only after all preparation succeeds.

Do not implement distributed locking or cross-process consistency.

### 7. Remove a collection

Provide a controlled operation that removes one active collection and its metadata.

This operation exists for:

- Tests
- Recovery scenarios
- Later controlled cache-management behaviour
  Removing a collection must:

- Remove the collection and associated metadata together.
- Avoid affecting other datasets.
- Have deterministic behaviour when the dataset is not loaded.
- Reject unsupported datasets.
  Do not expose this operation through an API route.

### 8. Store and retrieve the active manifest

Provide operations to:

- Set the active manifest.
- Retrieve the active manifest.
- Determine or handle the state in which no manifest is loaded.
  The store must treat the manifest as process-local cached state.

Do not:

- Read a manifest from S3.
- Write a manifest to S3.
- Validate manifest business relationships.
- Activate persisted collection versions.
- Automatically load collections from manifest entries.
  Those behaviours belong to later steps.

### 9. List loaded datasets

Provide an operation returning the datasets for which active collections are currently loaded.

The result must be deterministic.

Use one ordering rule and test it. Prefer the centrally defined dataset order if Step 03 provides one. Otherwise use a clearly documented stable order.

Do not derive the list from an independently maintained duplicate registry.

### 10. Clear store state

Provide a controlled operation that clears:

- All loaded collections.
- All collection metadata.
- The active manifest.
  This operation is primarily intended for tests.

Do not expose it through a production HTTP endpoint.

The operation must leave the store in the same logical state as a newly created instance.

### 11. Defensive data access

Prevent callers from unintentionally mutating the active store through references passed into or returned from it.

Protect against both:

- Mutation of an object after it has been supplied to the store.
- Mutation of an object returned by the store.
  Apply the same protection to:

- Collections
- Collection metadata
- Manifests
  Use the smallest reliable strategy compatible with the stored data.

Acceptable strategies include:

- Structured cloning on write and read.
- Deep cloning through an existing safe utility.
- Deep freezing combined with controlled cloning.
- Another repository-compatible strategy that protects nested arrays and objects.
  Do not use shallow spread syntax as the only protection for nested data.

Do not use JSON stringification as a cloning mechanism if it would silently alter supported JSON-compatible values or obscure errors.

Because canonical collections are JSON-compatible, `structuredClone` may be suitable on Node.js 24. Verify repository and test-runtime compatibility before using it.

Document the selected defensive-access strategy and its trade-offs.

### 12. Store construction and state isolation

Prefer an explicit factory, class instance, or repository-compatible construction pattern that creates isolated store state.

Tests must be able to create multiple independent stores.

Avoid module-level mutable singleton state unless Step 02 explicitly established and justified that convention.

If a production singleton is needed later, composition should create it outside the store implementation.

### 13. Validation boundary

This step may validate only what is required to protect the store contract, such as:

- Supported dataset identifier.
- Required collection and metadata arguments.
- Dataset consistency between the operation and supplied metadata where the existing contract defines this.
- JSON-compatible cloneability if relevant to defensive storage.
- Prohibition on independently storing a derived dataset.
  Do not implement the structural or business validation allocated to Steps 08 and 09.

Do not rerun the Step 04 schema validators automatically on every store operation unless the approved Step 03 contract explicitly requires it. The store is not the canonical validation boundary.

### 14. Error behaviour

Use the Step 03 service-error model and existing error codes.

Do not create a second error model.

Provide deterministic errors for conditions such as:

- Unsupported dataset.
- Collection not loaded, if the contract uses errors rather than an absent result.
- Manifest not loaded, if the contract uses errors rather than an absent result.
- Invalid store input.
- Attempt to store a non-storage-capable derived dataset.
- Failure to defensively clone supplied content.
  Internal diagnostic causes must not be publicly serialised.

Do not implement HTTP mapping.

## Expected implementation shape

Adapt to the repository structure established by Step 02 and the contract location established by Step 03.

A possible structure is:

Plain Text

```text
src/
  in-memory-store/
    in-memory-data-store.js
    in-memory-data-store.test.js
    index.js
```

Do not force this structure if the repository already uses a different coherent convention.

Do not move unrelated files.

Do not duplicate the Step 03 contract inside the implementation directory.

## Testing requirements

Testing is part of Step 05 and must be completed within this step.

Use the repository’s existing test framework and conventions.

Add unit tests for all public store operations.

### Store construction

Test that:

1. A newly created store has no loaded collections.
2. A newly created store has no active manifest.
3. Two store instances do not share state.

### Store and retrieve collection

Test that:

1. A supported canonical collection and metadata can be stored.
2. The complete collection can be retrieved.
3. The associated metadata can be retrieved.
4. An empty valid collection is still considered loaded.
5. An unsupported dataset is rejected.
6. `map-ports` cannot be stored independently.
7. Other datasets remain unchanged.

### Loaded-state behaviour

Test that:

1. An unloaded supported dataset reports false.
2. A loaded dataset reports true.
3. A loaded empty collection reports true.
4. An unsupported dataset is handled deterministically.

### Atomic replacement

Test that:

1. A collection can be replaced.
2. Replacement updates collection and metadata together.
3. Replacement of one dataset does not affect another.
4. A failure while preparing replacement data preserves the previous collection.
5. Readers never observe mismatched collection and metadata.
6. The previous collection remains available after a failed replacement.
   Use deterministic test doubles or deliberately uncloneable inputs where needed to test preparation failure. Do not introduce external dependencies.

### Removal

Test that:

1. Removing a loaded dataset removes its collection and metadata.
2. Removing one dataset does not affect another.
3. Removing an unloaded supported dataset has deterministic behaviour.
4. Removing an unsupported dataset is rejected.

### Manifest behaviour

Test that:

1. A manifest can be stored.
2. The active manifest can be retrieved.
3. Replacing the manifest replaces it completely.
4. The no-manifest state is deterministic.
5. Collection operations do not unintentionally modify the manifest.
6. Manifest operations do not unintentionally modify collections.

### Loaded dataset listing

Test that:

1. No datasets are returned for a new store.
2. Only loaded datasets are returned.
3. Removed datasets no longer appear.
4. Results use a stable documented order.
5. Derived `map-ports` does not appear as an independently stored authoritative dataset.

### Clear behaviour

Test that:

1. Clear removes all collections.
2. Clear removes all metadata.
3. Clear removes the active manifest.
4. Clear leaves the store reusable.
5. Clear does not affect another store instance.

### Defensive access

Test nested mutation protection explicitly:

1. Mutating the original collection after storage does not modify stored data.
2. Mutating the original metadata after storage does not modify stored metadata.
3. Mutating the original manifest after storage does not modify the stored manifest.
4. Mutating a retrieved collection does not modify subsequent reads.
5. Mutating retrieved metadata does not modify subsequent reads.
6. Mutating a retrieved manifest does not modify subsequent reads.
7. Nested arrays and nested objects are protected, not only top-level properties.

### Regression testing

Run:

- The Step 05 test file or files in isolation.
- All tests from Steps 01 through 04.
- The complete repository test suite.
- Test coverage.
- Linting.
- Formatting checks for changed files.
  Do not defer these tests to Step 26.

## SonarCloud considerations

Avoid introducing quality findings such as:

- Magic numbers in executable test logic.
- Excessive cognitive complexity.
- Duplicate implementation logic.
- Unhandled exceptional paths.
- Mutable exported singleton state.
- Unnecessary conditionals.
- Weak or duplicated assertions.
  Use clearly named test constants and JSON fixtures where appropriate.

Do not move implementation logic into JSON merely to avoid SonarCloud findings.

Do not disable SonarCloud rules globally.

## Documentation requirements

Add or update concise documentation explaining:

- The purpose of the In-Memory Data Store.
- The store is process-local.
- The store is not durable.
- S3 remains the future durable source of truth.
- The store does not use Redis.
- The service does not use a database.
- State is lost on application restart.
- Startup hydration is implemented later in Step 11.
- The defensive-access strategy.
- The meaning of atomic replacement in a single application process.
- How to create an isolated store instance in tests.
  Use the repository’s existing documentation location.

Do not duplicate the complete architecture design.

## Security and privacy considerations

- Do not log stored collections.
- Do not log manifest contents.
- Do not log raw reference-data objects during errors.
- Do not retain failed replacement data.
- Do not expose mutable internal references.
- Do not add credentials, bearer tokens, or AWS configuration to store state.
- Do not add HTTP request objects to store state.
- Treat all supplied data as potentially untrusted until validated by later validation components.
- Ensure clone or preparation errors do not expose complete collection contents.

## In scope

- Concrete In-Memory Data Store implementation
- Store construction
- Canonical collection storage
- Canonical collection retrieval
- Collection metadata retrieval
- Loaded-state checks
- Atomic per-dataset replacement
- Controlled collection removal
- Active manifest storage and retrieval
- Loaded dataset listing
- Test-oriented clear operation
- Defensive data access
- Unit tests for all store operations
- Focused documentation

## Out of scope

Do not implement:

- Any change to the approved implementation plan
- Database connections or abstractions
- MongoDB
- Redis
- DynamoDB
- SQL persistence
- AWS SDK clients
- S3 repositories
- Floci configuration or provisioning
- File-system persistence
- Startup hydration
- Cache refresh
- Cache scheduling
- Authentication Service integration
- Authorisation
- Hapi routes
- API handlers
- Query filtering
- Search
- Sorting
- Pagination
- Canonical-to-mobile projection
- Structural collection validation
- Dataset-specific business validation
- Data normalisation
- Upload parsing
- Manifest persistence
- Manifest activation
- Atomic persisted collection replacement
- Seed data
- OpenAPI definitions
- Deployment infrastructure

## Expected deliverables

1. Approved implementation plan saved at:
   Plain Text

```text
github-prompts/Step 05-implement-in-memory-data-store-plan.md
```

1. In-Memory Data Store implementation.
2. Atomic collection replacement.
3. Defensive data access.
4. Unit tests for all store operations.
5. Updated focused documentation.

## Approved completion criteria

The step must satisfy the completion criteria from the approved plan:

- Collections are stored as JSON-compatible objects.
- One collection can be replaced without affecting other datasets.
- Failed replacement operations leave the previous collection intact.
- Consumers cannot unintentionally mutate stored collections.
- Redis is not used.
  The step must also demonstrate that:

- Collection data and metadata are replaced together.
- The active manifest is protected from mutation.
- Store instances are isolated.
- `map-ports` is not independently stored as an authoritative collection.
- No external infrastructure is required by the unit tests.
- No functionality assigned to later steps has been implemented.

## Verification

Inspect `package.json` and use the repository’s actual scripts.

Run the applicable equivalents of:

Shell

```text
npm test -- <step-05-test-file>
npm test
npm run test:coverage
npm run lint
npm run format:check
```

If the repository has a build or type-check command, run that command as well.

Format all source, test, fixture, and documentation files created or modified in this step.

If the repository-wide formatting check reports unrelated generated artifacts:

1. Confirm every file changed by Step 05 passes Prettier.
2. Do not reformat unrelated generated conversation or metadata files.
3. Report the remaining warnings accurately.
4. Do not claim that the repository-wide formatting command passed if it exited unsuccessfully.
   If a pre-existing failure is encountered:

5. Record the exact command.
6. Record the complete relevant failure.
7. Determine whether Step 05 caused it.
8. Fix failures introduced by Step 05.
9. Do not broaden scope silently.
10. Ask for clarification if resolving the failure requires unrelated work.
    No Docker, Floci, S3, Authentication Service, Redis, or database testing is required for Step 05.

## Final response requirements

After implementation, report:

1. Summary of completed work.
2. Saved plan-file path.
3. Files created.
4. Files modified.
5. Store construction approach.
6. Defensive-access strategy.
7. Atomic replacement approach.
8. Behaviour for unloaded collections.
9. Behaviour for an unloaded manifest.
10. Handling of derived `map-ports` .
11. Tests added.
12. Commands executed and results.
13. Test coverage result.
14. Linting result.
15. Formatting result.
16. Any remaining unrelated repository warnings.
17. Confirmation that no database functionality was introduced.
18. Confirmation that Redis was not introduced.
19. Confirmation that no S3 or Floci implementation was added.
20. Confirmation that no authentication, API, validation, normalisation, or query functionality was added.
21. Work deferred to later approved steps.
22. Remaining assumptions, risks, or decisions requiring owner input.
    Do not modify the approved implementation plan.

If you reach any ambiguity, ask me to clarify.
