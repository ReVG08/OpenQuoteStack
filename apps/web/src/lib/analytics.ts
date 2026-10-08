import type { EstimateResult } from "@openquotestack/engine";
export function monetaryGroups(rows: { result: unknown }[]) {
  const groups = new Map<
    string,
    { currency: string; minorUnits: number; total: bigint; count: number }
  >();
  for (const row of rows) {
    const result = row.result as EstimateResult,
      key = `${result.currency}:${result.minorUnits}`,
      g = groups.get(key) ?? {
        currency: result.currency,
        minorUnits: result.minorUnits,
        total: 0n,
        count: 0,
      };
    g.total += BigInt(result.totalMinor);
    g.count++;
    groups.set(key, g);
  }
  return [...groups.values()];
}

export const averageMinor = (total: bigint, count: number) =>
  (total + BigInt(Math.floor(count / 2))) / BigInt(count);
