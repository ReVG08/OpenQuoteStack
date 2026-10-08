import type { Answers, EstimatorDocument } from "@openquotestack/schema";
import type { EstimateResult } from "@openquotestack/engine";
export const apiScopes = [
  "estimators:read",
  "estimates:read",
  "estimates:write",
  "leads:read",
  "webhooks:manage",
] as const;
export type ApiScope = (typeof apiScopes)[number];
export const webhookEvents = [
  "estimate.created",
  "estimate.completed",
  "lead.created",
  "lead.updated",
  "estimate.status_changed",
  "estimator.published",
] as const;
export type WebhookEventName = (typeof webhookEvents)[number];
export type Contact = {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  address?: string;
  notes?: string;
};
export type EstimatorResource = {
  id: string;
  name: string;
  status: "draft" | "published" | "archived";
  updatedAt: string;
  publishedRevision: {
    id: string;
    number: number;
    definition: EstimatorDocument;
  } | null;
};
export type EstimateResource = {
  id: string;
  estimatorId: string;
  revision: { id: string; number: number };
  status: string;
  createdAt: string;
  answers: Answers;
  result: EstimateResult;
  leadId: string | null;
};
export type LeadResource = Contact & {
  id: string;
  estimateId: string;
  createdAt: string;
};
export type WebhookResource = {
  id: string;
  url: string;
  subscriptions: WebhookEventName[];
  active: boolean;
  createdAt: string;
};
export type Page<T> = {
  data: T[];
  pagination: { nextCursor: string | null; limit: number };
};
export type ListOptions = { limit?: number; cursor?: string };
export type CreateEstimate = {
  estimatorId: string;
  revisionId?: string;
  answers: Answers;
  contact?: Contact;
};
export type WebhookEvent = {
  id: string;
  type: WebhookEventName;
  createdAt: string;
  organizationId: string;
  data: EstimatorResource | EstimateResource | LeadResource;
};
