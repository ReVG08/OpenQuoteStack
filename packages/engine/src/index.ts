import {
  assertDataBudget,
  estimatorSchema,
  answerSchema,
  type Answer,
  type Answers,
  type Estimator,
  type PricingRule,
} from "@openquotestack/schema";
import { evaluateCondition } from "./conditions.js";
import { evaluateFormula } from "./formula.js";
import {
  decimal,
  mul,
  div,
  sub,
  add,
  compare,
  round,
  safeSum,
  type Rational,
} from "./money.js";
export { evaluateCondition } from "./conditions.js";
export { parseFormula } from "./formula.js";
export const ENGINE_VERSION = "0.1.0";
export class AnswerValidationError extends Error {
  constructor(public readonly issues: { field: string; message: string }[]) {
    super("Invalid estimator answers");
    this.name = "AnswerValidationError";
  }
}
export type RuleTrace = {
  ruleId: string;
  label: string;
  operation: PricingRule["type"] | "minimum" | "maximum";
  input?: Answer;
  parameters: Record<string, unknown>;
  amountMinor: number;
};
export type EstimateResult = {
  currency: string;
  minorUnits: number;
  subtotalMinor: number;
  totalMinor: number;
  lineItems: RuleTrace[];
  adjustments: RuleTrace[];
  appliedRules: string[];
  range?: { minMinor: number; maxMinor: number };
  messages: string[];
  cta?: { label: string; url: string };
  metadata: {
    engineVersion: string;
    schemaVersion: "1";
    estimatorId: string;
    answers: Answers;
    visibleFields: string[];
  };
};
const validDate = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  Number.isFinite(Date.parse(`${s}T00:00:00Z`)) &&
  new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
/** Validate only visible answers. Visibility can reference preceding fields only. */
export function validateAnswers(
  estimator: Estimator,
  raw: Answers,
): { answers: Answers; visibleFields: string[] } {
  const fields = estimator.steps.flatMap((s) => s.fields);
  const issues: { field: string; message: string }[] = [];
  const answers: Answers = Object.create(null) as Answers;
  const visibleFields: string[] = [];
  for (const key of Object.keys(raw))
    if (!fields.some((f) => f.id === key))
      issues.push({ field: key, message: "Unknown field" });
  for (const field of fields) {
    if (field.visibleWhen && !evaluateCondition(field.visibleWhen, answers))
      continue;
    visibleFields.push(field.id);
    const v = Object.hasOwn(raw, field.id) ? raw[field.id] : undefined;
    const empty =
      v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
    const fail = (message: string) => issues.push({ field: field.id, message });
    if (empty) {
      if (field.required) fail("Required answer");
      continue;
    }
    if (!answerSchema.safeParse(v).success) {
      fail("Invalid answer value");
      continue;
    }
    const valid =
      field.type === "number"
        ? typeof v === "number" && v >= 0
        : field.type === "boolean"
          ? typeof v === "boolean"
          : field.type === "multiselect"
            ? Array.isArray(v) &&
              new Set(v).size === v.length &&
              v.every((s) => field.choices?.some((c) => c.id === s))
            : typeof v === "string" &&
              (field.type === "select"
                ? field.choices?.some((c) => c.id === v)
                : field.type === "date"
                  ? validDate(v)
                  : true);
    if (!valid) {
      fail("Answer does not match field type");
      continue;
    }
    if (
      typeof v === "number" &&
      ((field.validation?.min !== undefined && v < field.validation.min) ||
        (field.validation?.max !== undefined && v > field.validation.max) ||
        (field.validation?.integer && !Number.isSafeInteger(v)))
    )
      fail("Number outside allowed bounds");
    if (
      typeof v === "string" &&
      v.length > (field.validation?.maxLength ?? 2000)
    )
      fail("Text is too long");
    answers[field.id] = v!;
  }
  if (issues.length) throw new AnswerValidationError(issues);
  return { answers: { ...answers }, visibleFields };
}
/** Calculate rounded minor-unit charges without clock, locale, network or storage dependencies. */
export function calculateEstimate(
  definition: Estimator,
  rawAnswers: Answers,
): EstimateResult {
  assertDataBudget(definition);
  const estimator = estimatorSchema.parse(definition);
  const { answers, visibleFields } = validateAnswers(estimator, rawAnswers);
  const variables: Record<string, Rational> = Object.create(null) as Record<
    string,
    Rational
  >;
  for (const [k, v] of Object.entries(estimator.constants))
    variables[k] = decimal(v);
  for (const [k, v] of Object.entries(answers))
    if (typeof v === "number") variables[k] = decimal(v);
  let subtotalMinor = 0,
    totalMinor = 0;
  const appliedRules: string[] = [];
  const lineItems: RuleTrace[] = [],
    adjustments: RuleTrace[] = [];
  for (const rule of estimator.rules) {
    if (rule.when && !evaluateCondition(rule.when, answers)) continue;
    let amount: Rational = decimal(0);
    let input: Answer | undefined;
    const parameters: Record<string, unknown> = {};
    if ("field" in rule) {
      input = answers[rule.field];
      if (input === undefined) continue;
    }
    switch (rule.type) {
      case "fixed":
        amount = decimal(rule.amountMinor);
        parameters.amountMinor = rule.amountMinor;
        break;
      case "per_unit":
        amount = mul(decimal(input as number), decimal(rule.rateMinor));
        parameters.rateMinor = rule.rateMinor;
        break;
      case "formula":
        amount = evaluateFormula(rule.expression, variables);
        parameters.expression = rule.expression;
        parameters.variables = {
          ...estimator.constants,
          ...Object.fromEntries(
            Object.entries(answers).filter(([, v]) => typeof v === "number"),
          ),
        };
        break;
      case "tiered": {
        let remaining = decimal(input as number),
          lower = decimal(0);
        const segments: {
          quantity: { numerator: string; denominator: string };
          rateMinor: number;
        }[] = [];
        for (const tier of rule.tiers) {
          if (compare(remaining, decimal(0)) <= 0) break;
          const width =
            tier.upTo === null ? remaining : sub(decimal(tier.upTo), lower);
          const quantity = compare(remaining, width) < 0 ? remaining : width;
          amount = add(amount, mul(quantity, decimal(tier.rateMinor)));
          segments.push({
            quantity: {
              numerator: String(quantity.n),
              denominator: String(quantity.d),
            },
            rateMinor: tier.rateMinor,
          });
          remaining = sub(remaining, quantity);
          if (tier.upTo !== null) lower = decimal(tier.upTo);
        }
        parameters.segments = segments;
        break;
      }
      case "date_weekday":
        if (
          !rule.days.includes(
            new Date(`${input as string}T00:00:00Z`).getUTCDay(),
          )
        )
          continue;
      // Date-only answers represent the business calendar date, independent of host timezone.
      // falls through
      case "percentage": {
        const basisMinor =
          rule.basis === "subtotal" ? subtotalMinor : totalMinor;
        amount = div(
          mul(decimal(basisMinor), decimal(rule.percent)),
          decimal(100),
        );
        parameters.basisMinor = basisMinor;
        parameters.percent = rule.percent;
        parameters.basis = rule.basis;
        break;
      }
    }
    const amountMinor = round(amount);
    appliedRules.push(rule.id);
    const trace: RuleTrace = {
      ruleId: rule.id,
      label: rule.label,
      operation: rule.type,
      ...(input === undefined ? {} : { input }),
      parameters,
      amountMinor,
    };
    if (rule.type === "percentage" || rule.type === "date_weekday")
      adjustments.push(trace);
    else {
      lineItems.push(trace);
      subtotalMinor = safeSum(subtotalMinor, amountMinor);
    }
    totalMinor = safeSum(totalMinor, amountMinor);
    if (totalMinor < 0)
      throw new Error("Pricing rules produced a negative running total");
  }
  for (const [operation, bound] of [
    ["minimum", estimator.output.minimumMinor],
    ["maximum", estimator.output.maximumMinor],
  ] as const) {
    if (
      bound !== undefined &&
      (operation === "minimum" ? totalMinor < bound : totalMinor > bound)
    ) {
      appliedRules.push(`$${operation}`);
      adjustments.push({
        ruleId: `$${operation}`,
        label: operation === "minimum" ? "Minimum price" : "Maximum price",
        operation,
        parameters: { boundMinor: bound, basisMinor: totalMinor },
        amountMinor: bound - totalMinor,
      });
      totalMinor = bound;
    }
  }
  const range = estimator.output.range;
  const messages = [
    estimator.output.message,
    ...(estimator.output.messages
      ?.filter((m) => evaluateCondition(m.when, answers))
      .map((m) => m.text) ?? []),
  ].filter((m): m is string => m !== undefined);
  const cta = estimator.output.cta;
  return {
    currency: estimator.currency.code,
    minorUnits: estimator.currency.minorUnits,
    subtotalMinor,
    totalMinor,
    lineItems,
    adjustments,
    appliedRules,
    ...(range
      ? {
          range: {
            minMinor: round(
              mul(
                decimal(totalMinor),
                sub(decimal(1), div(decimal(range.belowPercent), decimal(100))),
              ),
            ),
            maxMinor: round(
              mul(
                decimal(totalMinor),
                add(decimal(1), div(decimal(range.abovePercent), decimal(100))),
              ),
            ),
          },
        }
      : {}),
    messages,
    ...(cta && (!cta.when || evaluateCondition(cta.when, answers))
      ? { cta: { label: cta.label, url: cta.url } }
      : {}),
    metadata: {
      engineVersion: ENGINE_VERSION,
      schemaVersion: "1",
      estimatorId: estimator.id,
      answers,
      visibleFields,
    },
  };
}
