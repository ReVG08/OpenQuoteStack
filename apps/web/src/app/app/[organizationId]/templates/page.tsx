import { workspace } from "@/lib/workspace";
import { TemplateGallery } from "@/components/template-gallery";
import { hasPermission } from "@openquotestack/core";
export default async function Templates({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params,
    { locale, role } = await workspace(organizationId);
  return (
    <TemplateGallery
      orgId={organizationId}
      locale={locale}
      canCreate={hasPermission(role, "estimator.write")}
    />
  );
}
