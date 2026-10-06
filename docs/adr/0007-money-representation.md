# ADR-0007: Represent money in integer minor units

Status: Accepted
Date: 2026-10-06

## Context

Binary floating-point rounding can change totals; currencies do not share a single decimal exponent.

## Decision

Declare currency code and exponent in each estimator. Represent money as safe integer minor units. Use BigInt rational arithmetic for quantities, percentages and formulas, rounding once per rule half away from zero.

## Alternatives considered

Uncontrolled number arithmetic produces decimal edge cases. An external decimal library is viable, but rational arithmetic covers the limited arithmetic language without adding another runtime dependency.

## Consequences

Serialized results use numbers bounded by Number.MAX_SAFE_INTEGER. Intermediates never appear as BigInt in JSON. Currency formatting belongs to callers. Division by zero and unsafe totals fail.
