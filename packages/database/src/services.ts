import { createHash, randomUUID } from "node:crypto";
import {
  hasPermission,
  organizationInputSchema,
  contactSchema,
  EventBus,
  type DomainEvent,
  type Permission,
} from "@openquotestack/core";
import { parseDocument, type Answers } from "@openquotestack/schema";
import { calculateEstimate } from "@openquotestack/engine";
import { Prisma, type PrismaClient } from "./index";
export class AccessDeniedError extends Error {
  constructor() {
    super("Resource not found or access denied");
    this.name = "AccessDeniedError";
  }
}
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}
export type Actor = { userId: string };
type Transaction = Prisma.TransactionClient;
const json = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const canonical = (v: unknown): string =>
  Array.isArray(v)
    ? `[${v.map(canonical).join(",")}]`
    : v !== null && typeof v === "object"
      ? `{${Object.entries(v)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([k, value]) => `${JSON.stringify(k)}:${canonical(value)}`)
          .join(",")}}`
      : JSON.stringify(v);

/** Server-only services. Actor identifiers must come from a verified session. */
export function createServices(db: PrismaClient, events = new EventBus()) {
  async function authorize(
    tx: Transaction,
    actor: Actor,
    organizationId: string,
    permission: Permission,
  ) {
    const membership = await tx.membership.findUnique({
      where: {
        organizationId_userId: { organizationId, userId: actor.userId },
      },
    });
    if (!membership || !hasPermission(membership.role, permission))
      throw new AccessDeniedError();
    return membership;
  }
  async function transaction<T>(
    operation: (tx: Transaction, pending: DomainEvent[]) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const pending: DomainEvent[] = [];
      try {
        const result = await db.$transaction((tx) => operation(tx, pending), {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
        for (const event of pending) await events.publish(event);
        return result;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2034" &&
          attempt < 2
        )
          continue;
        throw error;
      }
    }
  }
  async function record(
    tx: Transaction,
    pending: DomainEvent[],
    actor: Actor,
    organizationId: string,
    name: DomainEvent["name"],
    resourceId: string,
  ) {
    await tx.auditEntry.create({
      data: { organizationId, actorId: actor.userId, action: name, resourceId },
    });
    pending.push({
      id: randomUUID(),
      name,
      organizationId,
      resourceId,
      actorId: actor.userId,
      occurredAt: new Date().toISOString(),
    });
  }
  return {
    async updateOrganization(
      actor: Actor,
      organizationId: string,
      input: unknown,
    ) {
      const data = organizationInputSchema.parse(input);
      if (
        Object.values(data.branding).some(
          (v) =>
            typeof v === "string" &&
            v.startsWith("/assets/") &&
            !v.startsWith(`/assets/${organizationId}/`),
        )
      )
        throw new AccessDeniedError();
      return transaction(async (tx) => {
        await authorize(tx, actor, organizationId, "organization.manage");
        return tx.organization.update({
          where: { id: organizationId },
          data: { ...data, branding: json(data.branding) },
        });
      });
    },
    async saveDraft(
      actor: Actor,
      organizationId: string,
      estimatorId: string,
      document: unknown,
      version: number,
    ) {
      const definition = parseDocument(document);
      return transaction(async (tx) => {
        await authorize(tx, actor, organizationId, "estimator.write");
        const updated = await tx.estimator.updateMany({
          where: {
            id: estimatorId,
            organizationId,
            deletedAt: null,
            draftVersion: version,
            status: { not: "archived" },
          },
          data: {
            draftDefinition: json(definition),
            draftVersion: { increment: 1 },
            name: definition.estimator.name,
          },
        });
        if (!updated.count)
          throw new ConflictError(
            "The draft changed in another window. Reload before saving.",
          );
        return version + 1;
      });
    },
    async publishDraft(
      actor: Actor,
      organizationId: string,
      estimatorId: string,
      version: number,
    ) {
      return transaction(async (tx, pending) => {
        await authorize(tx, actor, organizationId, "estimator.publish");
        const e = await tx.estimator.findFirst({
          where: { id: estimatorId, organizationId, deletedAt: null },
        });
        if (!e) throw new AccessDeniedError();
        if (e.draftVersion !== version || e.status === "archived")
          throw new ConflictError(
            "Save and reload the latest draft before publishing.",
          );
        const latest = await tx.estimatorRevision.findFirstOrThrow({
          where: { estimatorId, organizationId },
          orderBy: { number: "desc" },
        });
        const definition = parseDocument(
          e.draftDefinition ?? latest.definition,
        );
        const contentHash = createHash("sha256")
          .update(canonical(definition))
          .digest("hex");
        const revision =
          latest.contentHash === contentHash
            ? latest
            : await tx.estimatorRevision.create({
                data: {
                  estimatorId,
                  organizationId,
                  number: latest.number + 1,
                  definition: json(definition),
                  contentHash,
                  createdBy: actor.userId,
                },
              });
        await tx.estimator.update({
          where: { id: estimatorId },
          data: { status: "published", publishedRevisionId: revision.id },
        });
        await record(
          tx,
          pending,
          actor,
          organizationId,
          "estimator.published",
          revision.id,
        );
        return revision;
      });
    },
    async unpublishEstimator(
      actor: Actor,
      organizationId: string,
      estimatorId: string,
    ) {
      return transaction(async (tx) => {
        await authorize(tx, actor, organizationId, "estimator.publish");
        const e = await tx.estimator.findFirst({
          where: { id: estimatorId, organizationId, deletedAt: null },
        });
        if (!e) throw new AccessDeniedError();
        return tx.estimator.update({
          where: { id: e.id },
          data: { status: "draft", publishedRevisionId: null },
        });
      });
    },
    async deleteEstimator(
      actor: Actor,
      organizationId: string,
      estimatorId: string,
      confirmation: string,
    ) {
      return transaction(async (tx) => {
        await authorize(tx, actor, organizationId, "estimator.write");
        const e = await tx.estimator.findFirst({
          where: { id: estimatorId, organizationId, deletedAt: null },
        });
        if (!e) throw new AccessDeniedError();
        if (
          e.name !== confirmation ||
          (await tx.estimate.count({ where: { estimatorId, organizationId } }))
        )
          throw new ConflictError(
            "Confirm the name. Estimators with estimates must be archived.",
          );
        return tx.estimator.update({
          where: { id: e.id },
          data: { status: "archived", deletedAt: new Date() },
        });
      });
    },
    async listEstimates(
      actor: Actor,
      organizationId: string,
      estimatorId?: string,
    ) {
      return transaction(async (tx) => {
        await authorize(tx, actor, organizationId, "estimate.read");
        return tx.estimate.findMany({
          where: { organizationId, ...(estimatorId ? { estimatorId } : {}) },
          include: { lead: true, revision: { include: { estimator: true } } },
          orderBy: { createdAt: "desc" },
          take: 200,
        });
      });
    },
    async listLeads(actor: Actor, organizationId: string) {
      return transaction(async (tx) => {
        await authorize(tx, actor, organizationId, "estimate.read");
        return tx.lead.findMany({
          where: { organizationId },
          include: {
            estimate: {
              include: { revision: { include: { estimator: true } } },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 200,
        });
      });
    },
    async analytics(actor: Actor, organizationId: string) {
      return transaction(async (tx) => {
        await authorize(tx, actor, organizationId, "estimate.read");
        const since = new Date(Date.now() - 30 * 86400000);
        const sessions = await tx.quoteSession.findMany({
          where: { organizationId, createdAt: { gte: since } },
          select: {
            estimatorId: true,
            startedAt: true,
            completedAt: true,
            lastStep: true,
            revision: { select: { definition: true } },
          },
        });
        const estimates = await tx.estimate.findMany({
          where: { organizationId, createdAt: { gte: since } },
          select: {
            estimatorId: true,
            result: true,
            status: true,
            lead: { select: { id: true } },
          },
        });
        return { sessions, estimates, since: since.toISOString() };
      });
    },
    async updateEstimate(
      actor: Actor,
      organizationId: string,
      estimateId: string,
      status: string,
      note: string,
    ) {
      const allowed = [
        "new",
        "contacted",
        "qualified",
        "won",
        "lost",
        "archived",
      ];
      if (!allowed.includes(status) || note.length > 4000)
        throw new ConflictError("Invalid status or note");
      return transaction(async (tx, pending) => {
        await authorize(tx, actor, organizationId, "estimate.manage");
        const estimate = await tx.estimate.findFirst({
          where: { id: estimateId, organizationId },
        });
        if (!estimate) throw new AccessDeniedError();
        if (estimate.status !== status) {
          await tx.estimate.update({
            where: { id: estimateId },
            data: { status: status as "new" },
          });
          await tx.estimateActivity.create({
            data: {
              organizationId,
              estimateId,
              actorId: actor.userId,
              kind: "status",
              text: status,
            },
          });
          await record(
            tx,
            pending,
            actor,
            organizationId,
            "estimate.status_changed",
            estimateId,
          );
        }
        if (note.trim())
          await tx.estimateActivity.create({
            data: {
              organizationId,
              estimateId,
              actorId: actor.userId,
              kind: "note",
              text: note.trim(),
            },
          });
      });
    },
    async publicEstimator(slug: string, estimatorId: string) {
      const e = await db.estimator.findFirst({
        where: {
          id: estimatorId,
          status: "published",
          deletedAt: null,
          organization: { slug },
        },
        include: { publishedRevision: true, organization: true },
      });
      if (!e?.publishedRevision) throw new AccessDeniedError();
      return {
        id: e.id,
        organizationId: e.organizationId,
        revisionId: e.publishedRevision.id,
        definition: parseDocument(e.publishedRevision.definition),
        organization: {
          name: e.organization.name,
          slug: e.organization.slug,
          locale: e.organization.locale,
          branding: e.organization.branding,
        },
      };
    },
    async beginPublicSession(
      slug: string,
      estimatorId: string,
      revisionId: string,
    ) {
      return transaction(async (tx) => {
        const e = await tx.estimator.findFirst({
          where: {
            id: estimatorId,
            status: "published",
            deletedAt: null,
            publishedRevisionId: revisionId,
            organization: { slug },
          },
        });
        if (!e)
          throw new ConflictError(
            "This estimator was updated. Reload to use the latest version.",
          );
        return tx.quoteSession.create({
          data: {
            id: randomUUID(),
            organizationId: e.organizationId,
            estimatorId,
            revisionId,
          },
        });
      });
    },
    async progressPublicSession(sessionId: string, step: number) {
      if (!Number.isInteger(step) || step < 0 || step > 20)
        throw new ConflictError("Invalid step");
      return transaction(async (tx) => {
        const s = await tx.quoteSession.findUnique({
          where: { id: sessionId },
          include: { revision: { include: { estimator: true } } },
        });
        if (
          !s ||
          s.createdAt.getTime() < Date.now() - 86400000 ||
          s.revision.estimator.status !== "published" ||
          s.completedAt
        )
          throw new AccessDeniedError();
        const max = parseDocument(s.revision.definition).estimator.steps.length;
        if (step >= max) throw new ConflictError("Invalid step");
        return tx.quoteSession.update({
          where: { id: sessionId },
          data: {
            startedAt: s.startedAt ?? new Date(),
            lastStep: Math.max(s.lastStep, step),
          },
        });
      });
    },
    async submitPublicEstimate(
      sessionId: string,
      answers: Answers,
      contact?: unknown,
    ) {
      return transaction(async (tx, pending) => {
        const session = await tx.quoteSession.findUnique({
          where: { id: sessionId },
          include: {
            revision: { include: { estimator: true } },
            estimate: { include: { lead: true } },
          },
        });
        if (
          !session ||
          session.createdAt.getTime() < Date.now() - 86400000 ||
          session.revision.estimator.status !== "published" ||
          session.revision.estimator.deletedAt
        )
          throw new AccessDeniedError();
        if (session.estimate) return session.estimate;
        const definition = parseDocument(session.revision.definition).estimator;
        const details = contact ? contactSchema.parse(contact) : undefined;
        if (definition.leadCapture.mode === "before" && !details)
          throw new ConflictError(
            "Contact details are required before the result.",
          );
        const result = calculateEstimate(definition, answers);
        const estimate = await tx.estimate.create({
          data: {
            organizationId: session.organizationId,
            estimatorId: session.estimatorId,
            revisionId: session.revisionId,
            answers: json(result.metadata.answers),
            result: json(result),
            engineVersion: result.metadata.engineVersion,
            ...(details && definition.leadCapture.mode !== "disabled"
              ? {
                  lead: {
                    create: {
                      organization: { connect: { id: session.organizationId } },
                      ...details,
                    },
                  },
                }
              : {}),
          },
          include: { lead: true },
        });
        await tx.quoteSession.update({
          where: { id: sessionId },
          data: {
            startedAt: session.startedAt ?? new Date(),
            completedAt: new Date(),
            lastStep: definition.steps.length - 1,
            estimateId: estimate.id,
          },
        });
        await record(
          tx,
          pending,
          { userId: "public" },
          session.organizationId,
          "estimate.completed",
          estimate.id,
        );
        if (estimate.lead)
          await record(
            tx,
            pending,
            { userId: "public" },
            session.organizationId,
            "lead.created",
            estimate.lead.id,
          );
        return estimate;
      });
    },
    async capturePublicLead(sessionId: string, contact: unknown) {
      const data = contactSchema.parse(contact);
      return transaction(async (tx, pending) => {
        const s = await tx.quoteSession.findUnique({
          where: { id: sessionId },
          include: { revision: true },
        });
        if (
          !s?.estimateId ||
          s.createdAt.getTime() < Date.now() - 86400000 ||
          parseDocument(s.revision.definition).estimator.leadCapture.mode ===
            "disabled"
        )
          throw new AccessDeniedError();
        const existing = await tx.lead.findUnique({
          where: { estimateId: s.estimateId },
        });
        if (existing) return existing;
        const lead = await tx.lead.create({
          data: {
            organizationId: s.organizationId,
            estimateId: s.estimateId,
            ...data,
          },
        });
        await record(
          tx,
          pending,
          { userId: "public" },
          s.organizationId,
          "lead.created",
          lead.id,
        );
        return lead;
      });
    },
    async createOrganization(actor: Actor, input: unknown) {
      const data = organizationInputSchema.parse(input);
      return transaction(async (tx) => {
        if (!(await tx.user.findUnique({ where: { id: actor.userId } })))
          throw new AccessDeniedError();
        return tx.organization.create({
          data: {
            ...data,
            branding: json(data.branding),
            memberships: { create: { userId: actor.userId, role: "owner" } },
          },
        });
      });
    },
    async getRole(actor: Actor, organizationId: string) {
      return transaction(
        async (tx) =>
          (await authorize(tx, actor, organizationId, "estimator.read")).role,
      );
    },
    async listOrganizations(actor: Actor) {
      return db.organization.findMany({
        where: { memberships: { some: { userId: actor.userId } } },
        orderBy: { createdAt: "asc" },
      });
    },
    async getOrganization(actor: Actor, organizationId: string) {
      return transaction(async (tx) => {
        await authorize(tx, actor, organizationId, "estimator.read");
        return tx.organization.findUniqueOrThrow({
          where: { id: organizationId },
        });
      });
    },
    async listEstimators(actor: Actor, organizationId: string) {
      return transaction(async (tx) => {
        await authorize(tx, actor, organizationId, "estimator.read");
        return tx.estimator.findMany({
          where: { organizationId, deletedAt: null },
          include: {
            publishedRevision: true,
            revisions: { orderBy: { number: "desc" }, take: 1 },
          },
          orderBy: { createdAt: "desc" },
        });
      });
    },
    async getEstimator(
      actor: Actor,
      organizationId: string,
      estimatorId: string,
    ) {
      return transaction(async (tx) => {
        await authorize(tx, actor, organizationId, "estimator.read");
        const e = await tx.estimator.findFirst({
          where: { id: estimatorId, organizationId, deletedAt: null },
          include: { revisions: { orderBy: { number: "desc" } } },
        });
        if (!e) throw new AccessDeniedError();
        return e;
      });
    },
    async createEstimator(
      actor: Actor,
      organizationId: string,
      document: unknown,
    ) {
      const definition = parseDocument(document);
      return transaction(async (tx, pending) => {
        await authorize(tx, actor, organizationId, "estimator.write");
        const estimator = await tx.estimator.create({
          data: {
            organizationId,
            name: definition.estimator.name,
            draftDefinition: json(definition),
          },
        });
        const revision = await tx.estimatorRevision.create({
          data: {
            organizationId,
            estimatorId: estimator.id,
            number: 1,
            definition: json(definition),
            contentHash: createHash("sha256")
              .update(canonical(definition))
              .digest("hex"),
            createdBy: actor.userId,
          },
        });
        await record(
          tx,
          pending,
          actor,
          organizationId,
          "estimator.created",
          estimator.id,
        );
        await record(
          tx,
          pending,
          actor,
          organizationId,
          "estimator.revision_created",
          revision.id,
        );
        return { estimator, revision };
      });
    },
    async createRevision(
      actor: Actor,
      organizationId: string,
      estimatorId: string,
      document: unknown,
    ) {
      const definition = parseDocument(document);
      return transaction(async (tx, pending) => {
        await authorize(tx, actor, organizationId, "estimator.write");
        const estimator = await tx.estimator.findFirst({
          where: { id: estimatorId, organizationId, deletedAt: null },
        });
        if (!estimator) throw new AccessDeniedError();
        if (estimator.status === "archived")
          throw new ConflictError(
            "Archived estimators cannot receive revisions",
          );
        await tx.estimator.update({
          where: { id: estimatorId },
          data: { updatedAt: new Date() },
        });
        const last = await tx.estimatorRevision.findFirst({
          where: { estimatorId, organizationId },
          orderBy: { number: "desc" },
        });
        const revision = await tx.estimatorRevision.create({
          data: {
            organizationId,
            estimatorId,
            number: (last?.number ?? 0) + 1,
            definition: json(definition),
            contentHash: createHash("sha256")
              .update(canonical(definition))
              .digest("hex"),
            createdBy: actor.userId,
          },
        });
        await record(
          tx,
          pending,
          actor,
          organizationId,
          "estimator.revision_created",
          revision.id,
        );
        return revision;
      });
    },
    async publishRevision(
      actor: Actor,
      organizationId: string,
      estimatorId: string,
      revisionId: string,
    ) {
      return transaction(async (tx, pending) => {
        await authorize(tx, actor, organizationId, "estimator.publish");
        const revision = await tx.estimatorRevision.findFirst({
          where: { id: revisionId, estimatorId, organizationId },
        });
        if (!revision) throw new AccessDeniedError();
        const estimator = await tx.estimator.update({
          where: { id_organizationId: { id: estimatorId, organizationId } },
          data: { publishedRevisionId: revision.id, status: "published" },
        });
        await record(
          tx,
          pending,
          actor,
          organizationId,
          "estimator.published",
          revision.id,
        );
        return estimator;
      });
    },
    async archiveEstimator(
      actor: Actor,
      organizationId: string,
      estimatorId: string,
    ) {
      return transaction(async (tx) => {
        await authorize(tx, actor, organizationId, "estimator.write");
        const found = await tx.estimator.findFirst({
          where: { id: estimatorId, organizationId, deletedAt: null },
        });
        if (!found) throw new AccessDeniedError();
        return tx.estimator.update({
          where: { id: found.id },
          data: { status: "archived" },
        });
      });
    },
    async createEstimate(
      actor: Actor,
      organizationId: string,
      estimatorId: string,
      answers: Answers,
    ) {
      return transaction(async (tx, pending) => {
        await authorize(tx, actor, organizationId, "estimate.create");
        const estimator = await tx.estimator.findFirst({
          where: { id: estimatorId, organizationId, deletedAt: null },
          include: { publishedRevision: true },
        });
        if (!estimator) throw new AccessDeniedError();
        if (estimator.status !== "published" || !estimator.publishedRevision)
          throw new ConflictError("Estimator has no active published revision");
        const revision = estimator.publishedRevision;
        const result = calculateEstimate(
          parseDocument(revision.definition).estimator,
          answers,
        );
        const estimate = await tx.estimate.create({
          data: {
            organizationId,
            estimatorId,
            revisionId: revision.id,
            answers: json(result.metadata.answers),
            result: json(result),
            engineVersion: result.metadata.engineVersion,
          },
        });
        await record(
          tx,
          pending,
          actor,
          organizationId,
          "estimate.completed",
          estimate.id,
        );
        return estimate;
      });
    },
    async getEstimate(
      actor: Actor,
      organizationId: string,
      estimateId: string,
    ) {
      return transaction(async (tx) => {
        await authorize(tx, actor, organizationId, "estimate.read");
        const estimate = await tx.estimate.findFirst({
          where: { id: estimateId, organizationId },
          include: {
            revision: true,
            lead: true,
            activities: { orderBy: { createdAt: "desc" } },
          },
        });
        if (!estimate) throw new AccessDeniedError();
        return estimate;
      });
    },
  };
}
