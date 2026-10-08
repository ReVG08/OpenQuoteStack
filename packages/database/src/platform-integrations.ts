import { contactSchema } from "@openquotestack/core";
import { audit, authorize, serializable } from "./access";
import { smtpConfigured } from "./email";
import { type PrismaClient } from "./index";
import { enqueueEvent } from "./outbox";
import {
  consumeRate as consume,
  createAdmin,
  json,
  PlatformError,
} from "./platform-context";
import { embeddingInput, notificationsInput } from "./platform-validation";
import { leadResource } from "./representations";
import { AccessDeniedError, type Actor } from "./services";
export function integrationsServices(db: PrismaClient) {
  const admin = createAdmin(db);
  const consumeRate = (key: string, limit: number) => consume(db, key, limit);
  return {
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
