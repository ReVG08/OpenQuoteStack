# ADR-0009: Version portable documents explicitly

Status: Accepted
Date: 2026-10-06

## Context

Files will be shared between releases and third-party tools. Silent reinterpretation can change prices.

## Decision

Require schemaVersion "1" on .oqs.json documents. Reject unsupported versions. Export public types and runtime schemas independently from the web application.

## Alternatives considered

Unversioned files cannot distinguish incompatible formats. Automatic best-effort migration risks changing pricing semantics without an inspectable conversion.

## Consequences

Template version and schema version have different purposes. Future migrations must be explicit, validated transformations. Semantic engine changes also need release/version discipline; schema version alone is insufficient.

Version 1 can gain optional authoring features without changing existing definitions.
New field types and properties require a reader release that supports them; older
strict readers reject those files. Schema version does not imply forward compatibility
between every package release. Import validates the entire document rather than
dropping unknown properties. A format change that reinterprets existing data needs
a new schema version and an explicit migration.
