# ADR-0016: Persist integration events and jobs in PostgreSQL

Status: Accepted
Date: 2026-10-08

## Context

An in-process handler can lose an event after a successful database write. Slow
SMTP servers and webhook consumers should not delay quote submissions.

## Decision

Write external event snapshots to an outbox in the same transaction as domain
changes. A separate worker dispatches events into deduplicated PostgreSQL jobs.
Workers claim due jobs with `FOR UPDATE SKIP LOCKED`, expiring leases and bounded
retries. Keep the in-process event bus for best-effort local subscribers.

## Alternatives considered

Direct request-time delivery couples availability to external systems. Redis or a
message broker adds another required service without solving the commit/delivery gap.

## Consequences

Deployment requires a web process, worker and PostgreSQL. Delivery is at least
once: consumers must deduplicate event IDs. A worker crash can cause redelivery;
expired final attempts become visible failures. Historical event payloads retain
customer data and belong in backup and retention planning.
