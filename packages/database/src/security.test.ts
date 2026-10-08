import { describe, it, expect } from "vitest";
import { isPublicAddress, publicAddresses, webhookUrl } from "./network";
import { webhookSignature, verifyWebhookSignature } from "./webhook-signature";
import { encryptSecret, decryptSecret } from "./crypto";
import { localStorage, assetKey } from "./storage";
import { mkdtemp, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
describe("outbound security", () => {
  it("rejects private, loopback, mapped, reserved and invalid addresses", () => {
    for (const address of [
      "127.0.0.1",
      "10.0.0.2",
      "169.254.169.254",
      "172.16.0.1",
      "192.168.1.2",
      "100.64.0.1",
      "0.0.0.0",
      "192.0.2.1",
      "224.0.0.1",
      "::1",
      "::ffff:127.0.0.1",
      "fc00::1",
      "fe80::1",
      "2001:db8::1",
      "bad",
    ])
      expect(isPublicAddress(address), address).toBe(false);
    expect(isPublicAddress("8.8.8.8")).toBe(true);
    expect(isPublicAddress("2606:4700:4700::1111")).toBe(true);
  });
  it("rejects unsafe schemes, credentials, ports and mixed DNS results", async () => {
    for (const url of [
      "http://hooks.example.com",
      "https://hooks.example.com:8443",
      "https://x:y@hooks.example.com",
      "https://localhost",
      "https://127.0.0.1",
      "https://hooks.example.com/#secret",
    ])
      expect(() => webhookUrl(url)).toThrow();
    await expect(
      publicAddresses("hooks.example.com", async () => [
        { address: "8.8.8.8", family: 4 },
        { address: "127.0.0.1", family: 4 },
      ]),
    ).rejects.toThrow();
    await expect(
      publicAddresses("hooks.example.com", async () => []),
    ).rejects.toThrow();
  });
  it("verifies raw signatures and rejects tampering, stale timestamps and malformed headers", () => {
    const secret = "signing-test",
      body = '{"id":"one"}',
      now = 123456;
    const signature = webhookSignature(secret, now, body);
    expect(verifyWebhookSignature(secret, signature, body, now)).toBe(true);
    expect(verifyWebhookSignature(secret, signature, body + " ", now)).toBe(
      false,
    );
    expect(verifyWebhookSignature(secret, signature, body, now + 301)).toBe(
      false,
    );
    expect(verifyWebhookSignature(secret, "t=1,v1=invalid", body, now)).toBe(
      false,
    );
  });
  it("encrypts signing secrets with authenticated encryption", () => {
    process.env.OQS_ENCRYPTION_KEY = randomBytes(32).toString("hex");
    const encrypted = encryptSecret("private-test");
    expect(encrypted).not.toContain("private-test");
    expect(decryptSecret(encrypted)).toBe("private-test");
    const parts = encrypted.split(".");
    parts[1] = Buffer.alloc(16).toString("base64url");
    expect(() => decryptSecret(parts.join("."))).toThrow();
  });
});
it("isolates storage keys, bounds writes and prevents overwriting", async () => {
  const directory = await mkdtemp(resolve(".local/storage-test-")),
    store = localStorage(directory);
  try {
    expect(() => assetKey("../other", "logo.webp")).toThrow();
    await expect(store.get("org/../../.env")).rejects.toThrow();
    const bytes = new Uint8Array([1, 2, 3]);
    await store.put("org/logo.webp", bytes);
    expect(Array.from(await store.get("org/logo.webp"))).toEqual(
      Array.from(bytes),
    );
    await expect(store.put("org/logo.webp", bytes)).rejects.toThrow();
    await expect(
      store.put("org/large.webp", new Uint8Array(2000001)),
    ).rejects.toThrow();
    await store.remove("org/logo.webp");
    await expect(store.get("org/logo.webp")).rejects.toThrow();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
