import { consumeRate } from "./platform-context";
import { randomUUID } from "node:crypto";
import { resolveTxt } from "node:dns/promises";
import { type PrismaClient } from "./index";
import { decryptSecret, equalSecret } from "./crypto";
import { postWebhook, publicAddresses, boundedDns } from "./network";
import { webhookSignature } from "./webhook-signature";
import { estimateEmail, smtpTransport } from "./email";
import { notificationsInput } from "./platform-validation";
class DeliveryFailure extends Error {
  constructor(
    public category: string,
    public permanent = false,
  ) {
    super(category);
  }
}
export type WorkerTransport = {
  webhook?: typeof postWebhook;
  email?: (message: Awaited<ReturnType<typeof estimateEmail>>) => Promise<void>;
};
export async function dispatchOutbox(db: PrismaClient) {
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      { id: string }[]
    >`SELECT "id" FROM "OutboxEvent" WHERE "dispatchedAt" IS NULL ORDER BY "createdAt", "id" FOR UPDATE SKIP LOCKED LIMIT 25`;
    for (const { id } of rows) {
      const event = await tx.outboxEvent.findUniqueOrThrow({ where: { id } });
      const endpoints = await tx.webhookEndpoint.findMany({
        where: {
          organizationId: event.organizationId,
          active: true,
          createdAt: { lte: event.createdAt },
          subscriptions: { has: event.name },
        },
      });
      for (const endpoint of endpoints) {
        const delivery = await tx.webhookDelivery.upsert({
          where: {
            endpointId_eventId: { endpointId: endpoint.id, eventId: id },
          },
          create: {
            organizationId: event.organizationId,
            endpointId: endpoint.id,
            eventId: id,
          },
          update: {},
        });
        await tx.backgroundJob.upsert({
          where: { dedupeKey: `webhook:${delivery.id}` },
          create: {
            organizationId: event.organizationId,
            kind: "webhook",
            payload: { deliveryId: delivery.id },
            dedupeKey: `webhook:${delivery.id}`,
          },
          update: {},
        });
      }
      if (event.name === "lead.created") {
        const lead = await tx.lead.findFirst({
          where: { id: event.resourceId, organizationId: event.organizationId },
          include: { organization: true },
        });
        if (lead) {
          const settings = notificationsInput.parse(
            lead.organization.notifications,
          );
          for (const [kind, recipient] of [
            ["notification", settings.notifyEmail],
            ["confirmation", settings.customerConfirmation ? lead.email : ""],
          ] as const) {
            if (!recipient) continue;
            await tx.backgroundJob.upsert({
              where: { dedupeKey: `email:${id}:${kind}` },
              create: {
                organizationId: event.organizationId,
                kind: "email",
                payload: { estimateId: lead.estimateId, recipient, kind },
                dedupeKey: `email:${id}:${kind}`,
              },
              update: {},
            });
          }
        }
      }
      await tx.outboxEvent.update({
        where: { id },
        data: { dispatchedAt: new Date() },
      });
    }
    return rows.length;
  });
}
export async function runJob(
  db: PrismaClient,
  transport: WorkerTransport = {},
) {
  const token = randomUUID();
  // Expired final attempts must become visible failures rather than abandoned leases.
  const expired = await db.backgroundJob.findMany({
    where: {
      status: "running",
      attempts: { gte: 5 },
      lockedUntil: { lt: new Date() },
    },
    take: 100,
  });
  for (const abandoned of expired)
    await db.$transaction(async (tx) => {
      const changed = await tx.backgroundJob.updateMany({
        where: {
          id: abandoned.id,
          lockToken: abandoned.lockToken,
          status: "running",
          lockedUntil: { lt: new Date() },
        },
        data: {
          status: "failed",
          errorCategory: "lease_exhausted",
          lockToken: null,
          lockedUntil: null,
          finishedAt: new Date(),
        },
      });
      if (changed.count && abandoned.kind === "webhook")
        await tx.webhookDelivery.updateMany({
          where: {
            id: (abandoned.payload as Record<string, string>).deliveryId,
            organizationId: abandoned.organizationId,
          },
          data: { status: "failed", errorCategory: "lease_exhausted" },
        });
    });
  const rows = await db.$queryRaw<
    { id: string }[]
  >`WITH due AS (SELECT "id" FROM "BackgroundJob" WHERE "attempts" < 5 AND (("status"='pending' AND "availableAt" <= now()) OR ("status"='running' AND "lockedUntil" < now())) ORDER BY "availableAt","id" FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE "BackgroundJob" j SET "status"='running',"attempts"=j."attempts"+1,"lockToken"=${token},"lockedUntil"=now()+interval '60 seconds' FROM due WHERE j."id"=due."id" RETURNING j."id"`;
  if (!rows[0]) return false;
  const job = await db.backgroundJob.findUniqueOrThrow({
      where: { id: rows[0].id },
    }),
    payload = job.payload as Record<string, string>;
  let failure: DeliveryFailure | undefined;
  try {
    if (job.kind === "webhook") {
      const delivery = await db.webhookDelivery.findFirstOrThrow({
        where: { id: payload.deliveryId, organizationId: job.organizationId },
        include: { endpoint: true, event: true },
      });
      if (!delivery.endpoint.active) {
        await db.webhookDelivery.update({
          where: { id: delivery.id },
          data: { status: "cancelled" },
        });
      } else {
        await db.webhookDelivery.update({
          where: { id: delivery.id },
          data: { status: "delivering", attempts: job.attempts },
        });
        const body = JSON.stringify(delivery.event.payload),
          timestamp = Math.floor(Date.now() / 1000),
          secret = decryptSecret(delivery.endpoint.secretEncrypted);
        let result: Awaited<ReturnType<typeof postWebhook>>;
        try {
          result = await (transport.webhook ?? postWebhook)(
            delivery.endpoint.url,
            body,
            {
              "OQS-Signature": webhookSignature(secret, timestamp, body),
              "OQS-Event-Id": delivery.eventId,
              "OQS-Delivery-Id": delivery.id,
            },
          );
        } catch {
          throw new DeliveryFailure("network_or_destination_error");
        }
        await db.webhookDelivery.update({
          where: { id: delivery.id },
          data: { responseCode: result.status, durationMs: result.durationMs },
        });
        if (result.status < 200 || result.status >= 300)
          throw new DeliveryFailure(
            "http_error",
            result.status >= 300 &&
              result.status < 500 &&
              ![408, 429].includes(result.status),
          );
        await db.webhookDelivery.update({
          where: { id: delivery.id },
          data: { status: "delivered", errorCategory: null },
        });
      }
    } else if (job.kind === "email") {
      try {
        await consumeRate(db, `email-delivery:${job.organizationId}`, 20);
      } catch {
        throw new DeliveryFailure("email_rate_limited");
      }
      const message = await estimateEmail(
        db,
        job.organizationId,
        payload.estimateId!,
        payload.recipient!,
        payload.kind!,
      );
      if (transport.email) await transport.email(message);
      else {
        const smtp = smtpTransport();
        try {
          let timeout: ReturnType<typeof setTimeout> | undefined;
          try {
            await Promise.race([
              smtp.sendMail(message),
              new Promise<never>((_, reject) => {
                timeout = setTimeout(() => {
                  smtp.close();
                  reject(new DeliveryFailure("smtp_timeout"));
                }, 30000);
              }),
            ]);
          } finally {
            if (timeout) clearTimeout(timeout);
          }
        } finally {
          smtp.close();
        }
      }
    } else throw new DeliveryFailure("unknown_job", true);
  } catch (error) {
    failure =
      error instanceof DeliveryFailure
        ? error
        : new DeliveryFailure(
            job.kind === "email" ? "smtp_error" : "delivery_error",
          );
  }
  const failed = !!failure && (failure.permanent || job.attempts >= 5);
  const status = failure ? (failed ? "failed" : "pending") : "completed";
  const availableAt = new Date(
    Date.now() +
      [10000, 60000, 300000, 900000, 3600000][Math.min(job.attempts - 1, 4)]! +
      Math.floor(Math.random() * 1000),
  );
  const updated = await db.backgroundJob.updateMany({
    where: { id: job.id, lockToken: token },
    data: {
      status,
      errorCategory: failure?.category ?? null,
      lockedUntil: null,
      lockToken: null,
      availableAt,
      ...(status !== "pending" ? { finishedAt: new Date() } : {}),
    },
  });
  if (updated.count && job.kind === "webhook" && failure)
    await db.webhookDelivery.updateMany({
      where: { id: payload.deliveryId, organizationId: job.organizationId },
      data: {
        status: failed ? "failed" : "retrying",
        errorCategory: failure.category,
        attempts: job.attempts,
      },
    });
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: failure ? "warn" : "info",
      operation: "job.processed",
      organizationId: job.organizationId,
      jobId: job.id,
      kind: job.kind,
      status,
      ...(failure ? { errorCategory: failure.category } : {}),
    }),
  );
  return true;
}
export async function maintainWorker(db: PrismaClient, id: string) {
  await db.workerHeartbeat.upsert({
    where: { id },
    create: { id },
    update: { updatedAt: new Date() },
  });
  await db.workerHeartbeat.deleteMany({
    where: { updatedAt: { lt: new Date(Date.now() - 86400000) } },
  });
  await db.rateBucket.deleteMany({
    where: { expiresAt: { lt: new Date(Date.now() - 60000) } },
  });
  await db.rateLimit.deleteMany({
    where: { lastRequest: { lt: BigInt(Date.now() - 86400000) } },
  });
  const domains = await db.customDomain.findMany({
    where: {
      status: "active",
      checkedAt: { lt: new Date(Date.now() - 12 * 3600000) },
    },
    take: 10,
  });
  for (const domain of domains) {
    let active = false;
    try {
      await publicAddresses(domain.hostname);
      const records = await boundedDns(resolveTxt(`_oqs.${domain.hostname}`));
      active = records.some((parts) =>
        equalSecret(parts.join(""), `v=OQS1;token=${domain.verifyToken}`),
      );
    } catch {
      /* DNS failures revoke verified routing until ownership is checked again. */
    }
    await db.customDomain.update({
      where: { id: domain.id },
      data: {
        status: active ? "active" : "error",
        checkedAt: new Date(),
        errorCategory: active ? null : "dns_verification_failed",
      },
    });
  }
}
