import { parseEstimator, type Answers } from "@openquotestack/schema";
import { calculateEstimate, type EstimateResult } from "@openquotestack/engine";
/** Evaluate a portable estimator document locally. No HTTP client is included. */
export function quoteFromDocument(
  document: unknown,
  answers: Answers,
): EstimateResult {
  return calculateEstimate(parseEstimator(document), answers);
}
export { parseDocument, parseEstimator } from "@openquotestack/schema";
export { calculateEstimate } from "@openquotestack/engine";
