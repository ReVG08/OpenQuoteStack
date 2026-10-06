# ADR-0008: Use a controlled arithmetic AST

Status: Accepted
Date: 2026-10-06

## Context

Portable estimator definitions must support calculations without executing author-supplied code.

## Decision

Store formula AST nodes for decimal literals, numeric variables and + - * /. Provide an infix parser for authoring. Validate references and limit JSON depth and node count before recursive processing.

## Alternatives considered

Executing JavaScript exposes application capabilities. A larger expression language adds functions and coercions without an immediate pricing need. Pure string storage leaves parsing semantics implicit.

## Consequences

There are no calls, property access or implicit casts. Formulas return minor units. Missing variables and division by zero fail. Future operators require explicit schema and compatibility decisions.
