import { cache } from "react";
import { notFound } from "next/navigation";
import { requireActor } from "./session";
import { services } from "./services";
import { AccessDeniedError } from "@openquotestack/database/services";
import { getLocale } from "./i18n";
export const workspace = cache(async (id: string) => {
  const actor = await requireActor();
  try {
    const [organization, role] = await Promise.all([
      services().getOrganization(actor, id),
      services().getRole(actor, id),
    ]);
    return {
      actor,
      organization,
      role,
      locale: getLocale(organization.locale),
    };
  } catch (error) {
    if (error instanceof AccessDeniedError) notFound();
    throw error;
  }
});
