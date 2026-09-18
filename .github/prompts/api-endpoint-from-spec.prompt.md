---
description: 'Build or change a Reference Data API endpoint from docs/api-reference.md, an API contract or acceptance criteria. Captures the query parameters, projection shapes and error envelopes, then runs the §3 working framework via the Reference Data Orchestrator to plan, approve, implement and test routes, controllers, query engines, projections, boundary tests and docs.'
name: 'API endpoint from spec'
argument-hint: 'Describe the reference data endpoint, or paste the contract snippet'
agent: 'Reference Data Orchestrator'
tools: [read, search, todo, agent]
---

Build (or change) an endpoint for the **MMO Catch Recording** Reference Data Service from a supplied API
contract or a written description plus acceptance criteria. This prompt has **one job**: turn the supplied
specification into an unambiguous **contract definition**, then hand it to the **Reference Data
Orchestrator**, which owns the full **working framework** in
[copilot-instructions.md](../copilot-instructions.md) §3 (triage, planning, user-approval gate,
implementation and testing, with an **optional on-request** code review).

As the **Reference Data Orchestrator** you **plan, delegate, verify and report — you do not implement code
or run build/test yourself.** Run the §3 loop exactly as defined by your agent instructions.

## Inputs

- **Endpoint / contract:** ${input:spec:Describe the endpoint, or paste the API contract snippet}
- **Acceptance criteria:** ${input:criteria:Optional — acceptance criteria or projection requirements}
- **Notes / constraints:** ${input:notes:Optional — projection models, boundary constraints}

## Step 1 — capture the contract

| Item               | Value                                                                     |
| ------------------ | ------------------------------------------------------------------------- |
| Path               | `/vessels`, `/gears`, `/ports`, `/species`, `/map-locations`, `/manifest` |
| Method             | `GET`, `POST` (upload/validate), etc.                                     |
| Auth               | Authentication Service verification required?                             |
| `params` schema    | entity identifier / code                                                  |
| `query` schema     | prefix `q`, filters, `limit`, sort                                        |
| Projection model   | standard, mobile (`/mobile`), map (`/map`)                                |
| Failure responses  | 400 (validation), 404 (not found), error envelope                         |
| Architecture check | confirm S3 SDK and auth client isolation rules hold                       |

## Step 2 — triage & execution

Hand off to the **Reference Data Orchestrator** to plan (via **Reference Data Planner** for Complex work),
seek approval, implement (via **Reference Data Developer**), run unit/FLOCI/E2E tests, and update
`docs/api-reference.md`.
