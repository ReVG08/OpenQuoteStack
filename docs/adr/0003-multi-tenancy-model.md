# ADR-0003: Use explicit organization ownership

Status: Accepted
Date: 2026-10-06

## Context

A user can belong to multiple businesses, and resource identifiers are not authorization evidence.

## Decision

Store organizationId on tenant-owned tables. Check session-derived actors, current membership, permission and resource ownership in server-only transactions. Use composite ownership foreign keys.

## Alternatives considered

One database per tenant increases operational cost. URL-only scoping cannot prevent manipulated-ID access. Row-level security could add another layer but needs reliable per-transaction identity propagation.

## Consequences

All new resource operations need scoped services and isolation tests. Direct database access is trusted operator access. The current design does not claim PostgreSQL row-level security.
