import { parseEstimator, type Answers } from "@openquotestack/schema";
import { calculateEstimate, type EstimateResult } from "@openquotestack/engine";
/** Evaluate a portable estimator document locally without making an API request. */
export function quoteFromDocument(
  document: unknown,
  answers: Answers,
): EstimateResult {
  return calculateEstimate(parseEstimator(document), answers);
}
export { parseDocument, parseEstimator } from "@openquotestack/schema";
export { calculateEstimate } from "@openquotestack/engine";

export {
  OpenQuoteStack,
  OpenQuoteStackError,
  type ClientOptions,
} from "./client.js";
export * from "./api-types.js";
export { verifyWebhook } from "./webhooks.js";
