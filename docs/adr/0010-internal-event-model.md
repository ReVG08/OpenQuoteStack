# ADR-0010: Publish in-process events after commit

Status: Accepted
Date: 2026-10-06

## Context

Analytics and integrations should not be embedded in pricing and persistence handlers.

## Decision

Use a typed in-process EventBus. Services create audit entries within transactions and publish domain events after commit. Subscriber failures do not roll back persisted changes.

## Alternatives considered

A message broker adds infrastructure before durable integrations exist. Calling integrations directly in transactions couples availability and response time to external services.

## Consequences

In-process events are best-effort and may be lost after a crash. Audit history is durable.
External webhook/email delivery uses the transactional outbox and retries described below.

Durable external delivery is defined by [ADR-0016](0016-transactional-outbox-and-postgres-jobs.md).
The in-process bus remains available for best-effort local subscribers.
