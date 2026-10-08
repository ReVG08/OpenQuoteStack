# ADR-0019: Support filesystem and S3-compatible brand asset storage

Status: Accepted
Date: 2026-10-08

## Context

Local volumes suit a single-server installation. Deployments with separate web
hosts need shared assets without introducing provider details into branding or PDFs.

## Decision

Extend ADR-0014 with a small put/get/remove interface. Keep the filesystem default
and add S3-compatible storage selected through installation configuration. Preserve
organization-scoped generated keys and serve public assets through the application.
Both adapters enforce the same size and key limits.

## Alternatives considered

Filesystem-only storage requires shared mounts on multiple hosts. Provider URLs
in estimator data couple portable definitions to an installation's infrastructure.

## Consequences

Web and worker must use identical storage configuration. Operators supply bucket
permissions, TLS and credentials. Backups include assets as well as PostgreSQL;
changing drivers does not automatically migrate existing objects.
