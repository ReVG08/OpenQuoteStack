# ADR-0014: Store normalized brand images on the local filesystem

Status: Accepted
Date: 2026-10-07

## Context

Self-hosted installations need persistent logos and browser icons without depending
on a cloud storage provider. Image processing and PDF generation must not fetch
arbitrary server-side URLs.

## Decision

Accept administrator uploads of PNG, JPEG and WebP, up to 2 MB and 20 million input
pixels. Decode, resize, remove metadata and encode a single WebP image. Store it
under an unguessable filename in an organization-specific filesystem directory.
Branding accepts only these local asset paths; PDFs read assets belonging to the
estimate's organization. Docker persists assets in a separate volume.

## Alternatives considered

External object storage is useful for multi-instance deployments but adds setup
for ordinary installations. Arbitrary remote logo URLs introduce server-side fetch
risks in PDFs. Embedded base64 images enlarge every organization response.

## Consequences

Brand images are public resources, not private document storage. Backups need both
PostgreSQL and the asset directory. Multiple web instances need a shared filesystem
or a future storage adapter. Uploading customer documents and SVG is unsupported.
