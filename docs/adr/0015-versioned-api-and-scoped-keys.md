# ADR-0015: Version the external API and separate scopes from session roles

Status: Accepted
Date: 2026-10-08

## Context

Server integrations need a stable interface without inheriting dashboard sessions
or gaining unrestricted access to an organization's customer data.

## Decision

Expose resource representations under `/api/v1`. API keys belong to one
organization and carry explicit scopes. Generate 256-bit secrets, display them
once, and retain SHA-256 hashes. Every resource query includes organization
ownership. Estimate creation requires an idempotency key and calculates from a
published revision in a serializable transaction.

## Alternatives considered

Session cookies couple integrations to interactive authentication. Unscoped keys
grant excessive access. Exposing ORM rows would make database changes break clients.

## Consequences

Roles govern key administration; scopes govern API requests. Revocation stops
future authentication. Clients retain idempotency keys when retrying writes.
Versioned representations and SDK types require coordinated compatibility review.
