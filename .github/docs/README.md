# Standardised Copilot agent workflow — Reference Data Service

## Overview

This document describes the standardised Copilot agent workflow as applied to the **MMO Catch Recording
Reference Data Service** repository (Node.js, Hapi.js, in-memory collection querying, AWS S3 persistence,
FLOCI on the DEFRA Core Delivery Platform).

Each repository uses the same four-agent orchestrated workflow, driven by a single working framework
defined in `copilot-instructions.md`. The design separates responsibilities cleanly:

- **Orchestrator** — coordinates the workflow and never modifies code.
- **Planner** — plans and researches but never modifies code (used for **Complex** work only).
- **Developer** — implements changes, and writes and runs code after a plan is approved.
- **Reviewer** — performs read-only reviews and reports findings by severity (**optional, on-request**).

Alongside these four agents, a small set of skills provides specialist guidance that agents load at the
appropriate point in the workflow.

> **Canonical source.** The §3 working framework in `copilot-instructions.md` is shared verbatim across the
> Catch Recording repositories, with `DEFRA/mmo-cr-external-frontend` as the canonical copy. Only two
> repo-specific substitutions are made here: the planning agent link, and the design-authority sentence in
> step 6, which becomes an **API contract** authority.

## What is specific to Reference Data Service

- **In-memory query engine:** high-performance collection querying (`<10ms`).
- **AWS S3 Persistence & FLOCI:** S3 SDK used exclusively in `src/reference-data/persistence/`.
- **Architecture boundary enforcement:** guardrail verified by `src/architecture-boundaries.test.js`.
- **Multiple test tiers:** unit tests (`npm test`), FLOCI integration tests (`npm run test:floci`), E2E
  lifecycle tests (`npm run test:e2e`).
- **Authoritative contract:** [docs/api-reference.md](../../docs/api-reference.md).
- **SonarCloud quality gate:** enforced per §8 SonarCloud Compliance section in `copilot-instructions.md`.

## `.github` directory structure

```text
.github/
├── copilot-instructions.md          # Primary context file with §3 framework & §8 SonarCloud rules
├── commit-message-generation.instructions.md
├── pull_request_template.md
├── agents/
│   ├── reference-data-orchestrator.agent.md
│   ├── reference-data-planner.agent.md
│   ├── reference-data-developer.agent.md
│   └── reference-data-code-reviewer.agent.md
├── instructions/
│   ├── nodejs-hapi-api.instructions.md     # applyTo: src/**/*.js
│   ├── security.instructions.md            # applyTo: src/**/*.js
│   ├── data-persistence.instructions.md    # applyTo: src/**/*.js
│   └── testing.instructions.md             # applyTo: **/*.test.js
├── prompts/
│   ├── jira-ticket-to-code.prompt.md
│   └── api-endpoint-from-spec.prompt.md
└── skills/
    ├── deep-research-defra-alignment/
    ├── api-endpoint-design/
    ├── unit-tests/
    ├── fetch-jira-workitem/
    └── fetch-confluence-page/
```

Agent names are **service-scoped** (`Reference Data Orchestrator`, `Reference Data Planner`,
`Reference Data Developer`, `Reference Data Code Reviewer`).

## Skills

| Skill                           | User-invocable | Purpose                                                                                                 |
| ------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------- |
| `deep-research-defra-alignment` | No             | The **single** risk-scoped research pass (§3.2) aligned with DEFRA precedence.                          |
| `api-endpoint-design`           | No             | End-to-end guide for reference data query endpoints, mobile/map projections and manifest APIs.          |
| `unit-tests`                    | No             | Testing guide covering unit tests, route tests, FLOCI integration tests, E2E tests and boundary checks. |
| `fetch-jira-workitem`           | Yes            | **Strictly read-only** Jira fetch of a ticket and hierarchy.                                            |
| `fetch-confluence-page`         | Yes            | **Strictly read-only** Confluence fetch of a single page.                                               |

## Universal quality gates

- `npm run lint` and `npm run format:check` pass.
- All unit, boundary, FLOCI and E2E tests pass (`npm test`, `npm run test:floci`, `npm run test:e2e`).
- Boundary guardrails verified (`src/architecture-boundaries.test.js`).
- Tiered coverage targets met (≥90% global, ≥95% core logic, 100% error/security paths) and SonarCloud gate
  green.
- `docs/api-reference.md` updated in the same change for any contract modification.
