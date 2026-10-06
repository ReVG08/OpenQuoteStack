# Development and verification

Run targeted tests during changes:

```sh
pnpm exec turbo build --filter=@openquotestack/engine
pnpm exec vitest run packages/engine
pnpm exec vitest run packages/schema
pnpm test:database
```

`pnpm test` builds portable packages, then runs engine, schema, permission and event
behavior tests. `pnpm typecheck` generates the Prisma client and checks workspace
code. Tests cover pricing rules, decimal rounding, validation, conditions, hidden
answers, malformed formulas, explainability and deterministic output.

`pnpm test:database` starts a real PostgreSQL binary on a temporary loopback port,
creates `oqs_test`, applies migrations, runs database/auth tests, and stops/removes
the disposable cluster. It uses the development-only `embedded-postgres` package.
The wrapper's package version is marked beta; the PostgreSQL binary is 18.4. Use
Docker or a managed PostgreSQL installation for production, not this helper.

`pnpm test:integration` uses `DATABASE_TEST_URL` directly and requires a database
name ending in `_test`. The fixtures truncate tables, including authentication
tables. Use a separate database with no retained data. Do not pass production
credentials into this command. Tests execute files sequentially to avoid shared
fixture interference.

Integration coverage includes tenant-ID/resource-ID manipulation, read/write
permissions, composite ownership constraints, snapshot immutability, publishing,
rollback, archiving, after-commit events, registration, login/logout, password hashing,
CSRF origin rejection and HTTPS cookie attributes.

GitHub Actions runs formatting, lint, types, behavior tests, integration tests and
build against a PostgreSQL service. These are repository checks; they do not certify
an installation's TLS, backups, proxy settings or production readiness.

The browser verification tool is a development dependency. Install its browser with
`pnpm exec agent-browser install`. Check authentication, organization creation,
publication and server-backed estimate saving when modifying app flows. Screenshots,
browser state and local databases belong under ignored `.local/`, not source control.

ESLint 9 is pinned for compatibility with the current Next.js React/accessibility
plugins. Move to ESLint 10 when those plugins support its removed context APIs.
