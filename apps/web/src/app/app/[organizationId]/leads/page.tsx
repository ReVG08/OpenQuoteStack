import Link from "next/link";
import { workspace } from "@/lib/workspace";
import { services } from "@/lib/services";
import { copy, dateLabel, reference } from "@/lib/product-i18n";
import { monetaryGroups } from "@/lib/analytics";
import { formatMoney } from "@/lib/i18n";
export default async function Leads({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params,
    { actor, locale, organization } = await workspace(organizationId),
    t = copy(locale),
    leads = await services().listLeads(actor, organizationId),
    contacts = new Map<string, typeof leads>();
  for (const lead of leads)
    contacts.set(lead.email.toLowerCase(), [
      ...(contacts.get(lead.email.toLowerCase()) ?? []),
      lead,
    ]);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{organization.name}</p>
          <h1>{t("leads")}</h1>
          <p>
            {locale === "pt-BR"
              ? "Contatos e os orçamentos que iniciaram a conversa."
              : "Contacts and the estimates that started the conversation."}
          </p>
        </div>
      </div>
      {!leads.length ? (
        <section className="empty-state">
          <span className="empty-symbol" aria-hidden="true">
            ♧
          </span>
          <h2>{t("noLeads")}</h2>
          <p>{t("emptyQuotes")}</p>
        </section>
      ) : (
        <div className="lead-grid">
          {[...contacts.entries()].map(([email, items]) => {
            const lead = items[0]!;
            return (
              <article className="lead-card" key={email}>
                <div className="section-heading">
                  <span className="tenant-avatar">{lead.name.slice(0, 1)}</span>
                  <small>
                    {dateLabel(lead.createdAt, locale, organization.timezone)}
                  </small>
                </div>
                <h2>{lead.name}</h2>
                <a href={`mailto:${email}`}>{lead.email}</a>
                {lead.phone && <p>{lead.phone}</p>}
                {lead.company && <p>{lead.company}</p>}
                {monetaryGroups(items.map((l) => l.estimate)).map((g) => (
                  <div className="lead-value" key={`${g.currency}:${g.minorUnits}`}>
                    <small>{t("opportunity")}</small>
                    <strong>
                      {formatMoney(g.total, g.currency, g.minorUnits, locale)}
                    </strong>
                  </div>
                ))}
                <div className="lead-quotes">
                  {items.map((l) => (
                    <Link
                      key={l.id}
                      href={`/app/${organizationId}/estimates/${l.estimateId}`}
                    >
                      <span>{reference(l.estimateId)}</span>
                      <span>{l.estimate.revision.estimator.name}</span>
                      <span aria-hidden="true">↗</span>
                    </Link>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
