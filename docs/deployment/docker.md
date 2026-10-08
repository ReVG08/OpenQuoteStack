# Docker Compose

Compose runs PostgreSQL, a one-shot migration service, the web application and a
background worker. Database readiness precedes migrations; successful migrations
precede web and worker startup. Health checks cover database, web connectivity and
a recent worker heartbeat. PostgreSQL and normalized brand assets use named volumes.

## First installation

```sh
cp .env.example .env
# Replace POSTGRES_PASSWORD, BETTER_AUTH_SECRET and OQS_ENCRYPTION_KEY.
# Match the password in DATABASE_URL. Use 64-character random hex values.
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 migrate web worker
curl --fail http://localhost:3000/health
```

Alternatively, after installing Node.js 24 and dependencies, `pnpm setup:env`
generates a mode-600 environment file with unique credentials. It refuses to
replace an existing file. For HTTPS use `pnpm setup:env --url https://quotes.example.com`.
Never copy example secret values into a public installation.

Register an account at the configured origin. Create an organization, select a
template and publish. Optional fictional seed data needs an existing account:

```sh
docker compose run --rm -e SEED_DEMO=1 -e SEED_OWNER_EMAIL=owner@example.com migrate pnpm seed
```

No default credentials are installed. Disable public registration after setup if
appropriate. SMTP is optional; queue processing is part of the worker. Redis is
not required. See [configuration](configuration.md) and [SMTP/storage](../platform/storage-and-email.md).

## Network and persistence

Web and database host ports bind to loopback. `OQS_WEB_PORT` and `OQS_DB_PORT`
change host ports; container ports remain 3000 and 5432. `BETTER_AUTH_URL` is the
exact browser-facing origin, including a local alternate port. Compose constructs
its database URL with the `db` hostname; CLI access uses the local `DATABASE_URL`.
Hex passwords avoid URL escaping errors.

Use an HTTPS reverse proxy for public access and keep PostgreSQL private. Preserve
the incoming `Host` and protocol. See [Linux/proxies](linux.md) and
[custom domains](../platform/domains.md). TLS, DNS and firewall configuration are
operator responsibilities. Local loopback HTTP is supported for evaluation.

PostgreSQL 18 persists under `/var/lib/postgresql`. `docker compose down` retains
volumes; removing volumes destroys data. Local assets persist under `/app/data/assets`.
Back up both data volumes and the encryption key. S3 installations back up object
storage instead of the local asset volume. Do not switch a database major-version
image over an existing data directory without its documented upgrade process.

## Images and operations

The web image contains the standalone Next.js server. Migration and worker images
use a production-only service dependency bundle, not the development workspace.
All application services run as the non-root `node` user. Build context excludes
environment files, local databases, Git and generated outputs. Secrets enter only
through runtime environment variables.

```sh
docker compose restart web worker
docker compose logs --tail=100 worker
docker compose ps
```

Worker failures retain jobs for bounded retries and expose safe error categories.
A heartbeat confirms worker activity, not delivery success to every integration.
Owners/admins can inspect their organization's failed job count under System and
webhook attempts under Webhooks. SMTP status reports configuration, not a live
provider delivery guarantee.

Read [backups and upgrades](maintenance.md) before changing images or migrations.
Compose is the reference deployment. Hosting-panel recipes are configuration
examples; they are not independently verified installation certifications.
