import type { EstimateResult } from "@openquotestack/engine";
/** Keep display order aligned with the engine's sequential calculation. */
export function pricingTraces(result: EstimateResult) {
  const traces = new Map(
    [...result.lineItems, ...result.adjustments].map((line) => [
      line.ruleId,
      line,
    ]),
  );
  return result.appliedRules.flatMap((id) => {
    const trace = traces.get(id);
    return trace ? [trace] : [];
  });
}
