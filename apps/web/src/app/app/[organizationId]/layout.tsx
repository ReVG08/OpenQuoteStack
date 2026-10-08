import { workspace } from "@/lib/workspace";
import { WorkspaceNav } from "@/components/workspace-nav";
import { hasPermission } from "@openquotestack/core";
export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params,
    { organization, locale, role } = await workspace(organizationId);
  return (
    <div className="workspace-shell" lang={locale}>
      <a className="skip-link" href="#workspace-content">
        {locale === "pt-BR" ? "Pular para o conteúdo" : "Skip to content"}
      </a>
      <WorkspaceNav
        id={organization.id}
        name={organization.name}
        locale={locale}
        canManage={hasPermission(role, "organization.manage")}
      />
      <main className="workspace-main" id="workspace-content">
        {children}
      </main>
    </div>
  );
}
