import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { ActionForm } from "@/components/action-form";
import { importMoving } from "@/app/actions";
import { requireActor } from "@/lib/session";
import { services } from "@/lib/services";
import { getLocale, messages } from "@/lib/i18n";
import { AccessDeniedError } from "@openquotestack/database/services";
import { hasPermission } from "@openquotestack/core";
import type { CSSProperties } from "react";
import { Card } from "@openquotestack/ui";
export default async function OrganizationPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const actor = await requireActor(),
    { organizationId } = await params;
  let organization, estimators, role;
  try {
    organization = await services().getOrganization(actor, organizationId);
    [estimators, role] = await Promise.all([
      services().listEstimators(actor, organizationId),
      services().getRole(actor, organizationId),
    ]);
  } catch (error) {
    if (error instanceof AccessDeniedError) notFound();
    throw error;
  }
  const locale = getLocale(organization.locale),
    t = messages(locale);
  return (
    <>
      <Header locale={locale} />
      <main
        lang={locale}
        style={
          organization.branding &&
          typeof organization.branding === "object" &&
          !Array.isArray(organization.branding) &&
          typeof organization.branding.primaryColor === "string" &&
          /^#[0-9a-fA-F]{6}$/.test(organization.branding.primaryColor)
            ? ({
                "--accent": organization.branding.primaryColor,
              } as CSSProperties)
            : undefined
        }
      >
        <Link href="/app">{t.back}</Link>
        <p className="eyebrow">
          {organization.branding &&
          typeof organization.branding === "object" &&
          !Array.isArray(organization.branding) &&
          typeof organization.branding.displayName === "string"
            ? organization.branding.displayName
            : "OpenQuoteStack"}
        </p>
        <h1>{organization.name}</h1>
        <p>
          {organization.defaultCurrency} · {organization.timezone}
        </p>
        <Card>
          <h2>{t.estimators}</h2>
          {estimators.length === 0 && <p>{t.empty}</p>}
          {estimators.map((e) => (
            <p key={e.id}>
              <Link href={`/app/${organizationId}/estimators/${e.id}`}>
                {e.name}
              </Link>{" "}
              <span className="badge">{t[e.status]}</span>
            </p>
          ))}
          {hasPermission(role, "estimator.write") && (
            <ActionForm
              action={importMoving.bind(null, organizationId)}
              label={t.importMoving}
              locale={locale}
            />
          )}
        </Card>
      </main>
    </>
  );
}
