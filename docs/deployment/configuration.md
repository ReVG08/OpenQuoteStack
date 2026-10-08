# Configuration

Use `.env.example` as the configuration inventory. The web process and worker must
share database, encryption, SMTP and storage settings. Restart them after changes.
Environment files and secret values must not enter source control or application logs.

| Setting                                             | Purpose                                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                                      | PostgreSQL connection for local CLI/application execution; Compose overrides the host internally |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Compose database bootstrap; changing these does not rename an existing database                  |
| `BETTER_AUTH_URL`                                   | Canonical browser origin; HTTPS outside loopback                                                 |
| `BETTER_AUTH_SECRET`                                | At least 32 random characters for authentication                                                 |
| `OQS_ENCRYPTION_KEY`                                | Exactly 64 random hex characters; encrypts webhook signing secrets                               |
| `OQS_DISABLE_REGISTRATION`                          | `true` closes new account registration                                                           |
| `OQS_STORAGE_DRIVER`, `OQS_ASSET_DIR`               | Local filesystem storage by default; use an absolute path outside Compose                        |
| `S3_*`                                              | Optional S3-compatible storage; [adapter configuration](../platform/storage-and-email.md)        |
| `SMTP_*`                                            | Optional outbound SMTP; [delivery configuration](../platform/storage-and-email.md)               |
| `OQS_WEB_PORT`, `OQS_DB_PORT`                       | Loopback Compose host ports                                                                      |
| `SEED_DEMO`, `SEED_OWNER_EMAIL`                     | Explicit fictional development data for an existing account                                      |
| `OQS_VERSION`, `OQS_BUILD_ID`                       | Optional runtime status labels; image builds set the release version and accept `OQS_BUILD_ID`   |

Generate independent secrets with a cryptographic random generator. `pnpm setup:env`
creates them locally and never overwrites `.env`. Preserve `OQS_ENCRYPTION_KEY` in
backups; losing it makes stored webhook signing secrets unreadable. Key rotation
currently requires recreating webhook endpoints; no automated re-encryption exists.

Organization locale, timezone, currency, branding, notifications, embed allowlists
and custom domains are database configuration, managed under Settings. API keys
and webhook signing secrets are shown once. The API accepts keys only at the
canonical application origin; custom domains serve customer calculators.

No hidden application telemetry or third-party analytics is enabled. Builds disable
Next.js and Turborepo telemetry. Infrastructure providers may have their own logs.

Migration images set `OQS_TEMPLATE_DIR=/app/templates` for fictional seeding. Local
seed execution resolves bundled templates relative to the repository by default.
