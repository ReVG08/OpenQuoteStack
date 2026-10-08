import { notFound } from "next/navigation";
import Link from "next/link";
import { workspace } from "@/lib/workspace";
import { hasPermission } from "@openquotestack/core";
import { platform } from "@/lib/platform";
import { getDatabase } from "@openquotestack/database";
import { PlatformPanel } from "@/components/platform-panel";
import { systemStatus } from "@/lib/system-status";
export default async function PlatformPage({
  params,
}: {
  params: Promise<{ organizationId: string; section: string }>;
}) {
  const { organizationId, section } = await params,
    { locale, role, actor } = await workspace(organizationId);
  if (!hasPermission(role, "organization.manage")) notFound();
  const tabs = [
    "api-keys",
    "webhooks",
    "domains",
    "integrations",
    "audit",
    "system",
  ];
  if (!tabs.includes(section)) notFound();
  const p = platform(),
    pt = locale === "pt-BR",
    labels = pt
      ? [
          "Chaves de API",
          "Webhooks",
          "Domínios",
          "Integrações",
          "Auditoria",
          "Sistema",
        ]
      : [
          "API keys",
          "Webhooks",
          "Domains",
          "Integrations",
          "Audit log",
          "System",
        ];
  const data =
    section === "api-keys"
      ? await p.listKeys(actor, organizationId)
      : section === "webhooks"
        ? await p.listWebhooks(actor, organizationId)
        : section === "domains"
          ? await p.listDomains(actor, organizationId)
          : section === "audit"
            ? await p.auditLog(actor, organizationId)
            : section === "system"
              ? await systemStatus(organizationId)
              : await p.settings(actor, organizationId);
  const estimators =
    section === "integrations"
      ? await getDatabase().estimator.findMany({
          where: { organizationId, status: "published", deletedAt: null },
          select: {
            id: true,
            name: true,
            organization: { select: { slug: true } },
          },
        })
      : [];
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{pt ? "Configurações" : "Settings"}</p>
          <h1>{labels[tabs.indexOf(section)]}</h1>
        </div>
      </div>
      <nav
        className="settings-tabs"
        aria-label={pt ? "Configurações" : "Settings"}
      >
        {tabs.map((tab, i) => (
          <Link
            key={tab}
            aria-current={section === tab ? "page" : undefined}
            href={`/app/${organizationId}/settings/${tab}`}
          >
            {labels[i]}
          </Link>
        ))}
      </nav>
      <PlatformPanel
        org={organizationId}
        locale={locale}
        section={section}
        data={JSON.parse(JSON.stringify(data))}
        estimators={estimators}
        origin={new URL(process.env.BETTER_AUTH_URL!).origin}
      />
    </>
  );
}
