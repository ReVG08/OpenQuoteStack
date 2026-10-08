import { it, expect } from "vitest";
import { formatMoney } from "./i18n";
import { monetaryGroups, averageMinor } from "./analytics";
it("formats currency exponents and safe-integer boundaries without losing minor units", () => {
  expect(formatMoney(12345, "USD", 2, "en")).toBe("$123.45");
  expect(formatMoney(12345, "JPY", 0, "en")).toBe("¥12,345");
  expect(formatMoney(12345, "KWD", 3, "en")).toContain("12.345");
  expect(formatMoney(-1, "USD", 2, "en")).toBe("-$0.01");
  expect(formatMoney(9007199254740991n, "USD", 2, "en")).toBe(
    "$90,071,992,547,409.91",
  );
  expect(formatMoney(73163, "BRL", 2, "pt-BR").replace(/\u00a0/g, " ")).toBe(
    "R$ 731,63",
  );
});
it("aggregates values independently by currency using exact totals", () => {
  const groups = monetaryGroups([
    {
      result: { currency: "USD", minorUnits: 2, totalMinor: 9007199254740991 },
    },
    {
      result: { currency: "USD", minorUnits: 2, totalMinor: 9007199254740991 },
    },
    { result: { currency: "JPY", minorUnits: 0, totalMinor: 100 } },
  ]);
  expect(groups[0]!.total).toBe(18014398509481982n);
  expect(averageMinor(groups[0]!.total, 2)).toBe(9007199254740991n);
  expect(groups[1]!.total).toBe(100n);
});
