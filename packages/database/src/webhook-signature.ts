import { createHmac, timingSafeEqual } from "node:crypto";
export function webhookSignature(
  secret: string,
  timestamp: number,
  body: string,
) {
  return `t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}
/** Verify raw bytes before parsing JSON, then deduplicate event IDs in durable consumer storage. */
export function verifyWebhookSignature(
  secret: string,
  signature: string,
  body: string,
  now = Math.floor(Date.now() / 1000),
  tolerance = 300,
): boolean {
  const match = signature.match(/^t=(\d{1,12}),v1=([a-f0-9]{64})$/);
  if (!match || Math.abs(now - Number(match[1])) > tolerance) return false;
  const expected = webhookSignature(secret, Number(match[1]), body).split(
    "v1=",
  )[1]!;
  return timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(match[2]!, "hex"),
  );
}
