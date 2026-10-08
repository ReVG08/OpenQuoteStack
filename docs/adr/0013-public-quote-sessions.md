# ADR-0013: Pin customer sessions to a published revision

Status: Accepted
Date: 2026-10-07

## Context

Customers may complete a calculator while its owner publishes new prices. The
result must match the questions and pricing they saw. First-party conversion
reporting needs views, starts and step progress without collecting network identity.

## Decision

Issue an unguessable, 24-hour session capability when a customer opens an active
published revision. Store tenant, estimator and revision with the session. Calculate
submissions on the server against that revision. Commit the estimate, session
completion and any supplied lead in one transaction. Repeat submissions return the
same retained estimate. Contact capture after the result uses the same capability.

Record views, first interaction, furthest step and completion. Do not store IP
addresses or user agents in quote analytics. Preview sessions do not write data.

## Alternatives considered

Recalculating against the current publication can change a customer's quote during
completion. Accepting browser totals makes prices manipulable. Third-party trackers
add infrastructure and disclose activity beyond the installation.

## Consequences

New publication does not invalidate an in-progress session; archiving or unpublishing
blocks submissions. Tokens authorize only that session's progress and contact
submission, never tenant reads. Conversion reporting measures sessions rather than
unique people. Shared database limits constrain capability writes. Network-edge abuse controls
and retention policies remain deployment responsibilities.
