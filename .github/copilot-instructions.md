## SonarCloud Compliance and Verification

All production code and tests created or modified in this repository must be reviewed against the repository's configured SonarCloud project and the active Defra quality profile:

https://sonarcloud.io/organizations/defra/rules

### Required workflow

Before presenting a final implementation response:

1. Identify every source, test, configuration, and script file created or modified by the current task.

2. Run the repository's focused tests for the changed behaviour.

3. Run the applicable repository checks defined in `package.json`, including:
   - type checking,
   - linting,
   - formatting checks,
   - test coverage,
   - and build verification.

4. Use the locally configured `sonarqube` MCP server to inspect the created or modified files for:
   - bugs,
   - vulnerabilities,
   - security hotspots,
   - code smells,
   - maintainability findings,
   - reliability findings,
   - and duplication findings.

5. Compare findings with the active Defra SonarCloud rules and the repository's configured quality gate.

6. Fix Sonar findings introduced by the current task before presenting the final response, provided the fix:
   - remains within the current task scope,
   - preserves approved architecture,
   - preserves approved API and schema contracts,
   - does not weaken tests,
   - and does not suppress or bypass an active rule.

7. After each fix, rerun:
   - the affected focused tests,
   - linting,
   - formatting checks,
   - and the available Sonar analysis.

### Scope control

Do not modify unrelated files solely to resolve pre-existing Sonar findings.

Classify every reported finding as one of:

- introduced by the current task,
- pre-existing in a file modified by the current task,
- pre-existing and unrelated to the current task,
- or a potential false positive.

Automatically fix findings introduced by the current task when the correction is unambiguous and remains in scope.

Report pre-existing or unrelated findings separately. Do not expand the task scope to resolve them without approval.

If resolving a finding requires changing an approved architecture, API contract, schema, business rule, security policy, or implementation plan, stop and ask me to clarify before applying the change.

### Prohibited approaches

Do not obtain compliance by:

- disabling Sonar rules globally,
- adding broad `NOSONAR` comments,
- excluding newly modified production files from analysis,
- weakening or deleting tests,
- removing assertions,
- reducing coverage requirements,
- hiding duplicated production code through exclusions,
- swallowing errors,
- or changing approved behaviour without permission.

A narrow suppression may only be proposed when a finding is demonstrably a false positive. Explain the rule, location, rationale, and alternatives, then wait for approval.

### Test-file duplication policy

Test files may be excluded from copy-paste duplication calculations only through the repository's approved Sonar configuration:

```properties
sonar.cpd.exclusions=**/*.test.js