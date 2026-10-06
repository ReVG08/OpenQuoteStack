import { readFileSync } from "node:fs";
import { parseEstimator } from "@openquotestack/schema";
import { calculateEstimate } from "@openquotestack/engine";
const document: unknown = JSON.parse(
  readFileSync(
    new URL("../templates/moving-company.oqs.json", import.meta.url),
    "utf8",
  ),
);
const result = calculateEstimate(parseEstimator(document), {
  origin: "Boston",
  destination: "Cambridge",
  bedrooms: 3,
  distance: 22,
  elevator: true,
  boxes: 0,
  piano: true,
  packing: false,
  moving_date: "2026-10-10",
});
console.log(JSON.stringify(result, null, 2));
