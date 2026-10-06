import { z } from "zod";

export const SCHEMA_VERSION = "1" as const;
const id = z
  .string()
  .regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/)
  .refine(
    (s) => !["constructor", "prototype", "__proto__"].includes(s),
    "Reserved identifier",
  );
const decimal = z.string().regex(/^-?\d{1,15}(\.\d{1,12})?$/);
const minor = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const label = z.string().min(1).max(200);
export const answerSchema = z.union([
  z.string().max(2000),
  z.number().finite(),
  z.boolean(),
  z.array(z.string().max(100)).max(100),
]);
export type Answer = z.infer<typeof answerSchema>;
export type Answers = Record<string, Answer>;
export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | {
      field: string;
      op:
        | "equals"
        | "not_equals"
        | "gt"
        | "lt"
        | "gte"
        | "lte"
        | "contains"
        | "not_contains"
        | "selected"
        | "not_selected"
        | "empty"
        | "not_empty";
      value?: Answer;
    };
export const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.strictObject({ all: z.array(conditionSchema).min(1).max(32) }),
    z.strictObject({ any: z.array(conditionSchema).min(1).max(32) }),
    z
      .strictObject({
        field: id,
        op: z.enum([
          "equals",
          "not_equals",
          "gt",
          "lt",
          "gte",
          "lte",
          "contains",
          "not_contains",
          "selected",
          "not_selected",
          "empty",
          "not_empty",
        ]),
        value: answerSchema.optional(),
      })
      .superRefine((c, ctx) => {
        if (!["empty", "not_empty"].includes(c.op) && c.value === undefined)
          ctx.addIssue({
            code: "custom",
            message: "Operator requires a value",
          });
        if (
          ["gt", "lt", "gte", "lte"].includes(c.op) &&
          typeof c.value !== "number"
        )
          ctx.addIssue({
            code: "custom",
            message: "Comparison requires a numeric value",
          });
      }),
  ]),
);
export type Formula =
  | { value: string }
  | { variable: string }
  | { op: "+" | "-" | "*" | "/"; left: Formula; right: Formula };
export const formulaSchema: z.ZodType<Formula> = z.lazy(() =>
  z.union([
    z.strictObject({ value: decimal }),
    z.strictObject({ variable: id }),
    z.strictObject({
      op: z.enum(["+", "-", "*", "/"]),
      left: formulaSchema,
      right: formulaSchema,
    }),
  ]),
);
const choice = z.strictObject({ id, label });
export const fieldSchema = z
  .strictObject({
    id,
    label,
    type: z.enum([
      "text",
      "number",
      "boolean",
      "select",
      "multiselect",
      "date",
    ]),
    required: z.boolean().default(false),
    help: z.string().max(500).optional(),
    choices: z.array(choice).max(100).optional(),
    validation: z
      .strictObject({
        min: z.number().finite().optional(),
        max: z.number().finite().optional(),
        integer: z.boolean().optional(),
        maxLength: z.number().int().min(1).max(2000).optional(),
      })
      .optional(),
    visibleWhen: conditionSchema.optional(),
  })
  .superRefine((f, ctx) => {
    if (["select", "multiselect"].includes(f.type) && !f.choices?.length)
      ctx.addIssue({ code: "custom", message: "Choice fields need choices" });
    if (
      f.choices &&
      new Set(f.choices.map((c) => c.id)).size !== f.choices.length
    )
      ctx.addIssue({ code: "custom", message: "Duplicate choice identifier" });
    if (
      f.validation?.min !== undefined &&
      f.validation.max !== undefined &&
      f.validation.min > f.validation.max
    )
      ctx.addIssue({ code: "custom", message: "Minimum exceeds maximum" });
  });
const common = { id, label, when: conditionSchema.optional() };
export const ruleSchema = z.discriminatedUnion("type", [
  z.strictObject({ ...common, type: z.literal("fixed"), amountMinor: minor }),
  z.strictObject({
    ...common,
    type: z.literal("per_unit"),
    field: id,
    rateMinor: minor,
  }),
  z.strictObject({
    ...common,
    type: z.literal("tiered"),
    field: id,
    tiers: z
      .array(
        z.strictObject({
          upTo: z.number().positive().finite().nullable(),
          rateMinor: minor,
        }),
      )
      .min(1)
      .max(100),
  }),
  z.strictObject({
    ...common,
    type: z.literal("percentage"),
    percent: decimal,
    basis: z.enum(["subtotal", "running_total"]),
  }),
  z.strictObject({
    ...common,
    type: z.literal("formula"),
    expression: formulaSchema,
  }),
  z.strictObject({
    ...common,
    type: z.literal("date_weekday"),
    field: id,
    days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    percent: decimal,
    basis: z.enum(["subtotal", "running_total"]),
  }),
]);
export const currencySchema = z.strictObject({
  code: z.string().regex(/^[A-Z]{3}$/),
  minorUnits: z.number().int().min(0).max(4),
});
export const estimatorSchema = z
  .strictObject({
    id,
    name: label,
    description: z.string().max(2000).optional(),
    locale: z.enum(["en", "pt-BR"]).default("en"),
    currency: currencySchema,
    steps: z
      .array(
        z.strictObject({
          id,
          title: label,
          fields: z.array(fieldSchema).min(1).max(100),
        }),
      )
      .min(1)
      .max(20),
    constants: z.record(id, decimal).default({}),
    rules: z.array(ruleSchema).min(1).max(200),
    output: z
      .strictObject({
        minimumMinor: minor.optional(),
        maximumMinor: minor.optional(),
        range: z
          .strictObject({ belowPercent: decimal, abovePercent: decimal })
          .optional(),
        message: z.string().max(1000).optional(),
        messages: z
          .array(
            z.strictObject({
              when: conditionSchema,
              text: z.string().max(1000),
            }),
          )
          .max(20)
          .optional(),
        cta: z
          .strictObject({
            label,
            url: z
              .url()
              .refine((s) => /^https?:\/\//.test(s), "HTTP URL required"),
            when: conditionSchema.optional(),
          })
          .optional(),
      })
      .default({}),
  })
  .superRefine((e, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    const fields = e.steps.flatMap((s) => s.fields);
    const fieldMap = new Map(fields.map((f) => [f.id, f]));
    for (const [name, items] of [
      ["field", fields],
      ["step", e.steps],
      ["rule", e.rules],
    ] as const)
      if (new Set(items.map((x) => x.id)).size !== items.length)
        fail(`Duplicate ${name} identifier`);
    const checkCondition = (
      c: Condition,
      available = new Set(fieldMap.keys()),
    ) => {
      if ("all" in c) c.all.forEach((x) => checkCondition(x, available));
      else if ("any" in c) c.any.forEach((x) => checkCondition(x, available));
      else if (!available.has(c.field))
        fail(`Unknown or forward condition field: ${c.field}`);
    };
    const preceding = new Set<string>();
    for (const field of fields) {
      if (field.visibleWhen) checkCondition(field.visibleWhen, preceding);
      preceding.add(field.id);
    }
    const variables = new Set([
      ...fields.filter((f) => f.type === "number").map((f) => f.id),
      ...Object.keys(e.constants),
    ]);
    for (const key of Object.keys(e.constants))
      if (fieldMap.has(key)) fail(`Constant shadows field: ${key}`);
    const checkFormula = (f: Formula) => {
      if ("variable" in f) {
        if (!variables.has(f.variable))
          fail(`Unknown formula variable: ${f.variable}`);
      } else if ("op" in f) {
        checkFormula(f.left);
        checkFormula(f.right);
      }
    };
    for (const rule of e.rules) {
      if (rule.when) checkCondition(rule.when);
      if (
        "field" in rule &&
        fieldMap.get(rule.field)?.type !==
          (rule.type === "date_weekday" ? "date" : "number")
      )
        fail(`Invalid pricing field: ${rule.field}`);
      if (rule.type === "formula") checkFormula(rule.expression);
      if (rule.type === "percentage" || rule.type === "date_weekday")
        if (Number(rule.percent) < -100)
          fail("Percentage below -100 is not supported");
      if (rule.type === "tiered") {
        let prev = 0;
        rule.tiers.forEach((t, i) => {
          if (t.upTo === null) {
            if (i !== rule.tiers.length - 1) fail("Open tier must be last");
          } else {
            if (t.upTo <= prev) fail("Tier bounds must increase");
            prev = t.upTo;
          }
        });
        if (rule.tiers.at(-1)?.upTo !== null)
          fail("Final tier must be open-ended");
      }
    }
    const o = e.output;
    if (
      o.minimumMinor !== undefined &&
      o.maximumMinor !== undefined &&
      o.minimumMinor > o.maximumMinor
    )
      fail("Minimum price exceeds maximum");
    if (
      o.range &&
      (Number(o.range.belowPercent) < 0 ||
        Number(o.range.belowPercent) > 100 ||
        Number(o.range.abovePercent) < 0)
    )
      fail("Invalid price range percentages");
    o.messages?.forEach((m) => checkCondition(m.when));
    if (o.cta?.when) checkCondition(o.cta.when);
  });
export const documentSchema = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  template: z
    .strictObject({
      id,
      name: label,
      category: z.string().max(100),
      version: z.string().max(30),
      description: z.string().max(2000).optional(),
    })
    .optional(),
  estimator: estimatorSchema,
});
export type Estimator = z.infer<typeof estimatorSchema>;
export type EstimatorDocument = z.infer<typeof documentSchema>;
export type Field = z.infer<typeof fieldSchema>;
export type PricingRule = z.infer<typeof ruleSchema>;

/** Reject non-JSON data and limit nesting before recursive schema validation. */
export function assertDataBudget(value: unknown): void {
  const seen = new Set<object>();
  let nodes = 0;
  const visit = (v: unknown, depth: number) => {
    if (++nodes > 20000 || depth > 64)
      throw new Error("Definition exceeds data limits");
    if (typeof v === "object" && v !== null) {
      if (seen.has(v))
        throw new Error("Cyclic or shared object references are not JSON data");
      seen.add(v);
      if (
        !Array.isArray(v) &&
        Object.getPrototypeOf(v) !== Object.prototype &&
        Object.getPrototypeOf(v) !== null
      )
        throw new Error("Plain JSON objects required");
      Object.values(v).forEach((x) => visit(x, depth + 1));
    } else if (
      v !== null &&
      !["string", "number", "boolean"].includes(typeof v)
    )
      throw new Error("JSON data required");
  };
  visit(value, 0);
}
/** Parse a versioned .oqs.json document and return its validated estimator. */
export function parseEstimator(value: unknown): Estimator {
  return parseDocument(value).estimator;
}
export function parseDocument(value: unknown): EstimatorDocument {
  assertDataBudget(value);
  return documentSchema.parse(value);
}
