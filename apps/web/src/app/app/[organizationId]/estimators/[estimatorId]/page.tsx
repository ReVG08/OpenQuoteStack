import { notFound } from "next/navigation";
import { workspace } from "@/lib/workspace";
import { services } from "@/lib/services";
import { parseDocument } from "@openquotestack/schema";
import { hasPermission } from "@openquotestack/core";
import { AccessDeniedError } from "@openquotestack/database/services";
import { brandingOf } from "@/lib/branding";
import { EstimatorBuilder } from "@/components/estimator-builder";
export default async function EstimatorPage({
  params,
}: {
  params: Promise<{ organizationId: string; estimatorId: string }>;
}) {
  const { organizationId, estimatorId } = await params,
    { actor, organization, role, locale } = await workspace(organizationId);
  let e;
  try {
    e = await services().getEstimator(actor, organizationId, estimatorId);
  } catch (error) {
    if (error instanceof AccessDeniedError) notFound();
    throw error;
  }
  const initial = parseDocument(
    e.draftDefinition ?? e.revisions[0]?.definition,
  );
  return (
    <EstimatorBuilder
      key={e.id}
      initial={initial}
      orgId={organizationId}
      estimatorId={estimatorId}
      version={e.draftVersion}
      locale={locale}
      brand={brandingOf(organization.branding)}
      slug={organization.slug}
      publishedNumber={
        e.revisions.find((r) => r.id === e.publishedRevisionId)?.number
      }
      revisions={e.revisions.map((r) => ({
        id: r.id,
        number: r.number,
        createdAt: r.createdAt.toISOString(),
        active: r.id === e.publishedRevisionId,
      }))}
      canEdit={hasPermission(role, "estimator.write")}
      canPublish={hasPermission(role, "estimator.publish")}
      archived={e.status === "archived"}
    />
  );
}
