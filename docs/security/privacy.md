# Data and privacy

OpenQuoteStack sends no hidden application telemetry and requires no third-party
analytics. Container builds and runtime disable Next.js/Turborepo telemetry.
Public estimator activity is stored in the installation's PostgreSQL database.

PostgreSQL stores accounts, password hashes, sessions, membership, estimator drafts
and revisions, answers, calculations, customer contacts, activity, audit metadata,
API key hashes, encrypted signing secrets, domain challenges, rate limits and jobs.
Authentication sessions may include IP address/user agent. Public quote sessions
use opaque capabilities and retain progress; they do not store an IP address.
Job/outbox payloads can include contact details and estimate answers.

Brand images live on the filesystem or the configured S3-compatible service.
Brand assets are public; estimates and PDFs require authorized organization access.
Backups must include PostgreSQL, assets and installation secrets, including the
webhook encryption key. Protect all backups as customer data.

External data flows occur only through configured integrations: SMTP receives
recipients and branded estimate messages; webhooks receive subscribed event
payloads; S3-compatible storage receives normalized brand images. Domain checks
and webhook delivery use DNS. Embed messaging contains height only. Mail clients
can request the organization's public logo from the installation.

Operators choose retention and deletion policies. This prerelease does not provide
automated retention, customer erasure/export workflows or a legal compliance
certification. Estimates retain immutable pricing history. Establish a policy for
technical delivery records, audit entries, expired sessions and customer records
appropriate to your deployment and obligations.

Authored image-choice URLs and external CTA links may contact the selected websites
from the customer browser. Template authors should review those destinations; they
are not required analytics or application telemetry.
