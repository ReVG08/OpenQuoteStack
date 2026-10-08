import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseDocument, parseEstimator } from "./index.js";
const sample = () =>
  JSON.parse(
    readFileSync(
      new URL("../../../templates/moving-company.oqs.json", import.meta.url),
      "utf8",
    ),
  );
describe("portable documents", () => {
  it("parses the moving template and round trips JSON", () => {
    const d = parseDocument(sample());
    expect(parseDocument(JSON.parse(JSON.stringify(d)))).toEqual(d);
    expect(parseEstimator(d).currency.minorUnits).toBe(2);
  });
  it("rejects unsupported schema versions and executable or unknown data", () => {
    expect(() => parseDocument({ ...sample(), schemaVersion: "2" })).toThrow();
    expect(() => parseDocument({ ...sample(), code: "alert(1)" })).toThrow();
    expect(() => parseDocument({ f: () => 1 })).toThrow();
  });
  it("rejects duplicate identifiers and broken field references", () => {
    const d = sample();
    d.estimator.rules[1].field = "absent";
    expect(() => parseDocument(d)).toThrow();
    const x = sample();
    x.estimator.steps[0].fields[1].id = "origin";
    expect(() => parseDocument(x)).toThrow();
  });
  it("rejects forward visibility references and reserved identifiers", () => {
    const d = sample();
    d.estimator.steps[0].fields[0].visibleWhen = {
      field: "piano",
      op: "equals",
      value: true,
    };
    expect(() => parseDocument(d)).toThrow();
    d.estimator.steps[0].fields[0].id = "constructor";
    expect(() => parseDocument(d)).toThrow();
  });
  it("rejects malformed conditions, tiers, bounds and formula variables", () => {
    const d = sample();
    d.estimator.rules[0].when = { field: "piano", op: "equals" };
    expect(() => parseDocument(d)).toThrow();
    d.estimator.rules = [
      {
        id: "t",
        label: "T",
        type: "tiered",
        field: "distance",
        tiers: [
          { upTo: 10, rateMinor: 2 },
          { upTo: 9, rateMinor: 1 },
        ],
      },
    ];
    expect(() => parseDocument(d)).toThrow();
    d.estimator.rules = [
      {
        id: "f",
        label: "F",
        type: "formula",
        expression: { variable: "missing" },
      },
    ];
    expect(() => parseDocument(d)).toThrow();
    d.estimator.output = { minimumMinor: 10, maximumMinor: 2 };
    expect(() => parseDocument(d)).toThrow();
  });
  it("limits recursive input before validation", () => {
    const c: { all: unknown[] } = { all: [] };
    c.all.push(c);
    expect(() => parseDocument(c)).toThrow();
    let deep: unknown = {};
    for (let i = 0; i < 80; i++) deep = { all: [deep] };
    expect(() => parseDocument(deep)).toThrow();
  });
});

it("validates the complete template gallery and retains extended field definitions", async () => {
  const { readFileSync } = await import("node:fs");
  for (const name of [
    "moving-company",
    "residential-cleaning",
    "web-design-agency",
  ]) {
    const doc = parseDocument(
      JSON.parse(
        readFileSync(
          new URL(`../../../templates/${name}.oqs.json`, import.meta.url),
          "utf8",
        ),
      ),
    );
    expect(doc.estimator.steps.length).toBeGreaterThan(1);
    expect(doc.estimator.translations["pt-BR"]?.name).toBeTruthy();
  }
});

it("rejects invalid authored defaults and unusable contact configurations", () => {
  for (const field of [
    {
      id: "bad",
      label: "Bad",
      type: "radio",
      choices: [{ id: "a", label: "A" }],
      defaultValue: ["a"],
    },
    {
      id: "bad",
      label: "Bad",
      type: "quantity",
      validation: { integer: true },
      defaultValue: 1.5,
    },
    { id: "bad", label: "Bad", type: "email", defaultValue: "invalid" },
    { id: "bad", label: "Bad", type: "date", defaultValue: "2026-02-30" },
  ]) {
    const d = sample();
    d.estimator.steps[0].fields.push(field);
    expect(() => parseDocument(d)).toThrow();
  }
  const d = sample();
  d.estimator.leadCapture = { mode: "before", fields: ["phone"] };
  expect(() => parseDocument(d)).toThrow();
});
