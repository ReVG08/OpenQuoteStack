import { notFound } from "next/navigation";
import { workspace } from "@/lib/workspace";
import { hasPermission } from "@openquotestack/core";
import { brandingOf } from "@/lib/branding";
import { BrandingEditor } from "@/components/branding-editor";
export default async function Branding({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params,
    { organization: o, locale, role } = await workspace(organizationId);
  if (!hasPermission(role, "organization.manage")) notFound();
  return (
    <BrandingEditor
      orgId={o.id}
      locale={locale}
      initial={{
        name: o.name,
        slug: o.slug,
        locale,
        timezone: o.timezone,
        defaultCurrency: o.defaultCurrency,
        branding: brandingOf(o.branding),
      }}
    />
  );
}
