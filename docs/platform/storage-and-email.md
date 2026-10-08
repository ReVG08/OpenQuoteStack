# Storage and SMTP

## Brand assets

The default `OQS_STORAGE_DRIVER=local` uses `OQS_ASSET_DIR`. Compose persists
`/app/data/assets` in a named volume. Web and worker must share the same driver,
configuration and asset store.

For S3-compatible storage, set `OQS_STORAGE_DRIVER=s3`, `S3_BUCKET`, `S3_REGION`
and credentials through `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` or the provider's
standard server credential chain. Optional `S3_ENDPOINT` selects MinIO, R2 or
another compatible service. `S3_FORCE_PATH_STYLE=true` suits MinIO;
`S3_PREFIX` defaults to `assets`. Restrict credentials to this bucket/prefix.
The bucket can remain private: the application serves normalized branding assets
through `/assets/:organization/:filename`. These brand images are publicly readable.

Uploads are limited to 2 MB and decoded PNG, JPEG or WebP, with a 20-million-pixel
limit. The server strips metadata, normalizes orientation, bounds dimensions and
writes generated WebP filenames. SVG, animation and customer document uploads are
not supported. Keys include organization ownership and reject traversal. Switching
storage drivers does not copy existing files; migrate the same keys yourself.

## SMTP

Set `SMTP_HOST`, `SMTP_PORT` and `SMTP_FROM`; add `SMTP_USER`/`SMTP_PASSWORD` when
needed. Port 587 uses required STARTTLS. For implicit TLS on port 465 set
`SMTP_SECURE=true`. Certificate verification stays enabled. Only a trusted local
relay or development fixture should use `SMTP_ALLOW_INSECURE=true`.

Owners/admins choose a new-lead notification address, customer confirmations and
an editable plain-text footer in **Settings → Integrations**. Customer
confirmations run only after contact details are supplied. The estimate detail
also offers a rate-limited manual send. Email includes current company branding,
logo URL, contact information, retained line items, range/total and estimator terms.
Logo images are loaded by the recipient's mail client from the installation URL.

The worker handles delivery and bounded retries, with up to 20 messages per
organization per minute. Rate-limited jobs retry within the normal attempt budget. The system page reports whether
SMTP is configured, not whether arbitrary remote credentials are valid. Jobs
record generic SMTP failures; passwords and message bodies are not logged. Email
is optional, and no SMTP service is bundled. Templates do not offer a visual editor
or arbitrary HTML. Authentication password recovery and email verification are not
included in this prerelease.
