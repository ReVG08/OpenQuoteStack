# ADR-0005: Retain immutable configuration snapshots

Status: Accepted; editing behavior superseded by [ADR-0012](0012-editable-drafts.md)
Date: 2026-10-06

## Context

Pricing changes must not rewrite historical quotes or make their explanations dependent on current configuration.

## Decision

Use persistent Estimator identity, append-only EstimatorRevision snapshots and a publishedRevisionId pointer. Store effective answers, result, engine version and revision on every saved Estimate. Enforce immutability with database triggers.

## Alternatives considered

Overwriting one configuration loses history. Duplicating a full estimator for every publication obscures identity. A separate publication table is unnecessary for one active revision per estimator.

## Consequences

Editing creates a revision. Publishing an older revision is rollback. Archiving stops new calculations while retaining history. Retention and erasure require an explicit future lifecycle design.
