# Pricing semantics

All monetary values are integer minor units. USD uses 2 minor units, JPY uses 0,
and KWD uses 3. The document declares the currency exponent explicitly; the engine
neither guesses it nor formats currency strings.

Rules execute in array order. Fixed, per-unit, tiered and formula rules contribute
to the subtotal. Percentage adjustments choose either the subtotal accumulated so
far or the running total including previous adjustments. Place percentages after
the charges they should modify. Each rule rounds once, half away from zero, using
exact rational intermediates. Totals must stay nonnegative and within JavaScript's
safe integer range. Formula charges may be negative, subject to those bounds.

Tiers are graduated, with exclusive lower and inclusive upper cumulative bounds.
For 51 miles at 200 minor units through 10, 160 through 50 and 130 thereafter:
`10 × 200 + 40 × 160 + 1 × 130 = 8530`. The final tier must be open-ended.

Minimum and maximum apply after all rules. Their differences appear as adjustments.
Ranges are computed from the final bounded total; they are uncertainty bands and
can extend beyond those bounds. Ranges do not affect the quoted total.

Date-weekday rules use the supplied `YYYY-MM-DD` business calendar date. Sunday is
0 and Saturday is 6. There is no system clock or implicit timezone in calculations.

## Answers and conditions

Numbers must be finite, nonnegative numeric answers; there is no string coercion.
Integer validation is available for counts. Required booleans accept `false`.
Choice identifiers must exist; multiselect answers cannot contain duplicates.
Unknown answer keys are rejected. Missing optional quantities do not produce a
charge. A missing formula variable produces an error rather than silently using 0.

Visibility is evaluated in field order and can reference only preceding fields.
Hidden fields are excluded from validation, pricing and the persisted effective
answer set, even if the caller submits a value. Formula rules using optional or
hidden fields should have a matching condition.

Conditions use `all` for AND and `any` for OR. Equality is type-strict; array equality
is order-sensitive. `contains` checks a substring or array membership. `selected`
checks membership or scalar equality. Missing values satisfy `empty`; other
operators return false for missing values. An empty string or array is empty;
`false` and 0 are not. The same conditions control fields, rules, messages and CTAs.

## Formulas

The portable format contains an arithmetic AST:

```json
{ "op": "*", "left": { "variable": "bedrooms" }, "right": { "value": "8000" } }
```

`parseFormula("bedrooms * 8000")` creates this structure. The parser accepts decimal
literals, identifiers, parentheses, unary minus, and `+ - * /`. Multiplication and
division take precedence. Operations of equal precedence associate left to right.
There are no calls, property access, assignments, executable code or implicit casts.
Variables resolve to numeric answers or declared decimal-string constants.
Formula results represent minor units, not major currency units. Unknown variables,
division by zero and unsafe totals fail. Definition size and depth are bounded.

Results retain rule identifiers, labels, inputs, operation parameters, rounded
amounts, effective answers and engine version. Persist the result and immutable
revision when retaining estimates. A version string alone is not a replacement for
an archived engine implementation when exact recalculation across upgrades matters.
