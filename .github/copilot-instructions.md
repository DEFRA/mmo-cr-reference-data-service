# GitHub Copilot Repository Instructions

## Environment & Tooling
- **Static Analysis Engine:** SonarQube Cloud
- **Local Validation Interface:** SonarQube Model Context Protocol (MCP) Server

## Verification Rules & Workflows
Before presenting, generating, or modifying any code in this repository, you must strictly follow these validation steps:

1. **Pre-Execution Rule Checks:**
   - **VERIFY** all proposed code modifications against the locally configured `sonarqube` MCP tool before providing a final response.
   - Ensure complete adherence to our organization's custom quality gates and active rule profiles hosted at `https://sonarcloud.io[organisation-name]/rules`.

2. **Handling Violations:**
   - If the SonarQube MCP tool flags any bugs, code smells, or security vulnerabilities, you must patch those violations locally *before* outputting the final code snippet.
   - Do not suggest workarounds that bypass active SonarCloud rules unless explicitly requested with a justified rationale.
