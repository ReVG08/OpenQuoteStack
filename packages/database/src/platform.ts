import { randomBytes, createHash } from "node:crypto";
import { resolveTxt } from "node:dns/promises";
import { z } from "zod";
import { contactSchema } from "@openquotestack/core";
import {
  parseDocument,
  answerSchema,
  assertDataBudget,
  type Answers,
} from "@openquotestack/schema";
import { calculateEstimate } from "@openquotestack/engine";
import { type PrismaClient, type Prisma } from "./index";
import { AccessDeniedError, ConflictError, type Actor } from "./services";
import { authorize, serializable, audit } from "./access";
import {
  keyInput,
  webhookInput,
  notificationsInput,
  embeddingInput,
  type ApiScope,
} from "./platform-validation";
import { secretHash, encryptSecret, equalSecret } from "./crypto";
import {
  webhookUrl,
  publicAddresses,
  publicHostname,
  boundedDns,
} from "./network";
import { smtpConfigured } from "./email";
import { enqueueEvent } from "./outbox";
import {
  estimatorResource,
  estimateResource,
  leadResource,
  webhookResource,
} from "./representations";
export class PlatformError extends Error {
  constructor(
    public code:
      | "unauthorized"
      | "forbidden"
      | "rate_limited"
      | "not_found"
      | "invalid_request"
      | "conflict",
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export type ApiPrincipal = {
  keyId: string;
  organizationId: string;
  scopes: string[];
};
export function requireScope(principal: ApiPrincipal, scope: ApiScope) {
  if (!principal.scopes.includes(scope))
    throw new PlatformError(
      "forbidden",
      403,
      "The API key does not grant this scope.",
    );
}
export const paginationInput = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{1,100}$/)
    .optional(),
});
const json = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value));
const createEstimateInput = z.strictObject({
  estimatorId: z.string().min(1).max(100),
  revisionId: z.string().max(100).optional(),
  answers: z.record(z.string().max(100), answerSchema),
  contact: contactSchema.optional(),
});
export function createPlatform(db: PrismaClient) {
  const admin = <T>(
    actor: Actor,
    org: string,
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ) =>
    serializable(db, async (tx) => {
      await authorize(tx, actor, org, "organization.manage");
      return operation(tx);
    });
  async function consumeRate(key: string, limit: number) {
    const expiresAt = new Date(Math.ceil((Date.now() + 1) / 60000) * 60000);
    const bucket = `${key}:${expiresAt.getTime()}`;
    const [row] = await db.$queryRaw<
      { count: number }[]
    >`INSERT INTO "RateBucket" ("key","count","expiresAt") VALUES (${bucket},1,${expiresAt}) ON CONFLICT ("key") DO UPDATE SET "count"="RateBucket"."count"+1 RETURNING "count"`;
    if (!row || row.count > limit)
      throw new PlatformError(
        "rate_limited",
        429,
        "Request limit exceeded. Retry in one minute.",
      );
  }
  return {
    consumeRate,
    async authenticate(secret: string): Promise<ApiPrincipal> {
      if (!/^oqs_[a-f0-9]{64}$/.test(secret))
        throw new PlatformError(
          "unauthorized",
          401,
          "A valid bearer API key is required.",
        );
      const key = await db.apiKey.findUnique({
        where: { secretHash: secretHash(secret) },
      });
      if (!key || key.revokedAt)
        throw new PlatformError(
          "unauthorized",
          401,
          "A valid bearer API key is required.",
        );
      await consumeRate(`api:${key.id}`, 120);
      if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > 60000)
        await db.apiKey.updateMany({
          where: { id: key.id, revokedAt: null },
          data: { lastUsedAt: new Date() },
        });
      return {
        keyId: key.id,
        organizationId: key.organizationId,
        scopes: key.scopes,
      };
    },
    async createKey(actor: Actor, org: string, input: unknown) {
      const data = keyInput.parse(input),
        secret = `oqs_${randomBytes(32).toString("hex")}`;
      const key = await admin(actor, org, async (tx) => {
        if (
          (await tx.apiKey.count({
            where: { organizationId: org, revokedAt: null },
          })) >= 50
        )
          throw new ConflictError("API key limit reached");
        const row = await tx.apiKey.create({
          data: {
            ...data,
            organizationId: org,
            prefix: secret.slice(0, 12),
            secretHash: secretHash(secret),
          },
        });
        await audit(tx, actor, org, "api_key.created", row.id, {
          scopes: data.scopes,
        });
        return {
          id: row.id,
          name: row.name,
          prefix: row.prefix,
          scopes: row.scopes,
          createdAt: row.createdAt.toISOString(),
        };
      });
      return { ...key, secret };
    },
    async listKeys(actor: Actor, org: string) {
      return admin(actor, org, (tx) =>
        tx.apiKey.findMany({
          where: { organizationId: org },
          orderBy: { createdAt: "desc" },
          take: 100,
          select: {
            id: true,
            name: true,
            description: true,
            prefix: true,
            scopes: true,
            createdAt: true,
            lastUsedAt: true,
            revokedAt: true,
          },
        }),
      );
    },
    async revokeKey(actor: Actor, org: string, id: string) {
      return admin(actor, org, async (tx) => {
        const changed = await tx.apiKey.updateMany({
          where: { id, organizationId: org, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        if (!changed.count) throw new AccessDeniedError();
        await audit(tx, actor, org, "api_key.revoked", id);
      });
    },
    async listResources(
      principal: ApiPrincipal,
      resource: "estimators" | "estimates" | "leads",
      query: unknown,
    ) {
      requireScope(
        principal,
        resource === "estimators"
          ? "estimators:read"
          : resource === "estimates"
            ? "estimates:read"
            : "leads:read",
      );
      const { limit, cursor } = paginationInput.parse(query),
        organizationId = principal.organizationId;
      const args = {
        where: { organizationId, ...(cursor ? { id: { lt: cursor } } : {}) },
        orderBy: { id: "desc" as const },
        take: limit + 1,
      };
      const rows =
        resource === "estimators"
          ? (
              await db.estimator.findMany({
                ...args,
                where: { ...args.where, deletedAt: null },
                include: { publishedRevision: true },
              })
            ).map(estimatorResource)
          : resource === "estimates"
            ? (
                await db.estimate.findMany({
                  ...args,
                  include: { revision: true, lead: true },
                })
              ).map(estimateResource)
            : (await db.lead.findMany(args)).map(leadResource);
      return {
        data: rows.slice(0, limit),
        pagination: {
          nextCursor: rows.length > limit ? rows[limit - 1]!.id : null,
          limit,
        },
      };
    },
    async getResource(
      principal: ApiPrincipal,
      resource: "estimators" | "estimates" | "leads",
      id: string,
    ) {
      requireScope(
        principal,
        resource === "estimators"
          ? "estimators:read"
          : resource === "estimates"
            ? "estimates:read"
            : "leads:read",
      );
      const where = { id, organizationId: principal.organizationId };
      if (resource === "estimators") {
        const row = await db.estimator.findFirst({
          where: { ...where, deletedAt: null },
          include: { publishedRevision: true },
        });
        if (row) return estimatorResource(row);
      } else if (resource === "estimates") {
        const row = await db.estimate.findFirst({
          where,
          include: { revision: true, lead: true },
        });
        if (row) return estimateResource(row);
      } else {
        const row = await db.lead.findFirst({ where });
        if (row) return leadResource(row);
      }
      throw new PlatformError("not_found", 404, "Resource not found.");
    },
    async submitEstimate(
      principal: ApiPrincipal,
      input: unknown,
      requestKey: string,
    ) {
      requireScope(principal, "estimates:write");
      try {
        assertDataBudget(input);
      } catch {
        throw new PlatformError(
          "invalid_request",
          422,
          "The request exceeds the supported data limits.",
        );
      }
      const data = createEstimateInput.parse(input);
      if (!/^[a-zA-Z0-9_-]{16,100}$/.test(requestKey))
        throw new PlatformError(
          "invalid_request",
          400,
          "Idempotency-Key must contain 16–100 letters, digits, hyphens or underscores.",
        );
      const requestHash = createHash("sha256")
        .update(JSON.stringify(data))
        .digest("hex");
      return serializable(db, async (tx) => {
        const currentKey = await tx.apiKey.findFirst({
          where: {
            id: principal.keyId,
            organizationId: principal.organizationId,
            revokedAt: null,
          },
        });
        if (!currentKey || !currentKey.scopes.includes("estimates:write"))
          throw new PlatformError(
            "unauthorized",
            401,
            "API key is no longer active.",
          );
        const existing = await tx.apiSubmission.findUnique({
          where: { keyId_requestKey: { keyId: principal.keyId, requestKey } },
        });
        if (existing) {
          if (existing.requestHash !== requestHash)
            throw new PlatformError(
              "conflict",
              409,
              "Idempotency key was already used with different data.",
            );
          const saved = await tx.estimate.findFirstOrThrow({
            where: {
              id: existing.estimateId,
              organizationId: principal.organizationId,
            },
            include: { revision: true, lead: true },
          });
          return { estimate: estimateResource(saved), replayed: true };
        }
        const e = await tx.estimator.findFirst({
          where: {
            id: data.estimatorId,
            organizationId: principal.organizationId,
            status: "published",
            deletedAt: null,
          },
          include: { publishedRevision: true },
        });
        if (!e?.publishedRevision)
          throw new PlatformError(
            "not_found",
            404,
            "Published estimator not found.",
          );
        const revision = e.publishedRevision;
        if (data.revisionId && data.revisionId !== revision.id)
          throw new PlatformError(
            "conflict",
            409,
            "The published revision changed.",
          );
        const definition = parseDocument(revision.definition).estimator;
        if (definition.leadCapture.mode === "before" && !data.contact)
          throw new PlatformError(
            "invalid_request",
            422,
            "Contact is required by this estimator.",
          );
        const result = calculateEstimate(definition, data.answers as Answers);
        const quote = await tx.estimate.create({
          data: {
            organizationId: principal.organizationId,
            estimatorId: e.id,
            revisionId: revision.id,
            answers: json(result.metadata.answers),
            result: json(result),
            engineVersion: result.metadata.engineVersion,
            ...(data.contact && definition.leadCapture.mode !== "disabled"
              ? {
                  lead: {
                    create: {
                      organization: {
                        connect: { id: principal.organizationId },
                      },
                      ...data.contact,
                    },
                  },
                }
              : {}),
          },
          include: { revision: true, lead: true },
        });
        await tx.apiSubmission.create({
          data: {
            organizationId: principal.organizationId,
            keyId: principal.keyId,
            requestKey,
            requestHash,
            estimateId: quote.id,
          },
        });
        const actor = { userId: `api:${principal.keyId}` };
        await audit(
          tx,
          actor,
          principal.organizationId,
          "estimate.completed",
          quote.id,
        );
        await enqueueEvent(
          tx,
          principal.organizationId,
          "estimate.completed",
          quote.id,
        );
        if (quote.lead)
          await enqueueEvent(
            tx,
            principal.organizationId,
            "lead.created",
            quote.lead.id,
          );
        return { estimate: estimateResource(quote), replayed: false };
      });
    },
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
    async settings(actor: Actor, org: string) {
      return admin(actor, org, (tx) =>
        tx.organization.findUniqueOrThrow({
          where: { id: org },
          select: { notifications: true, embedOrigins: true },
        }),
      );
    },
    async updateSettings(
      actor: Actor,
      org: string,
      input: { notifications: unknown; embedOrigins: unknown },
    ) {
      const notifications = notificationsInput.parse(input.notifications),
        embedOrigins = embeddingInput.parse(input.embedOrigins);
      return admin(actor, org, async (tx) => {
        await tx.organization.update({
          where: { id: org },
          data: { notifications: json(notifications), embedOrigins },
        });
        await audit(tx, actor, org, "organization.integrations_updated", org);
      });
    },
    async listDomains(actor: Actor, org: string) {
      return admin(actor, org, (tx) =>
        tx.customDomain.findMany({
          where: { organizationId: org },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            hostname: true,
            status: true,
            errorCategory: true,
            verifyToken: true,
            createdAt: true,
            checkedAt: true,
          },
        }),
      );
    },
    async createDomain(actor: Actor, org: string, hostname: string) {
      const host = publicHostname(hostname),
        verifyToken = `oqs_domain_${randomBytes(24).toString("hex")}`;
      return admin(actor, org, async (tx) => {
        if (
          (await tx.customDomain.count({ where: { organizationId: org } })) >=
          10
        )
          throw new ConflictError("Domain limit reached");
        const row = await tx.customDomain.create({
          data: { organizationId: org, hostname: host, verifyToken },
        });
        await audit(tx, actor, org, "domain.created", row.id);
        return row;
      });
    },
    async verifyDomain(actor: Actor, org: string, id: string) {
      const domain = await admin(actor, org, async (tx) => {
        const d = await tx.customDomain.findFirst({
          where: { id, organizationId: org },
        });
        if (!d) throw new AccessDeniedError();
        return d;
      });
      let active = false;
      try {
        await publicAddresses(domain.hostname);
        const records = await boundedDns(resolveTxt(`_oqs.${domain.hostname}`));
        active = records.some((parts) =>
          equalSecret(parts.join(""), `v=OQS1;token=${domain.verifyToken}`),
        );
      } catch {
        /* Verification failures are persisted below without resolver details. */
      }
      return admin(actor, org, async (tx) => {
        const row = await tx.customDomain.update({
          where: { id: domain.id },
          data: {
            status: active ? "active" : "error",
            errorCategory: active ? null : "dns_verification_failed",
            verifiedAt: active ? new Date() : null,
            checkedAt: new Date(),
          },
        });
        await audit(tx, actor, org, "domain.verified", id, { active });
        return row;
      });
    },
    async removeDomain(actor: Actor, org: string, id: string) {
      return admin(actor, org, async (tx) => {
        const row = await tx.customDomain.deleteMany({
          where: { id, organizationId: org },
        });
        if (!row.count) throw new AccessDeniedError();
        await audit(tx, actor, org, "domain.removed", id);
      });
    },
    async auditLog(actor: Actor, org: string) {
      return admin(actor, org, (tx) =>
        tx.auditEntry.findMany({
          where: { organizationId: org },
          orderBy: { createdAt: "desc" },
          take: 200,
        }),
      );
    },
    async updateLead(actor: Actor, org: string, id: string, input: unknown) {
      const data = contactSchema.parse(input);
      return serializable(db, async (tx) => {
        await authorize(tx, actor, org, "estimate.manage");
        const row = await tx.lead.findFirst({
          where: { id, organizationId: org },
        });
        if (!row) throw new AccessDeniedError();
        const updated = await tx.lead.update({ where: { id }, data });
        await audit(tx, actor, org, "lead.updated", id);
        await enqueueEvent(tx, org, "lead.updated", id);
        return leadResource(updated);
      });
    },
    async sendEstimate(actor: Actor, org: string, id: string) {
      await db.$transaction((tx) =>
        authorize(tx, actor, org, "estimate.manage"),
      );
      if (!smtpConfigured())
        throw new PlatformError(
          "invalid_request",
          422,
          "SMTP is not configured.",
        );
      await consumeRate(`email:${org}`, 20);
      return serializable(db, async (tx) => {
        await authorize(tx, actor, org, "estimate.manage");
        const quote = await tx.estimate.findFirst({
          where: { id, organizationId: org },
          include: { lead: true },
        });
        if (!quote?.lead) throw new AccessDeniedError();
        const row = await tx.backgroundJob.create({
          data: {
            organizationId: org,
            kind: "email",
            dedupeKey: `manual-email:${crypto.randomUUID()}`,
            payload: {
              estimateId: id,
              recipient: quote.lead.email,
              kind: "confirmation",
            },
          },
        });
        await audit(tx, actor, org, "estimate.email_queued", id);
        return row.id;
      });
    },
  };
}
