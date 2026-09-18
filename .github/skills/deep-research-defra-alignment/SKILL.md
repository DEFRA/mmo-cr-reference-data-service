---
name: deep-research-defra-alignment
description: 'Do thorough, risk-scoped internet research in the open and align findings to the DEFRA standards precedence (DEFRA > GDS > community) for the MMO Catch Recording Reference Data Service. Use for the single Research (§3.2) pass of the working framework — validating APIs, patterns, security, API contract, projection models and S3/caching questions against DEFRA/GDS and framework guidance, and citing sources before a plan is approved or implemented. There is no separate validation-research round; the plan is checked against these same cited sources.'
argument-hint: "e.g. 'validate in-memory query engine prefix indexing' or 'research S3 manifest etag polling strategy'"
user-invocable: false
---

# Deep research & DEFRA alignment

Turn an open question or a flagged plan step into a **sourced, DEFRA-aligned recommendation**. This is the
**single Research (§3.2)** pass of the working framework in
[copilot-instructions.md](../../copilot-instructions.md) §3 — it does **not** replace or fork that
framework, and it never authorises implementation (that still needs user **approval** at §3.5). Run it
**once**, scoped to risk; there is no separate validation-research round.

**Division of labour:**

- **Whoever plans** identifies risky or version-sensitive steps.
- **The planner performs this single research pass** to validate those steps before returning the plan: the
  **Reference Data Planner** for Complex work, or the **Reference Data Developer** for Standard work.

## Scope the research to the risk

Match effort to consequence: **authentication validation**, **boundary validation & upload security**,
**architecture boundaries**, **S3 persistence and atomic replacement**, **in-memory caching and query
performance**, **the published API contract and projections**, **PII and logging**, or a
**version-sensitive API** (Node ≥ 24, Hapi 21, AWS SDK v3, Joi 18).

## Standards precedence

1. **DEFRA Software Development Standards** — https://defra.github.io/software-development-standards/
2. **DEFRA Digital Service Manual** — https://digital.defra.gov.uk/service-manual
3. **GOV.UK Service Standard & Service Manual (GDS)** — https://www.gov.uk/service-manual
4. **DEFRA technology standards** (Node.js, JavaScript, logging, security, QA/testing)
5. **Community best practice** (OWASP API Security Top 10, Hapi, AWS S3, Joi)

## Output format

Return a short brief the parent agent can drop into a plan:

- **Question** — the decision being researched and the constraint it touches.
- **Findings** — key facts, each with a source (title + URL).
- **Recommendation** — chosen approach and why, with DEFRA-precedence justification.
- **DEFRA alignment** — checklist result, noting any governance exception.
- **Risks & alternative** — residual risks and fallback.
- **Sources** — list of cited URLs.

## References

- [copilot-instructions.md](../../copilot-instructions.md)
- Instructions: [Security](../../instructions/security.instructions.md) · [Node/Hapi API](../../instructions/nodejs-hapi-api.instructions.md) · [Data persistence](../../instructions/data-persistence.instructions.md)
- [docs/api-reference.md](../../../docs/api-reference.md)
