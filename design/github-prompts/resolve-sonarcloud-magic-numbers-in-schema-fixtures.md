# Resolve SonarCloud Magic Numbers in Schema Fixtures

## Recommended reasoning effort

- Planning phase: Medium
- Implementation phase: Medium

## Objective

Resolve the SonarCloud `S109` hardcoded magic-number findings caused by reference-data fixture values stored in JavaScript files.

Move fixture data that is purely declarative from JavaScript modules into JSON files, while preserving all existing test behaviour, schema coverage, fixture intent, and repository conventions.

This is a focused quality remediation. It must not change the approved Reference Data Service implementation plan, canonical schemas, validation behaviour, or application architecture.

## Required working mode

Start in Plan mode.

Before modifying files:

1. Inspect the current working tree.
2. Run:
   Shell

```text
git status --short
git diff --stat
```

1. Inspect the exact SonarCloud findings, if available in the repository, CI output, pull request, or Sonar report.
2. Confirm which JavaScript fixture files are affected by `S109` .
3. Inspect:

- `src/common/schemas/fixtures/valid`
- `src/common/schemas/fixtures/invalid`
- Tests importing those fixtures
- Schema registry tests
- Existing JSON import conventions
- Node.js module configuration
- Vitest configuration
- ESLint and Prettier configuration

4. Determine which fixture modules contain only declarative data.
5. Identify invalid fixtures that currently derive data from valid fixtures using spread syntax, cloning, or mutation.
6. Identify any fixture JavaScript files that contain meaningful executable logic and should not be converted blindly.
7. Confirm Node.js and Vitest support for JSON module imports in the repository’s current ESM configuration.
8. Produce a concise file-by-file plan and wait for approval.
   Do not change the approved 32-step implementation plan.

After approval, implement only this focused SonarCloud remediation.

## Required solution

### 1. Convert pure fixture data to JSON

Convert JavaScript fixture modules containing only hardcoded reference-data payloads into `.json` files.

This includes applicable files under:

Plain Text

```text
src/common/schemas/fixtures/valid
src/common/schemas/fixtures/invalid
```

The JSON files must contain only valid JSON data.

Do not include:

- JavaScript exports
- Comments
- Spread syntax
- Functions
- Imports
- `undefined`
- Trailing commas
- Computed values
  Preserve fixture values and structural intent exactly unless a change is required to maintain equivalent JSON semantics.

### 2. Preserve fixture meaning

The conversion must not change:

- Dataset identifiers
- Collection IDs
- Resource GUIDs
- Collection versions
- Schema versions
- Timestamps
- Item counts
- Coordinates
- Business identifiers
- Invalid condition represented by each invalid fixture
- Expected validation paths
- Expected validation messages
- Test coverage
  Each invalid fixture should continue to represent the same primary structural failure it represented before conversion.

### 3. Handle composed invalid fixtures explicitly

Pure JSON cannot use spread syntax or derive an invalid fixture dynamically from a valid fixture.

For invalid fixtures currently composed from valid fixtures, choose the smallest maintainable solution based on the actual repository:

#### Preferred option

Create a complete, self-contained JSON fixture containing the full invalid payload.

Some data duplication is acceptable in test fixtures when it makes the invalid case explicit and removes executable hardcoded data from JavaScript.

#### Alternative option

Retain a small JavaScript fixture builder only when a self-contained JSON fixture would create excessive or misleading duplication.

If a JavaScript builder is retained:

- Import the base JSON fixture.
- Apply only the minimum mutation required for the test.
- Avoid adding unrelated numeric literals.
- Use a clearly named constant if an unavoidable numeric value has business meaning.
- Explain why the JavaScript builder is retained.
- Confirm that the retained file no longer triggers the reported SonarCloud finding.
  Do not introduce a generic fixture framework solely to avoid small amounts of JSON duplication.

### 4. Update JSON imports

Update all fixture consumers to import JSON using the syntax supported by the repository’s Node.js version and module system.

For an ESM repository on Node.js 24, prefer the repository-compatible form:

JavaScript

```text
import validPortsCollection from './ports.json' with { type: 'json' }
```

Before applying this syntax everywhere, verify that:

- The current Node.js runtime supports it.
- Vitest supports it in the current configuration.
- ESLint parses it correctly.
- The repository does not already use a different approved JSON-loading convention.
  Do not introduce filesystem reads or custom JSON loaders when native JSON imports work correctly.

### 5. Keep executable schema logic in JavaScript

Do not convert actual application or schema logic files to JSON.

The following categories must remain JavaScript:

- Schema definitions
- Schema registry
- Schema resolver
- GeoJSON schema fragments
- Validation functions
- Dataset helpers
- Representation helpers
- Service errors
- Test logic
- Fixture builders that genuinely require controlled executable composition
  This remediation applies to declarative fixture data, not executable application logic.

### 6. Preserve the approved architecture

Do not add or change:

- Database connections
- MongoDB
- Redis
- DynamoDB
- S3 integration
- Floci provisioning
- Authentication Service integration
- API endpoints
- In-memory storage
- Cache refresh
- Business validation
- Data normalisation
- Mobile projections
- Upload behaviour
- Canonical schema definitions, except for import-path adjustments strictly required by the fixture conversion

### 7. Avoid suppressing valid findings

Do not resolve the issue by:

- Disabling Sonar rule `S109` globally
- Adding broad `NOSONAR` comments
- Excluding all schema or test files from Sonar analysis
- Adding arbitrary named constants for every coordinate
- Moving executable logic into JSON
- Weakening tests
- Removing fixtures
- Deleting assertions
- Changing coverage exclusions without approval
  If a narrow Sonar exclusion is genuinely required, stop and explain why conversion cannot resolve the reported finding before changing any configuration.

## Testing requirements

Update tests only as needed to load the JSON fixtures.

Run the fixture and schema tests affected by the conversion first.

Then run the complete repository checks using the existing scripts from `package.json` .

At minimum, run the applicable equivalents of:

Shell

```text
npm test
npm run lint
npm run format:check
npm run test:coverage
```

If the repository provides a local Sonar or static-analysis command, run it as well.

If SonarCloud can only run in CI:

1. Confirm that the affected hardcoded fixture data no longer exists in JavaScript files.
2. Report the exact files converted.
3. Report any JavaScript fixture builders retained.
4. Explain why each retained builder is necessary.
5. State that final SonarCloud verification requires the CI analysis.

## Formatting requirements

Format all files created or modified by this remediation.

For JSON files, ensure:

- Valid JSON syntax
- Repository-compatible indentation
- Final newline
- Prettier compliance
  Do not reformat unrelated files under generated conversation, metadata, or design directories.

If the repository-wide format check still reports unrelated pre-existing files:

- Report those warnings accurately.
- Confirm that every file changed by this remediation passes Prettier.
- Do not modify unrelated files merely to obtain a clean global result.

## Acceptance criteria

This remediation is complete only when:

- Pure JavaScript fixture data has been moved to JSON where appropriate.
- Fixture consumers load JSON through the repository-compatible import mechanism.
- Every converted fixture preserves its original data and test purpose.
- Every invalid fixture continues to fail for the intended reason.
- Valid fixtures continue to pass their canonical schemas.
- No test coverage is removed.
- No test assertion is weakened.
- The reported magic-number literals no longer exist in affected JavaScript fixture files.
- Actual schema and validation logic remains in JavaScript.
- Sonar rule `S109` has not been globally disabled.
- Broad Sonar exclusions have not been added.
- No database or external integration has been introduced.
- The approved implementation plan remains unchanged.
- Relevant tests pass.
- The complete test suite passes.
- Linting passes.
- All files changed by this remediation pass Prettier.
- Final SonarCloud verification is completed in CI or clearly identified as pending CI execution.

## Final response requirements

After implementation, report:

1. The SonarCloud issue addressed.
2. Files converted from JavaScript to JSON.
3. JavaScript files removed.
4. Importing files modified.
5. Invalid fixtures that required full JSON duplication.
6. Any JavaScript fixture builders retained and the reason.
7. Tests executed and results.
8. Linting result.
9. Formatting result.
10. Sonar or static-analysis result, if locally available.
11. Whether final SonarCloud confirmation is pending CI.
12. Confirmation that no tests were weakened or removed.
13. Confirmation that no canonical schema behaviour changed.
14. Confirmation that the approved implementation plan was not changed.
15. Confirmation that no database, S3, authentication, cache, or API functionality was introduced.
    If conversion exposes a conflict between JSON module imports, Node.js, Vitest, ESLint, or the repository module system, stop and show the exact error before selecting a different loading approach.

If you reach any ambiguity, ask me to clarify.
