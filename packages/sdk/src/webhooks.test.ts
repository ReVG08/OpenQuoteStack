import { it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyWebhook } from "./webhooks";
it("verifies Node-compatible raw signatures with timestamp bounds", async () => {
  const body = '{"name":"João"}',
    secret = "test-secret",
    now = 123456;
  const header = `t=${now},v1=${createHmac("sha256", secret).update(`${now}.${body}`).digest("hex")}`;
  expect(
    await verifyWebhook(secret, header, new TextEncoder().encode(body), {
      now,
    }),
  ).toBe(true);
  expect(await verifyWebhook(secret, header, body + " ", { now })).toBe(false);
  expect(await verifyWebhook(secret, header, body, { now: now + 301 })).toBe(
    false,
  );
  expect(await verifyWebhook(secret, "invalid", body, { now })).toBe(false);
});
