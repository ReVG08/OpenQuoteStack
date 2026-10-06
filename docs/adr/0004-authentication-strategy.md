# ADR-0004: Use Better Auth database sessions

Status: Accepted
Date: 2026-10-06

## Context

Registration, credentials, cookie handling and session revocation should use a maintained authentication library.

## Decision

Use Better Auth with the Prisma adapter and email/password login. Keep memberships and permission policy in the domain boundary. Enable origin/CSRF checks explicitly and disable cookie session caching.

## Alternatives considered

Handwritten authentication increases password and session risk. A proprietary hosted identity service would make basic self-hosting dependent on outside infrastructure.

## Consequences

Sessions are revocable against PostgreSQL. HTTPS origins use Secure cookies. Registration is open; verification, recovery mail, invitations and shared rate limiting remain separate work.
