# Docker deployment

Docker Compose defines three services: `db`, `migrate` and `web`. PostgreSQL must
pass its readiness check before migrations run. The application starts only after
migration success. The web health check also checks database connectivity.

Copy `.env.example` to `.env`, replace the password and authentication secret, and
keep the PostgreSQL password consistent with `DATABASE_URL` for local CLI access.
Use hex credentials or correctly URL-encode special characters in connection URLs.
Compose constructs its internal database URL using the `db` hostname. The CLI uses
the loopback URL in `.env`.

```sh
docker compose up -d --build
docker compose ps
docker compose logs migrate web
```

PostgreSQL 18 stores persistent data under `/var/lib/postgresql`; Compose mounts a
named volume at that path. `docker compose down` retains data. Removing the volume
is destructive. Back up with PostgreSQL tools and test restoration separately.
Do not change a PostgreSQL major-version image over an existing data directory
without following its upgrade procedure.

The Dockerfile builds workspace packages and a standalone Next.js server. The
runtime target runs as the image's non-root `node` user. The migration target has
Prisma and development tools needed by the CLI; it is a separate one-shot service,
not the web runtime. No secret is baked into the image.

Both database and application ports bind to loopback. To expose an installation,
put an HTTPS reverse proxy in front of the application, set `BETTER_AUTH_URL` to the
exact public HTTPS origin, and forward the original host and protocol consistently.
Keep PostgreSQL private. Authentication rejects public production HTTP origins;
localhost HTTP remains usable for local evaluation. Secure cookies are enabled
for HTTPS origins.

The current auth rate limiter is in-process. Multi-instance hosting requires shared
rate limiting or an edge proxy policy. Registration is open and email verification,
password reset delivery, invitations and SMTP are not configured. Plan those access
and recovery controls before a public deployment. See the
[security model](../security/model.md).

For upgrades, back up first, review migrations and changelog, then rebuild. If the
migration service has already exited, use `docker compose up -d --build --force-recreate`
to recreate services. Rollback of application binaries is distinct from estimator
revision rollback and may require compatible database changes.
