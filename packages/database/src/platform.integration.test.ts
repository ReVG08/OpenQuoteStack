import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { SMTPServer } from "smtp-server";
import { randomBytes } from "node:crypto";
import { createDatabase } from "./index";
import { createServices } from "./services";
import { createPlatform } from "./platform";
import { dispatchOutbox, runJob, maintainWorker } from "./worker";
import { encryptSecret, decryptSecret } from "./crypto";
import { verifyWebhookSignature } from "./webhook-signature";
import { EventBus } from "@openquotestack/core";
const dns = vi.hoisted(() => ({ lookup: vi.fn(), resolveTxt: vi.fn() }));
vi.mock("node:dns/promises", () => dns);
const url = process.env.DATABASE_TEST_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Disposable test database required");
const db = createDatabase(url),
  svc = createServices(db, new EventBus()),
  platform = createPlatform(db);
const actor = { userId: "platform-owner" },
  other = { userId: "platform-other" },
  viewer = { userId: "platform-viewer" };
let org: string,
  foreign: string,
  estimatorId: string,
  revisionId: string,
  quoteId: string,
  webhookId: string;
let secret: string;
const answers = {
  origin: "Boston",
  destination: "Cambridge",
  bedrooms: 3,
  distance: 22,
  elevator: true,
  boxes: 0,
  piano: true,
  packing: false,
  moving_date: "2026-10-10",
};
beforeAll(async () => {
  process.env.OQS_ENCRYPTION_KEY = randomBytes(32).toString("hex");
  await db.$executeRawUnsafe('TRUNCATE TABLE "Organization", "User" CASCADE');
  for (const a of [actor, other, viewer])
    await db.user.create({
      data: { id: a.userId, name: a.userId, email: `${a.userId}@example.test` },
    });
  const input = {
    name: "Platform tests",
    slug: "platform-tests",
    locale: "en",
    timezone: "UTC",
    defaultCurrency: "USD",
  };
  org = (await svc.createOrganization(actor, input)).id;
  foreign = (
    await svc.createOrganization(other, { ...input, slug: "platform-other" })
  ).id;
  await db.membership.create({
    data: { organizationId: org, userId: viewer.userId, role: "viewer" },
  });
  const doc = JSON.parse(
    readFileSync(
      new URL("../../../templates/moving-company.oqs.json", import.meta.url),
      "utf8",
    ),
  );
  const e = await svc.createEstimator(actor, org, doc);
  estimatorId = e.estimator.id;
  revisionId = e.revision.id;
  await svc.publishRevision(actor, org, estimatorId, revisionId);
});
afterAll(() => db.$disconnect());
describe("scoped platform", () => {
  it("shows secrets once, stores hashes, and restricts administration", async () => {
    await expect(
      platform.createKey(viewer, org, {
        name: "Forbidden",
        scopes: ["estimates:read"],
      }),
    ).rejects.toThrow();
    await expect(
      platform.createKey(other, org, {
        name: "Foreign",
        scopes: ["estimates:read"],
      }),
    ).rejects.toThrow();
    const key = await platform.createKey(actor, org, {
      name: "Server",
      scopes: [
        "estimators:read",
        "estimates:read",
        "estimates:write",
        "leads:read",
      ],
    });
    secret = key.secret;
    const stored = await db.apiKey.findUniqueOrThrow({ where: { id: key.id } });
    expect(stored.secretHash).not.toContain(secret);
    expect(stored.secretHash).toHaveLength(64);
    expect(JSON.stringify(await platform.listKeys(actor, org))).not.toContain(
      secret,
    );
    const p = await platform.authenticate(secret);
    expect(
      (await platform.listResources(p, "estimators", {})).data,
    ).toHaveLength(1);
    await expect(platform.listKeys(actor, foreign)).rejects.toThrow();
  });
  it("enforces scopes and tenant ownership and rejects invalid answers", async () => {
    const key = await platform.createKey(actor, org, {
        name: "Read",
        scopes: ["estimators:read"],
      }),
      p = await platform.authenticate(key.secret);
    await expect(platform.listResources(p, "leads", {})).rejects.toMatchObject({
      status: 403,
    });
    const fp = await platform.authenticate(
      (
        await platform.createKey(other, foreign, {
          name: "Other",
          scopes: ["estimators:read", "estimates:write"],
        })
      ).secret,
    );
    await expect(
      platform.getResource(fp, "estimators", estimatorId),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      platform.submitEstimate(
        fp,
        { estimatorId, answers },
        "test-foreign-request",
      ),
    ).rejects.toThrow();
    await expect(
      platform.submitEstimate(
        await platform.authenticate(secret),
        { estimatorId, answers: { bedrooms: -1 } },
        "invalid-answers-test",
      ),
    ).rejects.toThrow();
  });
  it("retains revisions and atomically deduplicates submissions and events", async () => {
    const p = await platform.authenticate(secret),
      input = {
        estimatorId,
        revisionId,
        answers,
        contact: { name: "Taylor Example", email: "taylor@example.test" },
      };
    const results = await Promise.all([
      platform.submitEstimate(p, input, "idempotency-concurrent"),
      platform.submitEstimate(p, input, "idempotency-concurrent"),
    ]);
    quoteId = results[0]!.estimate.id;
    expect(results[1]!.estimate.id).toBe(quoteId);
    expect(results.map((r) => r.replayed).sort()).toEqual([false, true]);
    expect(results[0]!.estimate.result.totalMinor).toBe(70863);
    await expect(
      platform.submitEstimate(
        p,
        { ...input, answers: { ...answers, bedrooms: 4 } },
        "idempotency-concurrent",
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(await db.outboxEvent.count({ where: { resourceId: quoteId } })).toBe(
      2,
    );
    const next = await svc.createRevision(actor, org, estimatorId, {
      ...JSON.parse(
        readFileSync(
          new URL(
            "../../../templates/moving-company.oqs.json",
            import.meta.url,
          ),
          "utf8",
        ),
      ),
    });
    await svc.publishRevision(actor, org, estimatorId, next.id);
    expect(
      (await platform.getResource(p, "estimates", quoteId)).revision,
    ).toMatchObject({ id: revisionId });
    await expect(
      platform.submitEstimate(p, input, "stale-revision-submit"),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("queues signed deliveries once and retries failures without blocking writes", async () => {
    const signingSecret = "test-signing-secret";
    const endpoint = await db.webhookEndpoint.create({
      data: {
        organizationId: org,
        url: "https://hooks.example.com/receive",
        subscriptions: ["lead.updated"],
        secretEncrypted: encryptSecret(signingSecret),
      },
    });
    webhookId = endpoint.id;
    const quote = await db.estimate.findUniqueOrThrow({
      where: { id: quoteId },
      include: { lead: true },
    });
    await platform.updateLead(actor, org, quote.lead!.id, {
      name: "Taylor Updated",
      email: "taylor@example.test",
    });
    await dispatchOutbox(db);
    await dispatchOutbox(db);
    expect(
      await db.webhookDelivery.count({ where: { endpointId: webhookId } }),
    ).toBe(1);
    await db.backgroundJob.updateMany({
      where: { kind: "webhook", organizationId: org },
      data: { availableAt: new Date(0) },
    });
    await runJob(db, {
      webhook: async (_, body, headers) => {
        expect(
          verifyWebhookSignature(
            signingSecret,
            headers["OQS-Signature"]!,
            body,
          ),
        ).toBe(true);
        return { status: 503, durationMs: 3 };
      },
    });
    let delivery = await db.webhookDelivery.findFirstOrThrow({
      where: { endpointId: webhookId },
    });
    expect(delivery.status).toBe("retrying");
    await db.backgroundJob.updateMany({
      where: { kind: "webhook", organizationId: org },
      data: { availableAt: new Date(0) },
    });
    await runJob(db, { webhook: async () => ({ status: 204, durationMs: 2 }) });
    delivery = await db.webhookDelivery.findUniqueOrThrow({
      where: { id: delivery.id },
    });
    expect(delivery.status).toBe("delivered");
    expect(delivery.attempts).toBe(2);
    expect(decryptSecret(endpoint.secretEncrypted)).toBe(signingSecret);
    await expect(
      platform.deactivateWebhook(other, org, webhookId),
    ).rejects.toThrow();
  });
  it("delivers queued branded email through configurable SMTP", async () => {
    let delivered = "";
    const smtp = new SMTPServer({
      authOptional: true,
      disabledCommands: ["AUTH", "STARTTLS"],
      onData(stream, _session, callback) {
        let text = "";
        stream.on("data", (chunk) => {
          text += chunk.toString();
        });
        stream.on("end", () => {
          delivered = text;
          callback();
        });
      },
    });
    await new Promise<void>((resolve) => smtp.listen(0, "127.0.0.1", resolve));
    const address = smtp.server.address();
    if (!address || typeof address === "string")
      throw new Error("SMTP fixture address unavailable");
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = String(address.port);
    process.env.SMTP_FROM = "quotes@example.test";
    process.env.SMTP_ALLOW_INSECURE = "true";
    try {
      await platform.sendEstimate(actor, org, quoteId);
      await db.backgroundJob.updateMany({
        where: { kind: "email", organizationId: org },
        data: { availableAt: new Date(0) },
      });
      await runJob(db);
      expect(delivered).toContain("Taylor Updated");
      expect(delivered).toContain("Your estimate");
      expect(delivered).toContain("708.63");
      expect(
        await db.backgroundJob.count({
          where: { kind: "email", organizationId: org, status: "completed" },
        }),
      ).toBe(1);
    } finally {
      await new Promise<void>((resolve) => smtp.close(resolve));
      for (const key of [
        "SMTP_HOST",
        "SMTP_PORT",
        "SMTP_FROM",
        "SMTP_ALLOW_INSECURE",
      ])
        delete process.env[key];
    }
  });
  it("verifies domain ownership and revokes routing when DNS becomes private", async () => {
    const domain = await platform.createDomain(
      actor,
      org,
      "quote.acme.example.com",
    );
    dns.lookup.mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);
    dns.resolveTxt.mockResolvedValue([[`v=OQS1;token=${domain.verifyToken}`]]);
    await expect(
      platform.verifyDomain(other, org, domain.id),
    ).rejects.toThrow();
    expect((await platform.verifyDomain(actor, org, domain.id)).status).toBe(
      "active",
    );
    await db.customDomain.update({
      where: { id: domain.id },
      data: { checkedAt: new Date(0) },
    });
    dns.lookup.mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);
    await maintainWorker(db, "domain-test-worker");
    expect(
      (await db.customDomain.findUniqueOrThrow({ where: { id: domain.id } }))
        .status,
    ).toBe("error");
    dns.lookup.mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);
    dns.resolveTxt.mockResolvedValue([["v=OQS1;token=wrong-owner"]]);
    expect((await platform.verifyDomain(actor, org, domain.id)).status).toBe(
      "error",
    );
    await expect(
      platform.removeDomain(actor, foreign, domain.id),
    ).rejects.toThrow();
    await platform.removeDomain(actor, org, domain.id);
  });
  it("limits requests and revokes credentials", async () => {
    await platform.consumeRate("test-limit", 1);
    await expect(platform.consumeRate("test-limit", 1)).rejects.toMatchObject({
      status: 429,
    });
    const p = await platform.authenticate(secret);
    await platform.revokeKey(actor, org, p.keyId);
    await expect(platform.authenticate(secret)).rejects.toMatchObject({
      status: 401,
    });
  });
});
