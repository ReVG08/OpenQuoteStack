# @openquotestack/engine

Deterministic TypeScript calculations without React, database, authentication,
HTTP, browser APIs, clock or locale dependencies.

```ts
import { parseEstimator } from "@openquotestack/schema";
import { calculateEstimate, parseFormula } from "@openquotestack/engine";
const result = calculateEstimate(parseEstimator(document), answers);
const expression = parseFormula("bedrooms * 8000 + distance * 210");
```

`calculateEstimate` revalidates the definition and visible answers, then returns
currency/exponent, subtotal, line items, adjustments, total, optional range,
applied rules, conditional messages/CTA and reproducibility metadata.
`AnswerValidationError.issues` identifies invalid fields. Arithmetic and definition
errors fail rather than returning a misleading partial quote.

`evaluateCondition` exposes the same condition semantics used by the engine.
`parseFormula` converts a controlled arithmetic expression to a portable AST.
There are no callable functions or executable code in the formula language.

All prices are integer minor units. Each rule rounds once, half away from zero,
using exact rational intermediates. Format prices outside the package. See
[pricing semantics](https://github.com/ReVG08/OpenQuoteStack/blob/main/docs/concepts/pricing.md) for rule order, percentage
bases, graduated tiers, visibility, calendar dates and bounds.

License: AGPL-3.0-only.

This package is ESM with generated TypeScript declarations. Node.js 20+ is supported;
repository verification uses Node.js 24. External package publication is separate.
