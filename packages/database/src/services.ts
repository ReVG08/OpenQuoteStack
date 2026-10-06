import { createHash, randomUUID } from "node:crypto";
import {
  hasPermission,
  organizationInputSchema,
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
          where: { organizationId },
          include: { revisions: { orderBy: { number: "desc" }, take: 1 } },
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
          where: { id: estimatorId, organizationId },
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
          data: { organizationId, name: definition.estimator.name },
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
          where: { id: estimatorId, organizationId },
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
          where: { id: estimatorId, organizationId },
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
          where: { id: estimatorId, organizationId },
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
          include: { revision: true },
        });
        if (!estimate) throw new AccessDeniedError();
        return estimate;
      });
    },
  };
}
