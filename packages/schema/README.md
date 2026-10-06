# @openquotestack/schema

Runtime validation and TypeScript types for portable `.oqs.json` documents.

```ts
import { parseDocument, parseEstimator } from "@openquotestack/schema";
const document = parseDocument(input);
const estimator = parseEstimator(input);
```

The document wrapper requires `schemaVersion: "1"` and `estimator`. Optional template
metadata describes category and template version. Estimators include metadata,
currency/exponent, steps, typed fields, validation, visibility conditions, pricing
rules, decimal-string constants and output/CTA settings. Unknown properties fail.

`parseDocument` returns the complete normalized document. `parseEstimator` returns
only its estimator. Both validate JSON data budgets and cross-references. They
throw validation errors; unsupported versions are rejected rather than guessed.
Future migrations will be explicit version-to-version transformations.

Numeric fields are nonnegative quantities. Choice IDs, field IDs and rule IDs are
stable references. Visibility references preceding fields only. Conditions and
formula ASTs are JSON data. Currency exponent is declared by the document author;
confirm it against the intended currency rather than assuming two decimal places.

See the [moving template](../../templates/moving-company.oqs.json) and
[pricing semantics](../../docs/concepts/pricing.md). No web application imports
are needed. License: AGPL-3.0-only.
