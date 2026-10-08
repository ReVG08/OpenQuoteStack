# OpenQuoteStack

The open-source stack for building branded instant quotes and pricing estimators.

Build interactive pricing calculators, self-host them, and keep control of your
customer data.

OpenQuoteStack combines a portable estimator format, a deterministic pricing engine,
and a PostgreSQL-backed application. It is a modular monolith with reusable
TypeScript packages. Basic operation requires no proprietary cloud service.

## Current capabilities

- Visual step/field builder with keyboard and pointer sorting, validation and AND/OR visibility.
- Visual fixed, per-unit, conditional, graduated-tier, percentage and weekday pricing;
  advanced safe formulas, bounds and ranges.
- Exact monetary arithmetic with ordered, itemized explanations.
- Editable drafts, immutable revisions, explicit publishing and rollback.
- Branded, mobile-friendly public calculators with progress and configurable contact capture.
- Estimates, statuses, internal notes, lightweight leads and first-party conversion reports.
- Logo/favicon uploads, live branding preview and branded estimate PDFs.
- Moving, residential cleaning and agency templates; validated `.oqs.json` import/export.
- English and Brazilian Portuguese core UI; light, dark and system admin themes.
- Email/password accounts, database sessions, organization memberships and tenant isolation.
- PostgreSQL migrations and Docker persistence for data and brand images.

The REST API, network SDK, embedding, webhook delivery, custom domains and team
administration are planned. The public demo is a browser-only playground;
published organization calculators save estimates on the server. Mapping and
customer file uploads are not included.

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

The [moving](templates/moving-company.oqs.json),
[cleaning](templates/residential-cleaning.oqs.json) and
[agency](templates/web-design-agency.oqs.json) templates are portable examples.
Review example prices, terms and measurement units before publishing. Selecting an
organization currency adapts minor units without performing exchange conversion. See package documentation for [Schema](packages/schema/README.md),
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
a template, customize fields and pricing, then publish. The builder provides a
public customer link; completed calculations appear under Estimates. Branding can
be configured before publishing or later. If another application
uses port 3000, use `pnpm --filter @openquotestack/web dev --port 3001` after
`pnpm db:generate` and building the engine/core packages, and set `BETTER_AUTH_URL=http://localhost:3001` before startup.
Restart after changing authentication environment variables.

Optional seeding uses an existing registered account. Set `SEED_OWNER_EMAIL` in
`.env`, then run `SEED_DEMO=1 pnpm db:seed`. This adds a separate fictional
Acme Moving workspace, three calculators and sample activity; it preserves existing
seeded workspaces. No default account or password is installed.

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

Compose persists PostgreSQL and normalized brand images, applies migrations in a one-shot
service, then starts the application. Ports bind to loopback by default. The web
container runs as a non-root user. Read the [deployment guide](docs/deployment/docker.md)
before exposing an installation publicly, configuring TLS or upgrading a database.

## Product guide

See [authoring and customer workflow](docs/concepts/product-workflow.md) for drafts,
publication, contact settings, import/export, analytics and PDF behavior.

## Contributing and roadmap

See [CONTRIBUTING.md](CONTRIBUTING.md), [ROADMAP.md](ROADMAP.md),
[CHANGELOG.md](CHANGELOG.md) and [SECURITY.md](SECURITY.md).

## License

[GNU Affero General Public License v3.0 only](LICENSE), SPDX `AGPL-3.0-only`.
Commercial use and white labeling are permitted under the license. Modified
network-served versions carry corresponding-source obligations. Public package
code uses the same license; assess compatibility before embedding it into a
proprietary application. See [ADR-0011](docs/adr/0011-open-source-license.md).
