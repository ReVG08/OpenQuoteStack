/** Verify the signature over the unmodified request body before parsing JSON. Deduplicate event IDs separately. */
export async function verifyWebhook(
  secret: string,
  signature: string,
  body: string | Uint8Array,
  options: { now?: number; toleranceSeconds?: number } = {},
): Promise<boolean> {
  const match = signature.match(/^t=(\d{1,12}),v1=([a-f0-9]{64})$/),
    now = options.now ?? Math.floor(Date.now() / 1000),
    tolerance = options.toleranceSeconds ?? 300;
  if (
    !match ||
    !Number.isFinite(now) ||
    !Number.isFinite(tolerance) ||
    tolerance < 0 ||
    Math.abs(now - Number(match[1])) > tolerance
  )
    return false;
  const encoder = new TextEncoder(),
    prefix = encoder.encode(`${match[1]}.`),
    bytes = typeof body === "string" ? encoder.encode(body) : body,
    payload = new Uint8Array(prefix.length + bytes.length);
  payload.set(prefix);
  payload.set(bytes, prefix.length);
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const signatureBytes = Uint8Array.from(match[2]!.match(/../g)!, (byte) =>
    parseInt(byte, 16),
  );
  return crypto.subtle.verify("HMAC", key, signatureBytes, payload);
}
