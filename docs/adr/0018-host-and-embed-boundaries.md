# ADR-0018: Isolate custom hosts and explicitly allow embed origins

Status: Accepted
Date: 2026-10-08

## Context

Custom domains and framing expand the application's trust boundaries. Dashboard
sessions must stay on the installation origin, and an arbitrary Host header must
not select a tenant.

## Decision

Resolve custom hosts only from active, recently verified domain records. Require
public address records and an organization-specific DNS TXT challenge; recheck
ownership in the worker. Preserve the incoming Host at the reverse proxy and
ignore forwarded-host values. Custom hosts serve their own public calculators
and brand assets; authentication and administration stay on the canonical origin.

Dedicated embed routes use CSP `frame-ancestors` with explicit HTTPS origins.
Other application pages deny framing. Resize messages require the expected
origin, frame source, channel and bounded integer height.

## Alternatives considered

Wildcard host resolution allows tenant impersonation. Allowing framing on every
route exposes administration to clickjacking. Unchecked messaging trusts unrelated
windows and can create layout or data-leak problems.

## Consequences

Operators configure DNS, reverse-proxy routes and TLS. A verification older than
24 hours stops serving the domain. Embedders must register origins before use.
The protocol transmits height only, never customer answers or contact data.
