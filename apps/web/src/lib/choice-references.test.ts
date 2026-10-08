import { expect, it } from "vitest";
import { templateFor } from "./templates";
import { renameChoice } from "./choice-references";
import { calculateEstimate } from "@openquotestack/engine";
it("keeps package pricing and defaults connected after renaming a choice", () => {
  const e = templateFor("web-design-agency", "en", "USD").estimator;
  e.steps[0]!.fields[0]!.defaultValue = "growth";
  const answers = {
    pages: 6,
    commerce: false,
    booking: true,
    copy: true,
    rush: true,
  };
  const before = calculateEstimate(e, answers);
  const next = renameChoice(e, "package", "growth", "business");
  expect(next.steps[0]!.fields[0]!.defaultValue).toBe("business");
  expect(
    calculateEstimate(next, { ...answers, package: "business" }).totalMinor,
  ).toBe(before.totalMinor);
  expect(e.steps[0]!.fields[0]!.defaultValue).toBe("growth");
});
