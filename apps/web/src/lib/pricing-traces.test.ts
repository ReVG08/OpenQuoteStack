import { expect, it } from "vitest";
import { calculateEstimate } from "@openquotestack/engine";
import { parseEstimator } from "@openquotestack/schema";
import { pricingTraces } from "./pricing-traces";
it("displays an interleaved adjustment before subsequent charges and bounds", () => {
  const result = calculateEstimate(
    parseEstimator({
      schemaVersion: "1",
      estimator: {
        id: "ordered",
        name: "Ordered",
        locale: "en",
        currency: { code: "USD", minorUnits: 2 },
        steps: [
          {
            id: "details",
            title: "Details",
            fields: [{ id: "quantity", label: "Quantity", type: "number" }],
          },
        ],
        rules: [
          { id: "base", label: "Base", type: "fixed", amountMinor: 10000 },
          {
            id: "discount",
            label: "Discount",
            type: "percentage",
            percent: "-10",
            basis: "running_total",
          },
          { id: "extra", label: "Extra", type: "fixed", amountMinor: 1000 },
        ],
        output: { minimumMinor: 11000 },
      },
    }),
    {},
  );
  expect(pricingTraces(result).map((t) => t.ruleId)).toEqual([
    "base",
    "discount",
    "extra",
    "$minimum",
  ]);
  expect(result.totalMinor).toBe(11000);
});
