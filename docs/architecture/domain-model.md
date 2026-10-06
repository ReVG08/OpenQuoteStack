# Domain model

| Entity            | Relationships and lifecycle                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------- |
| User              | Global identity. Authentication owns accounts and sessions.                                  |
| Organization      | Tenant identity, name, slug, locale, timezone, currency and branding.                        |
| Membership        | Links one user to one organization with an explicit role. The pair is unique.                |
| Estimator         | Persistent identity owned by an organization; draft, published or archived.                  |
| EstimatorRevision | Immutable portable definition, sequential number, content hash and creator.                  |
| Estimate          | Retained answers and calculation result tied to a revision; completed, accepted or declined. |
| Lead              | Tenant-owned contact linked to an estimate. Database foundation only.                        |
| AuditEntry        | Tenant-owned actor/action/resource record committed with service writes.                     |

Organization creation assigns its creator the owner role in the same transaction.
Owners and admins can manage estimator definitions and publication. Sales members
can read estimators and create/read estimates. Viewers have read access. Unknown
roles have no permissions. Invitation, membership administration and lead-management
UI are not implemented.

## Revisions and publishing

Every revision, including an unpublished candidate, is an immutable snapshot.
Creating an estimator creates revision 1 and leaves it in draft status. Editing
creates the next revision; it does not replace the published configuration.
Publishing selects an existing revision of the same estimator and tenant, and sets
the estimator status to published. Selecting an older revision is rollback.
Publishing an archived estimator reactivates it.

Archiving stops new saved estimates and revision creation. Existing estimates and
snapshots remain readable. PostgreSQL triggers reject revision updates/deletes and
changes to calculation snapshots. Estimate status is mutable; answer/result,
revision, ownership and creation timestamp are immutable.

The published state belongs to the estimator's pointer, not to a mutable snapshot
status. There is no redundant PublishedRevision table. Candidate revisions can be
listed without pretending that all of them are the active published revision.

A canonical sorted-key SHA-256 hash records definition content. It detects content
identity, not authenticity. Revision numbers are assigned in transactions; writes
to the estimator serialize concurrent revision creation, and serialization conflicts
are retried with a bounded retry count.

Historical estimates retain their complete result and engine version. Replaying an
old result against a newer engine can change semantics; archive the matching release
when exact replay is required. Displaying the retained result never recalculates it.

## Future boundaries

API keys should store hashes and tenant-scoped capabilities. Webhook endpoints
should belong to organizations, with separate signing secrets and durable delivery
attempts. Neither concept currently has a database table, API or UI. Branding is
stored as validated JSON alongside the tenant, rather than a separate one-to-one
table. Leads and audit entries already have explicit organization ownership.
