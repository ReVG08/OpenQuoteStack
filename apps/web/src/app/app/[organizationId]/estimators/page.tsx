import Link from "next/link";
import { workspace } from "@/lib/workspace";
import { services } from "@/lib/services";
import { copy } from "@/lib/product-i18n";
import { EstimatorList } from "@/components/estimator-list";
import { parseDocument } from "@openquotestack/schema";
import { hasPermission } from "@openquotestack/core";
export default async function Estimators({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params,
    { actor, organization, locale, role } = await workspace(organizationId),
    t = copy(locale);
  const [entries, analytics] = await Promise.all([
    services().listEstimators(actor, organizationId),
    services().analytics(actor, organizationId),
  ]);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{organization.name}</p>
          <h1>{t("estimators")}</h1>
          <p>
            {locale === "pt-BR"
              ? "Do primeiro rascunho à próxima solicitação."
              : "From your first draft to your next customer request."}
          </p>
        </div>
        {hasPermission(role, "estimator.write") && (
          <Link className="button" href={`/app/${organizationId}/templates`}>
            + {t("create")}
          </Link>
        )}
      </div>
      <EstimatorList
        orgId={organizationId}
        slug={organization.slug}
        locale={locale}
        canEdit={hasPermission(role, "estimator.write")}
        canPublish={hasPermission(role, "estimator.publish")}
        entries={entries.map((e) => ({
          id: e.id,
          name: e.name,
          status: e.status,
          updatedAt: e.updatedAt.toISOString(),
          publishedNumber: e.publishedRevision?.number,
          completions: analytics.estimates.filter((q) => q.estimatorId === e.id)
            .length,
          leads: analytics.estimates.filter(
            (q) => q.estimatorId === e.id && q.lead,
          ).length,
          document: parseDocument(
            e.draftDefinition ?? e.revisions[0]?.definition,
          ),
        }))}
      />
    </>
  );
}
