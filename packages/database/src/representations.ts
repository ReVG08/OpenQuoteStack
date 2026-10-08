import { parseDocument, type Answers } from "@openquotestack/schema";
import type { EstimateResult } from "@openquotestack/engine";
import type {
  Estimator,
  EstimatorRevision,
  Estimate,
  Lead,
  WebhookEndpoint,
} from "./generated/prisma/client";
export function estimatorSummary(
  e: Estimator & {
    publishedRevision: Pick<EstimatorRevision, "id" | "number"> | null;
  },
) {
  return {
    id: e.id,
    name: e.name,
    status: e.status,
    updatedAt: e.updatedAt.toISOString(),
    publishedRevision: e.publishedRevision
      ? { id: e.publishedRevision.id, number: e.publishedRevision.number }
      : null,
  };
}
export function estimatorResource(
  e: Estimator & { publishedRevision: EstimatorRevision | null },
) {
  return {
    id: e.id,
    name: e.name,
    status: e.status,
    updatedAt: e.updatedAt.toISOString(),
    publishedRevision: e.publishedRevision
      ? {
          id: e.publishedRevision.id,
          number: e.publishedRevision.number,
          definition: parseDocument(e.publishedRevision.definition),
        }
      : null,
  };
}
export function estimateResource(
  e: Estimate & {
    revision: Pick<EstimatorRevision, "id" | "number">;
    lead: Pick<Lead, "id"> | null;
  },
) {
  return {
    id: e.id,
    estimatorId: e.estimatorId,
    revision: { id: e.revision.id, number: e.revision.number },
    status: e.status,
    createdAt: e.createdAt.toISOString(),
    answers: e.answers as Answers,
    result: e.result as unknown as EstimateResult,
    leadId: e.lead?.id ?? null,
  };
}
export function leadResource(l: Lead) {
  return {
    id: l.id,
    estimateId: l.estimateId,
    name: l.name,
    email: l.email,
    ...(l.phone ? { phone: l.phone } : {}),
    ...(l.company ? { company: l.company } : {}),
    ...(l.address ? { address: l.address } : {}),
    ...(l.notes ? { notes: l.notes } : {}),
    createdAt: l.createdAt.toISOString(),
  };
}
export function webhookResource(w: WebhookEndpoint) {
  return {
    id: w.id,
    url: w.url,
    subscriptions: w.subscriptions,
    active: w.active,
    createdAt: w.createdAt.toISOString(),
  };
}

export function estimateSummary(e: Parameters<typeof estimateResource>[0]) {
  const result = e.result as unknown as EstimateResult;
  return {
    id: e.id,
    estimatorId: e.estimatorId,
    revision: { id: e.revision.id, number: e.revision.number },
    status: e.status,
    createdAt: e.createdAt.toISOString(),
    leadId: e.lead?.id ?? null,
    currency: result.currency,
    minorUnits: result.minorUnits,
    totalMinor: result.totalMinor,
    ...(result.range ? { range: result.range } : {}),
  };
}
