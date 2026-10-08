# Backups, restoration and upgrades

A complete backup includes PostgreSQL, local assets or the S3 bucket, configuration
and `OQS_ENCRYPTION_KEY`. Protect backups as customer data and credentials. Encryption
secrets must remain recoverable without placing them in public archives.

## Backup

Take backups before upgrades. For a consistent database/assets snapshot, temporarily
stop web and worker writes. Store backups outside the Docker volumes and replicate
them to a separate system. The examples use a private local directory.

```sh
mkdir -p backups
chmod 700 backups
docker compose stop web worker
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > backups/database.dump
docker compose run --rm -T --no-deps --user root --entrypoint tar web -C /app/data/assets -czf - . > backups/assets.tar.gz
docker compose start web worker
chmod 600 backups/*
```

Confirm both commands succeeded before treating the files as a backup. Back up `.env`
through a restricted secret store, preserving database credentials and the encryption
key. S3 deployments use provider versioning/export or a separate bucket backup; the
local archive command is not a substitute. Audit/event/job data are in PostgreSQL.

## Restore to a separate installation

Test restoration away from the original installation. Match the application release
and PostgreSQL major version. Configure the restored credentials/encryption key,
create empty volumes and start only PostgreSQL. Import the archive, then restore
assets before starting web and worker.

```sh
docker compose up -d db
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --exit-on-error' < backups/database.dump
docker compose run --rm -T --no-deps --user root --entrypoint sh web -c 'tar -xzf - -C /app/data/assets && chown -R node:node /app/data/assets' < backups/assets.tar.gz
docker compose up -d
```

The database must be empty; restoring over retained data is not a supported merge.
Imported jobs may retry messages or webhooks, so restore in an isolated environment
and disable integration destinations until ready. Verify accounts, branding, old
estimate revisions, PDFs and webhook secret decryption before switching traffic.

## Upgrade

Read the changelog and migrations, take a tested backup, then update the checkout.
Pin a release or commit rather than following an unreviewed branch. Rebuild and
recreate services so the one-shot migration runs again:

```sh
docker compose up -d --build --force-recreate
docker compose ps
docker compose logs --tail=100 migrate web worker
curl --fail http://localhost:3000/health
```

Migrations are forward-only. Reverting application binaries does not reverse schema
changes; restoring a database backup may be necessary. Estimator revision rollback
is a separate product operation and does not roll back software or data migrations.
No zero-downtime upgrade guarantee is made for this alpha release. PostgreSQL
major-version upgrades need their own dump/restore or `pg_upgrade` plan.
