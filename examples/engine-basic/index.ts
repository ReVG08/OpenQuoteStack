import { readFile } from "node:fs/promises";
import { parseEstimator } from "@openquotestack/schema";
import { calculateEstimate } from "@openquotestack/engine";
const definition = parseEstimator(
  JSON.parse(
    await readFile(
      new URL("../../templates/moving-company.oqs.json", import.meta.url),
      "utf8",
    ),
  ),
);
const result = calculateEstimate(definition, {
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
