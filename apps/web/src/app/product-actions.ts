"use server";
import { publicAttempt } from "@/lib/public-limits";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActor } from "@/lib/session";
import { services } from "@/lib/services";
import { templateFor, blankDocument } from "@/lib/templates";
import { getLocale } from "@/lib/i18n";
import { parseDocument, type Answers } from "@openquotestack/schema";
import { ConflictError } from "@openquotestack/database/services";
import type { EstimateResult } from "@openquotestack/engine";
export type MutationResult = {
  ok?: boolean;
  error?: "invalid" | "conflict";
  version?: number;
  id?: string;
  result?: EstimateResult;
};
export async function createFromTemplate(orgId: string, templateId: string) {
  const actor = await requireActor();
  let created;
  try {
    const org = await services().getOrganization(actor, orgId);
    created = await services().createEstimator(
      actor,
      orgId,
      templateId === "blank"
        ? blankDocument(getLocale(org.locale), org.defaultCurrency)
        : templateFor(templateId, getLocale(org.locale), org.defaultCurrency),
    );
  } catch {
    return { error: "invalid" } as MutationResult;
  }
  redirect(`/app/${orgId}/estimators/${created.estimator.id}`);
}
export async function importDocument(
  orgId: string,
  source: string,
): Promise<MutationResult> {
  const actor = await requireActor();
  try {
    if (source.length > 200000) throw new Error();
    const doc = parseDocument(JSON.parse(source));
    const { estimator } = await services().createEstimator(
      actor,
      orgId,
      doc,
      "import",
    );
    revalidatePath(`/app/${orgId}`);
    return { ok: true, id: estimator.id };
  } catch {
    return { error: "invalid" };
  }
}
export async function saveBuilder(
  orgId: string,
  id: string,
  document: unknown,
  version: number,
): Promise<MutationResult> {
  const actor = await requireActor();
  try {
    const next = await services().saveDraft(
      actor,
      orgId,
      id,
      document,
      version,
    );
    revalidatePath(`/app/${orgId}`);
    return { ok: true, version: next };
  } catch (error) {
    return { error: error instanceof ConflictError ? "conflict" : "invalid" };
  }
}
export async function publishBuilder(
  orgId: string,
  id: string,
  version: number,
): Promise<MutationResult> {
  const actor = await requireActor();
  try {
    await services().publishDraft(actor, orgId, id, version);
    revalidatePath(`/app/${orgId}`);
    return { ok: true };
  } catch (error) {
    return { error: error instanceof ConflictError ? "conflict" : "invalid" };
  }
}
export async function estimatorOperation(
  orgId: string,
  id: string,
  operation: string,
  confirmation = "",
): Promise<MutationResult> {
  const actor = await requireActor();
  const svc = services();
  try {
    if (operation === "duplicate") {
      const e = await svc.getEstimator(actor, orgId, id);
      const doc = parseDocument(
        e.draftDefinition ?? e.revisions[0]?.definition,
      );
      doc.estimator.name +=
        getLocale((await svc.getOrganization(actor, orgId)).locale) === "pt-BR"
          ? " (cópia)"
          : " (copy)";
      const copy = await svc.createEstimator(actor, orgId, doc);
      revalidatePath(`/app/${orgId}`);
      return { ok: true, id: copy.estimator.id };
    } else if (operation === "archive")
      await svc.archiveEstimator(actor, orgId, id);
    else if (operation === "unpublish")
      await svc.unpublishEstimator(actor, orgId, id);
    else if (operation === "delete")
      await svc.deleteEstimator(actor, orgId, id, confirmation);
    else throw new Error();
    revalidatePath(`/app/${orgId}`);
    return { ok: true };
  } catch {
    return { error: "invalid" };
  }
}
export async function restoreRevision(
  orgId: string,
  id: string,
  revisionId: string,
): Promise<MutationResult> {
  const actor = await requireActor();
  try {
    await services().publishRevision(actor, orgId, id, revisionId);
    revalidatePath(`/app/${orgId}`);
    return { ok: true };
  } catch {
    return { error: "invalid" };
  }
}
export async function saveOrganization(
  orgId: string,
  input: unknown,
): Promise<MutationResult> {
  const actor = await requireActor();
  try {
    await services().updateOrganization(actor, orgId, input);
    revalidatePath(`/app/${orgId}`);
    return { ok: true };
  } catch {
    return { error: "invalid" };
  }
}
export async function updateEstimate(
  orgId: string,
  id: string,
  status: string,
  note: string,
): Promise<MutationResult> {
  const actor = await requireActor();
  try {
    await services().updateEstimate(actor, orgId, id, status, note);
    revalidatePath(`/app/${orgId}`);
    return { ok: true };
  } catch {
    return { error: "invalid" };
  }
}
export async function beginQuote(
  slug: string,
  id: string,
  revisionId: string,
): Promise<MutationResult> {
  try {
    await publicAttempt("begin", `${slug}:${id}`, 600);
    const s = await services().beginPublicSession(slug, id, revisionId);
    return { ok: true, id: s.id };
  } catch {
    return { error: "invalid" };
  }
}
export async function quoteProgress(
  token: string,
  step: number,
): Promise<MutationResult> {
  try {
    await publicAttempt("progress", token, 90);
    await services().progressPublicSession(token, step);
    return { ok: true };
  } catch {
    return { error: "invalid" };
  }
}
export async function submitQuote(
  token: string,
  answers: Answers,
  contact?: unknown,
): Promise<MutationResult> {
  try {
    await publicAttempt("submit", token, 10);
    const e = await services().submitPublicEstimate(token, answers, contact);
    return {
      ok: true,
      id: e.id,
      result: e.result as unknown as EstimateResult,
    };
  } catch {
    return { error: "invalid" };
  }
}
export async function captureContact(
  token: string,
  contact: unknown,
): Promise<MutationResult> {
  try {
    await publicAttempt("contact", token, 10);
    await services().capturePublicLead(token, contact);
    return { ok: true };
  } catch {
    return { error: "invalid" };
  }
}
export async function setupOrganization(
  input: unknown,
  templateId: string,
): Promise<MutationResult> {
  const actor = await requireActor();
  let created, organization;
  try {
    const { organizationInputSchema } = await import("@openquotestack/core");
    const valid = organizationInputSchema.parse(input);
    const doc =
      templateId === "blank"
        ? blankDocument(valid.locale, valid.defaultCurrency)
        : templateFor(templateId, valid.locale, valid.defaultCurrency);
    organization = await services().createOrganization(actor, valid);
    created = await services().createEstimator(actor, organization.id, doc);
  } catch {
    return { error: "invalid" };
  }
  redirect(`/app/${organization.id}/estimators/${created.estimator.id}`);
}
