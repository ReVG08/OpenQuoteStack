import { randomBytes } from "node:crypto";
import { audit, serializable } from "./access";
import { encryptSecret } from "./crypto";
import { type PrismaClient } from "./index";
import { publicAddresses, webhookUrl } from "./network";
import {
  createAdmin,
  PlatformError,
  requireScope,
  type ApiPrincipal,
} from "./platform-context";
import { webhookInput } from "./platform-validation";
import { webhookResource } from "./representations";
import { AccessDeniedError, ConflictError, type Actor } from "./services";
export function webhooksServices(db: PrismaClient) {
  const admin = createAdmin(db);
  return {
    async createWebhook(actor: Actor, org: string, input: unknown) {
      const data = webhookInput.parse(input),
        url = webhookUrl(data.url);
      await admin(actor, org, async () => {});
      await publicAddresses(url.hostname);
      const secret = `whsec_${randomBytes(32).toString("hex")}`;
      const endpoint = await admin(actor, org, async (tx) => {
        if (
          (await tx.webhookEndpoint.count({
            where: { organizationId: org, active: true },
          })) >= 20
        )
          throw new ConflictError("Webhook limit reached");
        const row = await tx.webhookEndpoint.create({
          data: {
            ...data,
            organizationId: org,
            secretEncrypted: encryptSecret(secret),
          },
        });
        await audit(tx, actor, org, "webhook.created", row.id, {
          subscriptions: data.subscriptions,
        });
        return webhookResource(row);
      });
      return { ...endpoint, secret };
    },
    async listWebhooks(actor: Actor, org: string) {
      return admin(actor, org, async (tx) => ({
        endpoints: (
          await tx.webhookEndpoint.findMany({
            where: { organizationId: org },
            orderBy: { createdAt: "desc" },
            take: 50,
          })
        ).map(webhookResource),
        deliveries: await tx.webhookDelivery.findMany({
          where: { organizationId: org },
          orderBy: { createdAt: "desc" },
          take: 100,
          select: {
            id: true,
            endpointId: true,
            eventId: true,
            status: true,
            attempts: true,
            responseCode: true,
            durationMs: true,
            errorCategory: true,
            createdAt: true,
          },
        }),
      }));
    },
    async deactivateWebhook(actor: Actor, org: string, id: string) {
      return admin(actor, org, async (tx) => {
        const row = await tx.webhookEndpoint.updateMany({
          where: { id, organizationId: org },
          data: { active: false },
        });
        if (!row.count) throw new AccessDeniedError();
        await audit(tx, actor, org, "webhook.disabled", id);
      });
    },
    async retryWebhook(actor: Actor, org: string, id: string) {
      return admin(actor, org, async (tx) => {
        const delivery = await tx.webhookDelivery.findFirst({
          where: { id, organizationId: org, status: "failed" },
          include: { endpoint: true },
        });
        if (!delivery?.endpoint.active)
          throw new ConflictError(
            "Only failed active deliveries can be retried",
          );
        await tx.webhookDelivery.update({
          where: { id },
          data: { status: "pending", attempts: 0 },
        });
        await tx.backgroundJob.updateMany({
          where: {
            organizationId: org,
            dedupeKey: `webhook:${id}`,
            status: "failed",
          },
          data: {
            status: "pending",
            attempts: 0,
            availableAt: new Date(),
            lockedUntil: null,
            lockToken: null,
          },
        });
        await audit(tx, actor, org, "webhook.retried", id);
      });
    },
    async apiWebhooks(
      principal: ApiPrincipal,
      operation: "list" | "create" | "disable",
      input: unknown,
    ) {
      requireScope(principal, "webhooks:manage");
      const org = principal.organizationId,
        actor = { userId: `api:${principal.keyId}` };
      let data: ReturnType<typeof webhookInput.parse> | undefined;
      if (operation === "create") {
        data = webhookInput.parse(input);
        try {
          await publicAddresses(webhookUrl(data.url).hostname);
        } catch {
          throw new PlatformError(
            "invalid_request",
            422,
            "A public HTTPS webhook destination is required.",
          );
        }
      }
      return serializable(db, async (tx) => {
        const key = await tx.apiKey.findFirst({
          where: {
            id: principal.keyId,
            organizationId: org,
            revokedAt: null,
            scopes: { has: "webhooks:manage" },
          },
        });
        if (!key)
          throw new PlatformError(
            "forbidden",
            403,
            "Webhook scope is required.",
          );
        if (operation === "list")
          return {
            data: (
              await tx.webhookEndpoint.findMany({
                where: { organizationId: org },
                orderBy: { createdAt: "desc" },
                take: 100,
              })
            ).map(webhookResource),
          };
        if (operation === "disable") {
          const changed = await tx.webhookEndpoint.updateMany({
            where: { id: String(input), organizationId: org },
            data: { active: false },
          });
          if (!changed.count)
            throw new PlatformError(
              "not_found",
              404,
              "Webhook endpoint not found.",
            );
          await audit(tx, actor, org, "webhook.disabled", String(input));
          return { data: { id: String(input), active: false } };
        }
        if (
          (await tx.webhookEndpoint.count({
            where: { organizationId: org, active: true },
          })) >= 20
        )
          throw new PlatformError("conflict", 409, "Webhook limit reached.");
        const secret = `whsec_${randomBytes(32).toString("hex")}`;
        const row = await tx.webhookEndpoint.create({
          data: {
            ...data!,
            organizationId: org,
            secretEncrypted: encryptSecret(secret),
          },
        });
        await audit(tx, actor, org, "webhook.created", row.id);
        return { data: { ...webhookResource(row), secret } };
      });
    },
  };
}
