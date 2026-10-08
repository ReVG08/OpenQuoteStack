# Domain model

| Entity            | Relationships and lifecycle                                                                                |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| User              | Global identity; authentication owns accounts and sessions.                                                |
| Organization      | Tenant identity, name, slug, locale, timezone, currency and validated branding.                            |
| Membership        | Unique user/organization pair with owner, admin, sales or viewer role.                                     |
| Estimator         | Tenant-owned identity, draft definition/version and active revision pointer; draft, published or archived. |
| EstimatorRevision | Immutable portable definition, sequential number, content hash and creator.                                |
| QuoteSession      | Tenant/estimator/revision capability, view time, start, furthest step and optional completed estimate.     |
| Estimate          | Immutable answers/result/engine version/revision, with mutable business status.                            |
| Lead              | Contact details owned by a tenant and linked to one estimate.                                              |
| EstimateActivity  | Tenant-owned status changes and internal notes, optionally attributed to an actor.                         |
| AuditEntry        | Actor/action/resource identifiers committed with service writes.                                           |

Organization creation assigns its creator as owner atomically. Owners/admins manage
branding, definitions and publication. Sales members read calculators and manage
estimates. Viewers have read access. Unknown roles have no grants. Invitation and
membership administration UI are not implemented.

## Revisions and drafts

Creation records revision 1 as an unpublished initial snapshot and initializes the
draft. Draft saves validate the portable definition and compare an optimistic
version. Publishing captures a new snapshot only when content changes, then switches
the live pointer. Published configurations never change on draft save.

Rollback selects an earlier snapshot; it does not rewrite the current draft.
Publishing an archived estimator reactivates it. Unpublishing clears the pointer;
archiving blocks public sessions and draft editing. Deletion requires the exact
name, rejects estimators with estimates and tombstones unused identities. Revision
and calculation deletion remains blocked by PostgreSQL triggers.

Canonical sorted-key SHA-256 hashes record content identity, not authenticity.
Serializable transactions and bounded retries protect concurrent revision numbering.
Composite ownership foreign keys cover revisions, estimates, sessions and leads.

## Estimates and contacts

A 24-hour customer capability pins pricing to the revision opened. A successful
submission creates one retained estimate per session. A required pre-result contact
commits with that estimate; post-result or optional contact can attach later.
Disabled capture never creates a lead. Contacts require name/email, with optional
phone, company, address and notes. Customer access never exposes internal notes.

Statuses are New, Contacted, Qualified, Won, Lost and Archived. Status changes and
internal notes append activity. Leads with the same email are grouped in the UI;
records remain attached to individual estimates. Opportunity totals separate
currencies. This is lightweight follow-up, not a CRM.

Historical display and PDF generation use the retained calculation. Replaying with
a newer engine can change semantics; preserve the matching engine release for exact
reproduction. Retention and erasure need an explicit migration and privacy policy.

## Platform records

API keys belong to one organization and store a SHA-256 hash, visible prefix, scopes,
creation/use times and revocation. API submissions pair a key and request identity
with a retained estimate, preventing duplicate writes during retries.

Outbox events capture stable resource representations in the business transaction.
Webhook endpoints store encrypted signing secrets. Deliveries retain attempt counts,
HTTP status, duration and safe failure categories. Background jobs have due times,
leases and bounded retry counts. Worker heartbeats and rate buckets are technical
installation records; business jobs and event records are organization-owned.

Custom domains have globally unique hostnames, ownership tokens and verification
states. Branding, notification settings and embedding origins remain validated
organization configuration. Public brand assets use generated tenant-scoped keys in
the configured storage adapter. Secrets and customer records are never exported in
portable estimator files.
