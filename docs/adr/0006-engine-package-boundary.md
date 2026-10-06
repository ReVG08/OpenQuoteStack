# ADR-0006: Keep the engine independent

Status: Accepted
Date: 2026-10-06

## Context

Pricing needs to run on the server, in a browser preview and in external applications.

## Decision

Expose functional calculateEstimate, validateAnswers, evaluateCondition and parseFormula APIs. Depend only on the schema package. Keep formatting, sessions, storage and transport outside the engine.

## Alternatives considered

Application-bound calculations prevent reuse. A stateful pricing service introduces I/O and clock concerns for calculations that only require a definition and answers.

## Consequences

Callers supply all inputs, including calendar dates. The application recalculates saved estimates server-side. Browser previews are untrusted. Results contain traces and version metadata.
