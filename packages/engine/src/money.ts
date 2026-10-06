// Exact rational arithmetic keeps intermediate quantities and percentages unrounded.
export type Rational = { n: bigint; d: bigint };
const gcd = (a: bigint, b: bigint): bigint =>
  b === 0n ? (a < 0n ? -a : a) : gcd(b, a % b);
export function rational(n: bigint, d = 1n): Rational {
  if (d === 0n) throw new Error("Division by zero");
  if (n.toString().length > 512 || d.toString().length > 512)
    throw new Error("Arithmetic exceeds complexity limits");
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}
export function decimal(value: number | string): Rational {
  const s = String(value);
  const m = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(s);
  if (!m) throw new Error("Invalid decimal");
  const fraction = m[3] ?? "";
  const exponent = Number(m[4] ?? 0) - fraction.length;
  if (Math.abs(exponent) > 100 || s.length > 128)
    throw new Error("Decimal exceeds arithmetic limits");
  const n = BigInt((m[1] ?? "") + m[2] + fraction);
  return exponent >= 0
    ? rational(n * 10n ** BigInt(exponent))
    : rational(n, 10n ** BigInt(-exponent));
}
export const add = (a: Rational, b: Rational) =>
  rational(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a: Rational, b: Rational) =>
  rational(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a: Rational, b: Rational) => rational(a.n * b.n, a.d * b.d);
export const div = (a: Rational, b: Rational) => rational(a.n * b.d, a.d * b.n);
export const compare = (a: Rational, b: Rational) =>
  a.n * b.d < b.n * a.d ? -1 : a.n * b.d > b.n * a.d ? 1 : 0;
export function round(a: Rational): number {
  const abs = a.n < 0n ? -a.n : a.n;
  const rounded =
    (abs / a.d + (2n * (abs % a.d) >= a.d ? 1n : 0n)) * (a.n < 0n ? -1n : 1n);
  const value = Number(rounded);
  if (!Number.isSafeInteger(value))
    throw new Error("Amount exceeds safe integer limits");
  return value;
}
export function safeSum(a: number, b: number): number {
  return round(add(decimal(a), decimal(b)));
}
