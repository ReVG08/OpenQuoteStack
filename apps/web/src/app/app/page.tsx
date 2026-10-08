import Link from "next/link";
import { requireActor } from "@/lib/session";
import { services } from "@/lib/services";
import { Header } from "@/components/header";
import { Logout } from "@/components/auth-form";
import { Onboarding } from "@/components/onboarding";
import { getLocale, messages } from "@/lib/i18n";
export default async function Workspace({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string; new?: string }>;
}) {
  const actor = await requireActor(),
    organizations = await services().listOrganizations(actor),
    search = await searchParams,
    locale = getLocale(search.lang),
    t = messages(locale);
  return (
    <>
      <Header locale={locale} />
      <main lang={locale}>
        {!organizations.length || search.new === "true" ? (
          <Onboarding locale={locale} />
        ) : (
          <>
            <div className="page-heading">
              <div>
                <p className="eyebrow">OpenQuoteStack</p>
                <h1>{t.organizations}</h1>
              </div>
              <div className="actions">
                <Link className="button" href={`/app?new=true&lang=${locale}`}>
                  {t.createOrganization}
                </Link>
                <Logout label={t.logout} />
              </div>
            </div>
            <div className="organization-grid">
              {organizations.map((o) => (
                <Link
                  key={o.id}
                  className="organization-card"
                  href={`/app/${o.id}`}
                >
                  <span className="tenant-avatar">{o.name.slice(0, 1)}</span>
                  <h2>{o.name}</h2>
                  <p>
                    {o.defaultCurrency} · {o.locale} · {o.timezone}
                  </p>
                  <span className="text-button">
                    {locale === "pt-BR"
                      ? "Abrir espaço de trabalho"
                      : "Open workspace"}{" "}
                    →
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
