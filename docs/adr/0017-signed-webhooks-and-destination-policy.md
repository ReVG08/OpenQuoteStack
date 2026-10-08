# ADR-0017: Sign webhook bodies and pin verified destination addresses

Status: Accepted
Date: 2026-10-08

## Context

Tenant-configured destinations can expose server networks through SSRF. Consumers
also need to distinguish authentic deliveries from forged or replayed requests.

## Decision

Allow public DNS hostnames over HTTPS on port 443. Reject credentials, fragments,
private/reserved addresses and mixed public/private DNS results. Re-resolve each
attempt and pin an approved address to the TLS connection while retaining hostname
certificate verification. Do not follow redirects. Bound DNS and delivery time.

Sign the timestamp and raw JSON body with HMAC-SHA256. Encrypt signing secrets
with AES-256-GCM using an installation key kept outside the database.

## Alternatives considered

URL-only validation misses DNS rebinding. Following redirects introduces another
unverified destination. Hashed signing secrets cannot generate outgoing HMACs.

## Consequences

Private webhook receivers need a public, TLS-terminated ingress. Consumers verify
raw bytes, enforce a timestamp tolerance and persist event IDs for deduplication.
Backups must preserve the encryption key; changing it requires recreating endpoints.
