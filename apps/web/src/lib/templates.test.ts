import { describe, expect, it } from "vitest";
import { templateFor, blankDocument } from "./templates";
import { calculateEstimate } from "@openquotestack/engine";

describe("localized template creation", () => {
  it("preserves example prices across currency exponents", () => {
    for (const [currency, exponent] of [
      ["JPY", 0],
      ["USD", 2],
      ["KWD", 3],
    ] as const) {
      const e = templateFor("moving-company", "en", currency).estimator;
      expect(e.currency.minorUnits).toBe(exponent);
      expect(e.rules.find((r) => r.id === "base")).toMatchObject({
        amountMinor: 180 * 10 ** exponent,
      });
      expect(e.output.minimumMinor).toBe(350 * 10 ** exponent);
      expect(blankDocument("en", currency).estimator.rules[0]).toMatchObject({
        amountMinor: 100 * 10 ** exponent,
      });
    }
  });
  it("materializes Portuguese text without masking later edits", () => {
    const e = templateFor("residential-cleaning", "pt-BR", "BRL").estimator;
    expect(e.name).toBe("Limpeza residencial");
    expect(e.translations["pt-BR"]).toBeUndefined();
    expect(
      calculateEstimate(e, {
        bedrooms: 3,
        bathrooms: 2,
        area: 1600,
        frequency: "weekly",
        deep: true,
        oven: false,
        windows: false,
      }).totalMinor,
    ).toBe(27030);
  });
});
