# ADR-0002: Use PostgreSQL with Prisma

Status: Accepted
Date: 2026-10-06

## Context

Tenant-owned pricing snapshots require transactional writes, relational constraints and typed application access.

## Decision

Use PostgreSQL 18 and stable Prisma 7 with the node-postgres adapter. Keep the schema, migration history, client factory and services in the database package.

## Alternatives considered

A document store makes cross-resource ownership constraints harder to express. Raw SQL alone requires more handwritten mapping; Drizzle is a viable alternative with a different schema workflow.

## Consequences

Prisma generates types locally. Migrations include PostgreSQL-specific triggers and composite foreign keys. Business logic lives in explicit services, not ORM hooks. Operator access is privileged.
