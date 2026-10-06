# Contributing

Start with the [README](README.md) and [architecture](docs/architecture/overview.md).
Use Node.js 24 and the pinned pnpm version. Keep changes focused and describe the
behavior they change. Add behavior tests for pricing semantics, validation and
authorization changes.

Public packages must remain independent of the application. Do not introduce
React, network, storage or implicit time dependencies into the engine. Portable
definitions contain declarative data, never executable code. Tenant-owned resources
must have explicit organization ownership and server-side permission checks.

Published snapshots are immutable. Database changes need committed migrations;
review existing data and foreign-key behavior before altering lifecycle constraints.
Record consequential architecture decisions in `docs/adr/` with context, decision,
alternatives and consequences. Update documentation when behavior changes.

Run the affected tests, `pnpm typecheck`, `pnpm lint` and `pnpm format:check`. Run
`pnpm test:database` for auth, tenant or persistence changes. Run `pnpm build` for
application or dependency changes. Do not use retained data for integration tests.

Use clear commits such as `feat(engine): add graduated tiers` or
`fix(auth): reject untrusted origins`. Explain the problem, changed behavior and
validation in pull requests. Never include secrets, customer data or generated
build outputs. Contributions are licensed under AGPL-3.0-only.
