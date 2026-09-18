# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records (ADRs) for the MMO Catch Recording Reference Data
Service, following DEFRA software development standards.

## When to write an ADR

Per the working framework in `.github/copilot-instructions.md` §3 step 6, author an ADR **before**
implementing any change that establishes or alters architecture:

- A new routing, controller or query-engine pattern
- A persistence, S3 storage, in-memory caching or hydration lifecycle change
- A change to architectural boundaries (e.g. S3 SDK or auth client access rules)
- A change to published API contract versioning, projection models or error-handling architecture

## Structure

Copy [template.md](./template.md) to `NNNN-short-title.md` (e.g. `0001-in-memory-data-store-and-s3-persistence.md`),
using the next sequential number.
