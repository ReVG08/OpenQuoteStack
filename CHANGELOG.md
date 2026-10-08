# Changelog

## 0.2.0-alpha.1

First public preview. This version is prepared locally; no external release or
package publication is implied.

### Added

- Portable version-1 estimator documents and runtime validation.
- Deterministic pricing with exact arithmetic, conditions, graduated tiers,
  percentages, bounds, ranges and safe arithmetic formulas.
- Itemized explanations and effective-answer metadata.
- PostgreSQL migrations, organization memberships and tenant-scoped services.
- Immutable estimator revisions, publishing, rollback and retained estimates.
- Email/password authentication and database-backed sessions.
- Visual multi-step authoring, field sorting, visibility and pricing editors.
- Optimistic editable drafts, explicit publication and historical revision rollback.
- Revision-pinned public calculators, progress and configurable contact capture.
- Estimate statuses, internal activity, lead follow-up and first-party analytics.
- Normalized brand assets, live theme preview and branded PDF downloads.
- Moving, residential cleaning and agency templates with OQS import/export.
- English and Brazilian Portuguese core product copy and light/dark/system themes.
- Scoped REST API v1, hashed API keys and a typed server-side SDK.
- Transactional API idempotency, compact cursor-paginated resource lists and request IDs.
- Signed webhooks, delivery records, manual retries and a PostgreSQL-backed worker.
- Configurable branded SMTP notifications, confirmations and estimate sending.
- Organization embed allowlists, automatic iframe sizing and verified custom domains.
- Local/S3-compatible asset adapters, audit view and authenticated system status.
- Production-only migration/worker images, persistence and health checks.
- Deployment, backup/restore, integration examples and contributor documentation.

### Changed

- Hidden authored values cannot be overridden by customer answers.
- Template currency selection preserves example major-unit prices across exponents.
- Pricing displays retain declared calculation order, including adjustments and bounds.
- Brand images persist separately from the Docker application image.
- Renaming choice keys preserves defaults and pricing conditions.

### Security

- Shared PostgreSQL rate limits for authentication, public mutations and API traffic.
- Public-address DNS validation, connection pinning and timeouts for webhooks.
- Timestamped HMAC signatures and authenticated encryption for signing secrets.
- Optional registration closure and tenant-scoped integration administration.

### Limitations

- Account verification/recovery, invitations and membership administration are not shipped.
- Customer-data erasure/retention workflows and database privilege separation remain planned.
- Hosting-panel recipes and broad S3-provider compatibility need additional deployment testing.
- This alpha makes no zero-downtime upgrade or independent security certification claim.
