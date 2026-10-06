# OpenQuoteStack

The open-source stack for building branded instant quotes and pricing estimators.

Build interactive pricing calculators, self-host them, and keep control of your
customer data.

OpenQuoteStack combines a portable estimator format, a deterministic pricing engine,
and a PostgreSQL-backed application. It is a modular monolith with reusable
TypeScript packages. Basic operation requires no proprietary cloud service.

## Current capabilities

- Versioned `.oqs.json` documents with runtime validation.
- Fixed, per-unit, conditional, graduated-tier and formula pricing.
- Ordered percentages, minimums, maximums and estimate ranges.
- Exact monetary arithmetic with itemized calculation traces.
- Shared AND/OR conditions for visibility, pricing and output.
- Email/password registration, login, logout and database sessions.
- Organizations, explicit membership permissions and tenant-scoped services.
- Immutable estimator revisions, publishing, rollback and saved estimates.
- Organization branding fields, English and Brazilian Portuguese UI foundations,
  and light/dark themes.
- A moving calculator with manually supplied distance.

The application includes a JSON revision editor and an authenticated calculation
workspace. A visual builder, customer-facing publishing/embedding, REST API,
network SDK, webhook delivery and analytics are planned, not available features.
The public demo is a browser-only engine playground and does not save customer data.

## Architecture

| Location            | Responsibility                                                     |
| ------------------- | ------------------------------------------------------------------ |
| `apps/web`          | Next.js application, authentication integration and server actions |
| `packages/schema`   | Public portable definitions and Zod validation                     |
| `packages/engine`   | Deterministic pricing and explanations                             |
| `packages/sdk`      | Local document-to-quote facade; no HTTP client yet                 |
| `packages/database` | Prisma schema, migrations and tenant-scoped services               |
| `packages/core`     | Permission grants, tenant input validation and internal events     |
| `packages/ui`       | Shared components and theme tokens                                 |
| `packages/config`   | Shared strict TypeScript configuration                             |

Read the [architecture](docs/architecture/overview.md),
[domain model](docs/architecture/domain-model.md),
[pricing semantics](docs/concepts/pricing.md) and [ADRs](docs/adr/README.md).

## Engine and Schema

```ts
import { parseEstimator } from "@openquotestack/schema";
import { calculateEstimate } from "@openquotestack/engine";

const estimator = parseEstimator(document); // { schemaVersion: "1", estimator: ... }
const result = calculateEstimate(estimator, answers);
// result.totalMinor, lineItems, adjustments, range, metadata
```

The engine depends only on the schema package. It has no React, database,
authentication, HTTP, browser, clock or locale dependency. Monetary values are
integer minor units; quantities, formulas and percentages use exact rational
intermediates. Currency formatting belongs to the caller.

The [moving template](templates/moving-company.oqs.json) is a complete portable
example. See package documentation for [Schema](packages/schema/README.md),
[Engine](packages/engine/README.md) and the [local SDK](packages/sdk/README.md).

## Local development

Use Node.js 24, pnpm 10.34.6 and PostgreSQL 18.

```sh
corepack enable
corepack prepare pnpm@10.34.6 --activate
pnpm install --frozen-lockfile
cp .env.example .env
```

Set unique `POSTGRES_PASSWORD` and `BETTER_AUTH_SECRET` values in `.env`. Match the
password in `DATABASE_URL`. A hex password avoids URL-escaping issues. Generate
values with `openssl rand -hex 32`. Do not commit `.env`.

Start PostgreSQL with `docker compose up -d db`, or run `pnpm db:local` in a separate
terminal for the development-only embedded PostgreSQL helper. That helper binds to
IPv4 loopback and retains its cluster under ignored `.local/postgres`.

```sh
pnpm db:migrate
pnpm dev
```

Open `http://localhost:3000`. Register an account, create an organization, add the
moving template, and publish a revision to save estimates. If another application
uses port 3000, use `pnpm --filter @openquotestack/web dev --port 3001` after
`pnpm typecheck`, and set `BETTER_AUTH_URL=http://localhost:3001` before startup.
Restart after changing authentication environment variables.

Optional seeding uses an existing registered account. Set `SEED_OWNER_EMAIL` in
`.env`, then run `pnpm db:seed`. No default account or password is installed.

```sh
pnpm example       # Builds the portable packages and prints an itemized moving quote
pnpm test          # Engine, Schema and permission/event behavior
pnpm test:database # Disposable local PostgreSQL, migrations, tenancy and auth tests
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
```

For an existing disposable database, set `DATABASE_TEST_URL` to a database whose
name ends in `_test`, apply migrations there, then run `pnpm test:integration`.
Integration tests truncate fixture tables. Never point them at retained data.
See [development notes](docs/development/testing.md).

## Docker

```sh
cp .env.example .env
# Configure unique credentials as described above.
docker compose up -d --build
```

Compose starts PostgreSQL with persistent storage, applies migrations in a one-shot
service, then starts the application. Ports bind to loopback by default. The web
container runs as a non-root user. Read the [deployment guide](docs/deployment/docker.md)
before exposing an installation publicly, configuring TLS or upgrading a database.

## Contributing and roadmap

See [CONTRIBUTING.md](CONTRIBUTING.md), [ROADMAP.md](ROADMAP.md),
[CHANGELOG.md](CHANGELOG.md) and [SECURITY.md](SECURITY.md).

## License

[GNU Affero General Public License v3.0 only](LICENSE), SPDX `AGPL-3.0-only`.
Commercial use and white labeling are permitted under the license. Modified
network-served versions carry corresponding-source obligations. Public package
code uses the same license; assess compatibility before embedding it into a
proprietary application. See [ADR-0011](docs/adr/0011-open-source-license.md).
