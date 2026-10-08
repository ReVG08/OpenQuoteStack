import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  parseEstimator,
  type PricingRule,
  type Condition,
} from "@openquotestack/schema";
import {
  calculateEstimate,
  evaluateCondition,
  parseFormula,
  AnswerValidationError,
} from "./index.js";
const definition = (rules: PricingRule[], output = {}) =>
  parseEstimator({
    schemaVersion: "1",
    estimator: {
      id: "test",
      name: "Test",
      currency: { code: "USD", minorUnits: 2 },
      steps: [
        {
          id: "inputs",
          title: "Inputs",
          fields: [
            {
              id: "quantity",
              label: "Quantity",
              type: "number",
              required: true,
            },
            { id: "flag", label: "Flag", type: "boolean" },
            {
              id: "choices",
              label: "Choices",
              type: "multiselect",
              choices: [
                { id: "a", label: "A" },
                { id: "b", label: "B" },
              ],
            },
          ],
        },
      ],
      rules,
      output,
    },
  });
const fixed = (amountMinor: number): PricingRule => ({
  id: "base",
  label: "Base",
  type: "fixed",
  amountMinor,
});
const unit: PricingRule = {
  id: "unit",
  label: "Unit",
  type: "per_unit",
  field: "quantity",
  rateMinor: 350,
};
describe("pricing", () => {
  it("adds fixed, quantity and conditional charges with explanations", () => {
    const d = definition([
      fixed(18000),
      unit,
      {
        id: "extra",
        label: "Extra",
        type: "fixed",
        amountMinor: 15000,
        when: { field: "flag", op: "equals", value: true },
      },
    ]);
    const r = calculateEstimate(d, { quantity: 3, flag: true });
    expect(r.totalMinor).toBe(34050);
    expect(r.lineItems[1]).toMatchObject({
      ruleId: "unit",
      input: 3,
      amountMinor: 1050,
      parameters: { rateMinor: 350 },
    });
    expect(r.appliedRules).toEqual(["base", "unit", "extra"]);
  });
  it("applies ordered percentage modifiers with explicit bases", () => {
    const d = definition([
      fixed(10000),
      {
        id: "a",
        label: "A",
        type: "percentage",
        percent: "15",
        basis: "subtotal",
      },
      {
        id: "b",
        label: "B",
        type: "percentage",
        percent: "10",
        basis: "running_total",
      },
    ]);
    const r = calculateEstimate(d, { quantity: 0 });
    expect(r.subtotalMinor).toBe(10000);
    expect(r.totalMinor).toBe(12650);
    expect(r.adjustments[1]?.parameters.basisMinor).toBe(11500);
  });
  it("supports a percentage discount", () => {
    expect(
      calculateEstimate(
        definition([
          fixed(100),
          {
            id: "discount",
            label: "Discount",
            type: "percentage",
            percent: "-10",
            basis: "subtotal",
          },
        ]),
        { quantity: 0 },
      ).totalMinor,
    ).toBe(90);
  });
  it("graduates tiers with fractional quantities at boundaries", () => {
    const d = definition([
      {
        id: "tiers",
        label: "Distance",
        type: "tiered",
        field: "quantity",
        tiers: [
          { upTo: 10, rateMinor: 200 },
          { upTo: 50, rateMinor: 160 },
          { upTo: null, rateMinor: 130 },
        ],
      },
    ]);
    expect(calculateEstimate(d, { quantity: 10 }).totalMinor).toBe(2000);
    expect(calculateEstimate(d, { quantity: 50 }).totalMinor).toBe(8400);
    expect(calculateEstimate(d, { quantity: 51.5 }).totalMinor).toBe(8595);
  });
  it("records minimum and maximum adjustments and ranges", () => {
    const a = calculateEstimate(
      definition([fixed(100)], {
        minimumMinor: 350,
        range: { belowPercent: "5", abovePercent: "10" },
      }),
      { quantity: 0 },
    );
    expect(a.totalMinor).toBe(350);
    expect(a.adjustments[0]?.amountMinor).toBe(250);
    expect(a.range).toEqual({ minMinor: 333, maxMinor: 385 });
    expect(
      calculateEstimate(definition([fixed(999)], { maximumMinor: 500 }), {
        quantity: 0,
      }).totalMinor,
    ).toBe(500);
  });
  it("rounds exact decimal half values once per rule", () => {
    const d = definition([{ ...unit, rateMinor: 5 }]);
    expect(calculateEstimate(d, { quantity: 0.1 }).totalMinor).toBe(1);
    expect(calculateEstimate(d, { quantity: 0.3 }).totalMinor).toBe(2);
    const f = definition([
      {
        id: "f",
        label: "Formula",
        type: "formula",
        expression: parseFormula("(0.1 + 0.2) * 100"),
      },
    ]);
    expect(calculateEstimate(f, { quantity: 0 }).totalMinor).toBe(30);
  });
  it("handles currencies with zero and three minor units", () => {
    const d = definition([fixed(350)]);
    for (const [code, minorUnits] of [
      ["JPY", 0],
      ["KWD", 3],
    ] as const) {
      d.currency = { code, minorUnits };
      expect(calculateEstimate(d, { quantity: 1 })).toMatchObject({
        totalMinor: 350,
        currency: code,
        minorUnits,
      });
    }
  });
  it("evaluates safe formulas and rejects invalid constructs and arithmetic", () => {
    const d = definition([
      {
        id: "f",
        label: "Formula",
        type: "formula",
        expression: parseFormula("quantity * 350 + 100"),
      },
    ]);
    expect(calculateEstimate(d, { quantity: 2 }).totalMinor).toBe(800);
    for (const source of [
      "Math.random()",
      "a.b",
      "2**3",
      "quantity;1",
      "(1+2",
      "1 +",
      "constructor",
    ])
      expect(() => parseFormula(source)).toThrow();
    expect(() =>
      calculateEstimate(
        definition([
          {
            id: "f",
            label: "F",
            type: "formula",
            expression: parseFormula("1 / 0"),
          },
        ]),
        { quantity: 1 },
      ),
    ).toThrow("Division by zero");
    expect(() =>
      calculateEstimate(
        definition([{ ...unit, rateMinor: Number.MAX_SAFE_INTEGER }]),
        { quantity: 2 },
      ),
    ).toThrow("safe integer");
  });
  it("rejects invalid, missing, unknown and duplicate-choice answers", () => {
    for (const answers of [
      {},
      { quantity: -1 },
      { quantity: NaN },
      { quantity: "2" },
      { quantity: 1, other: 2 },
      { quantity: 1, choices: ["a", "a"] },
    ])
      expect(() => calculateEstimate(definition([unit]), answers)).toThrow(
        AnswerValidationError,
      );
  });
  it("ignores hidden answers and does not bill them", () => {
    const d = definition([unit]);
    d.steps[0]!.fields[0]!.visibleWhen = {
      field: "flag",
      op: "equals",
      value: true,
    };
    d.steps[0]!.fields.reverse();
    expect(
      calculateEstimate(d, { flag: false, quantity: 999 }).totalMinor,
    ).toBe(0);
    expect(() => calculateEstimate(d, { flag: true })).toThrow();
  });
  it("produces deterministic serializable results without mutating input", () => {
    const d = definition([unit]);
    const before = JSON.stringify(d);
    const a = { quantity: 3 };
    const r = calculateEstimate(d, a);
    expect(r).toEqual(calculateEstimate(d, a));
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
    expect(JSON.stringify(d)).toBe(before);
    expect(a).toEqual({ quantity: 3 });
  });
  it("uses supplied calendar dates for weekend pricing and rejects invalid dates", () => {
    const d = parseEstimator(
      JSON.parse(
        readFileSync(
          new URL(
            "../../../templates/moving-company.oqs.json",
            import.meta.url,
          ),
          "utf8",
        ),
      ),
    );
    const answers = {
      origin: "Boston",
      destination: "Cambridge",
      bedrooms: 3,
      distance: 22,
      elevator: true,
      boxes: 0,
      piano: true,
      packing: false,
      moving_date: "2026-10-10",
    };
    expect(calculateEstimate(d, answers).totalMinor).toBe(70863);
    expect(
      calculateEstimate(d, { ...answers, moving_date: "2026-10-09" })
        .totalMinor,
    ).toBe(61620);
    expect(() =>
      calculateEstimate(d, { ...answers, moving_date: "2026-02-30" }),
    ).toThrow();
  });
  it("uses conditions for output messages and CTA", () => {
    const d = definition([fixed(100)], {
      messages: [
        {
          when: { field: "flag", op: "equals", value: true },
          text: "Selected",
        },
      ],
      cta: {
        label: "Contact",
        url: "https://example.org/contact",
        when: { field: "flag", op: "equals", value: true },
      },
    });
    expect(calculateEstimate(d, { quantity: 1, flag: true }).messages).toEqual([
      "Selected",
    ]);
    expect(
      calculateEstimate(d, { quantity: 1, flag: false }).cta,
    ).toBeUndefined();
  });
});
it("retains execution order when adjustments precede later charges", () => {
  const result = calculateEstimate(
    definition(
      [
        fixed(100),
        {
          id: "adjust",
          label: "Adjustment",
          type: "percentage",
          percent: "10",
          basis: "subtotal",
        },
        unit,
      ],
      { minimumMinor: 1000 },
    ),
    { quantity: 1 },
  );
  expect(result.appliedRules).toEqual(["base", "adjust", "unit", "$minimum"]);
  expect(result.adjustments[0]?.parameters.basisMinor).toBe(100);
});
it("resolves declared decimal constants and rounds discounts away from zero", () => {
  const d = definition([fixed(0)]);
  d.constants = { rate: "80.25" };
  d.rules = [
    {
      id: "formula",
      label: "Formula",
      type: "formula",
      expression: parseFormula("quantity * rate * 100"),
    },
  ];
  expect(calculateEstimate(d, { quantity: 3 }).totalMinor).toBe(24075);
  const discounted = definition([
    fixed(1001),
    {
      id: "discount",
      label: "Discount",
      type: "percentage",
      percent: "-0.05",
      basis: "subtotal",
    },
  ]);
  expect(
    calculateEstimate(discounted, { quantity: 0 }).adjustments[0]?.amountMinor,
  ).toBe(-1);
});
it("bounds arithmetic work for deeply multiplied formulas", () => {
  let expression: import("@openquotestack/schema").Formula = {
    value: "999999999999999",
  };
  for (let i = 0; i < 40; i++)
    expression = {
      op: "*",
      left: expression,
      right: { value: "999999999999999" },
    };
  expect(() =>
    calculateEstimate(
      definition([{ id: "huge", label: "Huge", type: "formula", expression }]),
      { quantity: 1 },
    ),
  ).toThrow("complexity limits");
});
describe("conditions", () => {
  it.each([
    ["equals", "hello", "hello", true],
    ["not_equals", "hello", "world", true],
    ["gt", 3, 2, true],
    ["lt", 1, 2, true],
    ["gte", 2, 2, true],
    ["lte", 2, 2, true],
    ["contains", "hello", "ell", true],
    ["not_contains", "hello", "x", true],
    ["selected", ["a"], "a", true],
    ["not_selected", ["a"], "b", true],
    ["empty", "", undefined, true],
    ["not_empty", false, undefined, true],
  ] as const)("supports %s", (op, value, target, expected) => {
    expect(
      evaluateCondition(
        {
          field: "x",
          op,
          ...(target === undefined ? {} : { value: target }),
        } as Condition,
        { x: Array.isArray(value) ? [...value] : value },
      ),
    ).toBe(expected);
  });
  it("supports nested AND and OR; missing comparisons are false", () => {
    expect(
      evaluateCondition(
        {
          all: [
            { field: "n", op: "gte", value: 3 },
            {
              any: [
                { field: "b", op: "equals", value: true },
                { field: "s", op: "empty" },
              ],
            },
          ],
        },
        { n: 3, b: false },
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { field: "missing", op: "not_equals", value: true },
        {},
      ),
    ).toBe(false);
  });
});

it("uses authored hidden values and validates email and time answers", () => {
  const e = definition([
    { id: "base", label: "Base", type: "fixed", amountMinor: 100 },
  ]);
  e.steps[0]!.fields = [
    {
      id: "hidden",
      label: "Hidden rate",
      type: "hidden",
      required: false,
      defaultValue: 25,
    },
    { id: "email", label: "Email", type: "email", required: true },
    { id: "time", label: "Time", type: "time", required: true },
  ];
  e.rules = [
    {
      id: "hidden_charge",
      label: "Hidden charge",
      type: "formula",
      expression: { value: "100" },
    },
  ];
  const result = calculateEstimate(e, {
    hidden: 999,
    email: "person@example.test",
    time: "14:30",
  });
  expect(result.metadata.answers.hidden).toBe(25);
  expect(() =>
    calculateEstimate(e, { email: "invalid", time: "25:00" }),
  ).toThrow(AnswerValidationError);
});

it("calculates the cleaning and agency templates without application pricing logic", () => {
  const load = (name: string) =>
    parseEstimator(
      JSON.parse(
        readFileSync(
          new URL(`../../../templates/${name}.oqs.json`, import.meta.url),
          "utf8",
        ),
      ),
    );
  const cleaning = calculateEstimate(load("residential-cleaning"), {
    bedrooms: 3,
    bathrooms: 2,
    area: 1600,
    frequency: "weekly",
    deep: true,
    oven: false,
    windows: false,
  });
  expect(cleaning.totalMinor).toBe(27030);
  expect(cleaning.appliedRules).toEqual([
    "base",
    "bedrooms",
    "bathrooms",
    "area",
    "deep",
    "weekly",
  ]);
  const agency = calculateEstimate(load("web-design-agency"), {
    package: "growth",
    pages: 6,
    commerce: false,
    booking: true,
    copy: true,
    rush: true,
  });
  expect(agency.totalMinor).toBe(622500);
  expect(agency.range).toEqual({ minMinor: 560250, maxMinor: 747000 });
});
