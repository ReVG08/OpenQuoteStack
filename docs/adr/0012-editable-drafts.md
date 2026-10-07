# ADR-0012: Separate editable drafts from immutable revisions

Status: Accepted
Date: 2026-10-07

## Context

A visual editor needs to save work without accumulating a published-history snapshot
for every adjustment. Concurrent editors must not silently overwrite each other.

## Decision

Store a validated draft definition and optimistic version on the tenant-owned
Estimator. Saving checks the version. Publishing captures a new immutable revision
in a serializable transaction and changes the publication pointer. Reuse the latest
snapshot when its canonical content hash matches the draft.

This replaces the editing behavior in ADR-0005. Its immutable revision and estimate
snapshot guarantees remain in force. Existing candidate revisions remain available
for rollback and export.

## Alternatives considered

Creating snapshots on every save produces noisy history. Updating a published
revision breaks historical calculations. A separate draft table adds a join for a
single workspace per estimator without improving isolation.

## Consequences

Draft saves cannot affect live pricing. Stale saves return a conflict. Publication
and rollback remain explicit. Empty or invalid intermediate edits stay local until
they satisfy the portable schema. Deleted unused estimators are tombstoned;
retained snapshots are never physically deleted by the application.
