"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sample from "../../../../templates/moving-company.oqs.json";
import { services } from "@/lib/services";
import { requireActor } from "@/lib/session";
import type { EstimateResult } from "@openquotestack/engine";
import type { Answers } from "@openquotestack/schema";
export type ActionState = {
  error?: boolean;
  success?: boolean;
  estimateId?: string;
  result?: EstimateResult;
};
export async function createOrganization(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await requireActor();
  let organization;
  try {
    organization = await services().createOrganization(actor, {
      name: form.get("name"),
      slug: form.get("slug"),
      locale: form.get("locale"),
      timezone: form.get("timezone"),
      defaultCurrency: form.get("currency"),
      branding: {
        displayName: String(form.get("displayName") ?? ""),
        primaryColor: String(form.get("primaryColor") ?? "#176653"),
      },
    });
  } catch {
    return { error: true };
  }
  redirect(`/app/${organization.id}`);
}
export async function importMoving(
  organizationId: string,
  _state: ActionState,
  _form: FormData,
): Promise<ActionState> {
  const actor = await requireActor();
  let created;
  try {
    created = await services().createEstimator(actor, organizationId, sample);
  } catch {
    return { error: true };
  }
  redirect(`/app/${organizationId}/estimators/${created.estimator.id}`);
}
export async function publishRevision(
  organizationId: string,
  estimatorId: string,
  revisionId: string,
  _state: ActionState,
  _form: FormData,
): Promise<ActionState> {
  const actor = await requireActor();
  try {
    await services().publishRevision(
      actor,
      organizationId,
      estimatorId,
      revisionId,
    );
  } catch {
    return { error: true };
  }
  revalidatePath(`/app/${organizationId}`);
  return { success: true };
}
export async function createRevision(
  organizationId: string,
  estimatorId: string,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await requireActor();
  try {
    const source = form.get("definition");
    if (typeof source !== "string" || source.length > 200000)
      return { error: true };
    await services().createRevision(
      actor,
      organizationId,
      estimatorId,
      JSON.parse(source),
    );
  } catch {
    return { error: true };
  }
  revalidatePath(`/app/${organizationId}`);
  return { success: true };
}
export async function saveEstimate(
  organizationId: string,
  estimatorId: string,
  answers: Answers,
): Promise<ActionState> {
  const actor = await requireActor();
  try {
    const estimate = await services().createEstimate(
      actor,
      organizationId,
      estimatorId,
      answers,
    );
    return {
      success: true,
      estimateId: estimate.id,
      result: estimate.result as unknown as EstimateResult,
    };
  } catch {
    return { error: true };
  }
}
