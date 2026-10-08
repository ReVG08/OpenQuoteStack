# Contributing

Use Node.js 24 and pnpm 10.34.6. Follow [local setup](README.md#local-development)
and [verification](docs/development/testing.md). Development uses PostgreSQL;
`pnpm db:local` is an optional loopback helper. Use fictional data and never point
integration tests at retained or customer databases.

## Boundaries and conventions

`apps/web` owns HTTP, sessions and UI. `packages/database` owns persistence and
transactional permission checks. `packages/core` contains shared permissions,
events and presentation-independent utilities. Public Schema, Engine and SDK
packages can be consumed without the web app. TypeScript is strict; prefer focused
functions and explicit domain types over generic service abstractions.

Tenant resources need organization ownership, server-side permission checks and
manipulated-ID tests. UI permission checks are presentation only. Published
snapshots and retained calculations are immutable. Database changes need committed
migrations and review of existing data, ownership foreign keys and triggers.

Record consequential decisions under `docs/adr/` with context, decision,
alternatives and consequences. Routine refactoring does not need an ADR. Update
product documentation when behavior changes. Comments should explain invariants,
security assumptions or non-obvious semantics rather than narrate code.

## Pricing, schema and fields

The engine must remain independent of React, network, storage, authentication and
implicit clocks/locales. Add behavior tests for rule order, exact rounding, bounds,
visibility and explanations when changing pricing. Update the engine version when
semantics change; historical calculations retain the original version and result.

Schema definitions are JSON data, never executable code. Validate authored defaults,
references and complexity budgets. Strict schema-v1 readers may reject newly added
properties; discuss compatibility and migration needs before changing public shapes.

A field type needs schema validation, engine answer handling, builder controls,
public/preview rendering, keyboard/label/error behavior and both core translations.
Update imports, examples and tests rather than adding a builder-only feature.

See [community template authoring](docs/concepts/templates.md). Run
`pnpm templates:validate` for bundled templates. Core UI translations live in the
application dictionaries and localized panels; templates carry their own authored
translations. Keep locale, timezone, currency and measurement units separate.

## API and integrations

Maintain [REST API v1](docs/api/rest.md) and SDK types together. Public
representations must not expose ORM records, draft secrets or internal notes.
Add scope/tenant tests for new endpoints. API-created calculations require
idempotency and server-side pricing. Webhook payload changes need consumer
compatibility review. Keep event writes transactional and delivery outside request
handlers. Never weaken destination checks to make a fixture convenient.

## Verification and pull requests

Run affected behavior tests while developing. Before proposing a change, run the
relevant typechecks, lint and formatting checks. Use `pnpm test:database` for auth,
tenant, API, job or persistence changes; it creates and removes a disposable
PostgreSQL cluster. Run `pnpm build` for application/dependency changes. Verify
browser interactions, focus and mobile behavior for UI changes. Package changes
also need a tarball/consumer check.

Use clear commits such as `feat(engine): add graduated tiers`. A pull request should
explain the problem, resulting behavior and actual verification. Include screenshots
for meaningful UI changes using fictional data. Report vulnerabilities privately
according to [SECURITY.md](SECURITY.md). Never commit credentials, private browser
state or generated build outputs. Contributions are licensed under AGPL-3.0-only.
