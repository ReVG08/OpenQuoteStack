# Security model

Authentication uses Better Auth's email/password and database-session support.
Passwords use the library's password hashing. Session cookies are HttpOnly and
SameSite=Lax, and Secure when the configured origin is HTTPS. Cookie session caching
is disabled so revocation is checked against the database. Authentication endpoints
keep origin and CSRF checks enabled, including in integration tests.

Server actions derive actors from verified sessions. Organizations and resource IDs
submitted by a browser do not grant access. Services recheck membership, role and
organization ownership inside transactions. Composite foreign keys reject
cross-tenant relations even when database calls bypass services. Database clients
and services are server-only application boundaries, not browser APIs. Direct
operator access to PostgreSQL remains privileged and is outside tenant authorization.

The engine has no executable definitions. Formulas accept an arithmetic AST,
numeric answer variables and declared constants. Validation rejects unknown constructs,
invalid references, reserved identifiers, cycles and excessive definition depth/size.
Hidden fields use authored defaults; customers cannot override them. Saved quotes are recalculated server-side;
a preview result submitted by a browser is never trusted.

Secrets stay in ignored environment files or the deployment environment. Do not
log credentials, session tokens, customer answers or full authentication requests.
The application returns generic operation errors and a minimal health response.
Auth library and framework server-action argument logging are disabled; operators should add sanitized operational metrics
rather than request dumps. Audit entries contain actor/action/resource identifiers,
not answer contents.

HTTP responses include no-sniff, frame-denial, referrer and browser-permission headers.
A nonce-based Content Security Policy and deployment-specific HSTS policy are not
configured. TLS termination, backups, OS patches and database roles are deployment
responsibilities. The Compose database user is an installation operator account;
separate migration and restricted application credentials are a future hardening task.

## Current limits

Registration is open. Account verification, reset-email delivery, MFA, invitations
and membership administration are not configured. Do not treat this application as
a complete public account-management system. Rate limits live in process memory
and are not shared across replicas. Events are not a durable delivery mechanism.
Lead retention/export/deletion workflows still need a deliberate privacy design;
snapshot deletion is intentionally blocked today and requires an explicit retention
migration before supporting data erasure.

Tenant isolation tests protect the supported service boundary. Additional entry
points must use the same authorization boundary and add manipulated-ID tests.

## Dependency patches

Workspace overrides pin patched `deepmerge-ts` and `mysql2` versions under Prisma.
They address [recursive merge exhaustion](https://github.com/advisories/GHSA-ggr8-5vv4-36mx),
[MySQL authentication downgrade](https://github.com/advisories/GHSA-3f6p-5ww8-9rcr)
and [MySQL decompression limits](https://github.com/advisories/GHSA-rgwj-5xj2-c3m3).
OpenQuoteStack uses PostgreSQL; MySQL2 is a transitive CLI dependency. Remove these
overrides when upstream constraints resolve patched versions without them, and rerun
Prisma configuration, migrations, authentication tests and application builds.

## Public calculations and brand assets

Public sessions use random, revision-pinned capabilities with a 24-hour lifetime.
The server validates answers and calculates totals; repeat submissions are idempotent.
Session capabilities grant no tenant reads. Views and progress do not store IP
addresses or user agents. Public mutations have bounded in-process rate limits;
a reverse proxy or shared limiter is needed for sustained abuse protection.

Administrator image uploads require a matching origin and tenant permissions.
PNG/JPEG/WebP uploads are limited to 2 MB and 20 million pixels, normalized to WebP
and stripped of metadata. SVG and customer uploads are unsupported. Brand images
are public. Paths are tenant-scoped and validated before filesystem access; PDF
logos are read locally without remote fetching. Build tracing excludes private
environment files, local data and Git internals.
