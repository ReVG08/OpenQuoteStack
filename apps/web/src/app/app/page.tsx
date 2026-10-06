import Link from "next/link";
import { requireActor } from "@/lib/session";
import { services } from "@/lib/services";
import { Header } from "@/components/header";
import { Logout } from "@/components/auth-form";
import { ActionForm } from "@/components/action-form";
import { createOrganization } from "@/app/actions";
import { Card } from "@openquotestack/ui";
import { messages, getLocale } from "@/lib/i18n";
export default async function Workspace({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const actor = await requireActor(),
    organizations = await services().listOrganizations(actor),
    locale = getLocale((await searchParams).lang),
    t = messages(locale);
  return (
    <>
      <Header locale={locale} />
      <main lang={locale}>
        <div className="actions">
          <h1>{t.organizations}</h1>
          <Logout label={t.logout} />
        </div>
        <div className="grid-two">
          <div>
            {organizations.map((o) => (
              <Card key={o.id}>
                <h2>
                  <Link href={`/app/${o.id}`}>{o.name}</Link>
                </h2>
                <p>
                  {o.defaultCurrency} · {o.locale} · {o.timezone}
                </p>
              </Card>
            ))}
          </div>
          <Card>
            <h2>{t.createOrganization}</h2>
            <ActionForm
              action={createOrganization}
              label={t.create}
              locale={locale}
            >
              <label>
                {t.organizationName}
                <input name="name" required minLength={2} maxLength={100} />
              </label>
              <label>
                {t.slug}
                <input
                  name="slug"
                  required
                  minLength={2}
                  maxLength={60}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                />
              </label>
              <label>
                {t.locale}
                <select name="locale" defaultValue={locale}>
                  <option value="en">English</option>
                  <option value="pt-BR">Português (Brasil)</option>
                </select>
              </label>
              <label>
                {t.timezone}
                <input
                  name="timezone"
                  defaultValue={
                    locale === "pt-BR" ? "America/Sao_Paulo" : "UTC"
                  }
                  required
                />
              </label>
              <label>
                {t.currency}
                <input
                  name="currency"
                  pattern="[A-Z]{3}"
                  defaultValue={locale === "pt-BR" ? "BRL" : "USD"}
                  required
                />
              </label>
              <label>
                {locale === "pt-BR" ? "Nome da marca" : "Brand display name"}
                <input name="displayName" maxLength={100} />
              </label>
              <label>
                {locale === "pt-BR" ? "Cor da marca" : "Brand color"}
                <input
                  type="color"
                  name="primaryColor"
                  defaultValue="#176653"
                />
              </label>
            </ActionForm>
          </Card>
        </div>
      </main>
    </>
  );
}
