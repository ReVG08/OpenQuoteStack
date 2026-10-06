# ADR-0001: Use a modular TypeScript monorepo

Status: Accepted
Date: 2026-10-06

## Context

The platform needs an application and portable packages with independent consumers.

## Decision

Use pnpm workspaces with Turborepo for dependency-aware builds. Start with one Next.js application and server-side service boundary.

## Alternatives considered

Separate repositories complicate coordinated schema changes. Microservices add deployment and transaction boundaries before independent scaling is needed.

## Consequences

Public packages build to ESM and declarations. Database and UI packages stay private. Package dependencies document boundaries; one deployment remains sufficient.
