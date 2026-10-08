import { calculateEstimate } from "@openquotestack/engine";
import {
  assertDataBudget,
  parseDocument,
  type Answers,
} from "@openquotestack/schema";
import { createHash } from "node:crypto";
import { audit, serializable } from "./access";
import { type PrismaClient } from "./index";
import { enqueueEvent } from "./outbox";
import {
  createEstimateInput,
  json,
  paginationInput,
  PlatformError,
  requireScope,
  type ApiPrincipal,
} from "./platform-context";
import {
  estimateResource,
  estimateSummary,
  estimatorSummary,
  estimatorResource,
  leadResource,
} from "./representations";
export function resourcesServices(db: PrismaClient) {
  return {
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
                include: {
                  publishedRevision: { select: { id: true, number: true } },
                },
              })
            ).map(estimatorSummary)
          : resource === "estimates"
            ? (
                await db.estimate.findMany({
                  ...args,
                  include: {
                    revision: { select: { id: true, number: true } },
                    lead: { select: { id: true } },
                  },
                })
              ).map(estimateSummary)
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
          include: {
            revision: { select: { id: true, number: true } },
            lead: { select: { id: true } },
          },
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
            include: {
              revision: { select: { id: true, number: true } },
              lead: { select: { id: true } },
            },
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
          include: {
            revision: { select: { id: true, number: true } },
            lead: { select: { id: true } },
          },
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
  };
}
