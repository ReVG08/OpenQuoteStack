import Link from "next/link";
import { workspace } from "@/lib/workspace";
import { services } from "@/lib/services";
import { copy } from "@/lib/product-i18n";
import { formatMoney } from "@/lib/i18n";
import { monetaryGroups, averageMinor } from "@/lib/analytics";
import { EstimatesTable } from "@/components/estimates-table";
export default async function Dashboard({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params,
    { actor, organization, locale } = await workspace(organizationId),
    t = copy(locale);
  const [estimators, quotes, analytics] = await Promise.all([
      services().listEstimators(actor, organizationId),
      services().listEstimates(actor, organizationId),
      services().analytics(actor, organizationId),
    ]),
    starts = analytics.sessions.filter((s) => s.startedAt).length,
    complete = analytics.sessions.filter((s) => s.completedAt).length,
    groups = monetaryGroups(analytics.estimates);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{organization.name}</p>
          <h1>{t("dashboard")}</h1>
          <p>
            {locale === "pt-BR"
              ? "Uma visão clara das próximas oportunidades."
              : "A clear view of what comes next."}
          </p>
        </div>
        <Link className="button" href={`/app/${organizationId}/templates`}>
          + {t("create")}
        </Link>
      </div>
      {!estimators.length ? (
        <section className="empty-state">
          <span className="empty-symbol" aria-hidden="true">
            ↗
          </span>
          <h2>{t("empty")}</h2>
          <p>{t("emptyHelp")}</p>
          <Link className="button" href={`/app/${organizationId}/templates`}>
            {t("choose")} →
          </Link>
        </section>
      ) : (
        <>
          <div className="section-heading">
            <h2>{t("overview")}</h2>
            <span className="fineprint">{t("last30")}</span>
          </div>
          <dl className="metrics">
            {[
              [t("views"), analytics.sessions.length],
              [t("starts"), starts],
              [t("completions"), complete],
              [
                t("completionRate"),
                new Intl.NumberFormat(locale, {
                  style: "percent",
                  maximumFractionDigits: 1,
                }).format(starts ? complete / starts : 0),
              ],
              [t("leads"), analytics.estimates.filter((e) => e.lead).length],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {groups.length > 0 && (
            <div className="value-summary">
              {groups.map((g) => (
                <div key={g.currency}>
                  <span>
                    {t("pipeline")} · {g.currency}
                  </span>
                  <strong>
                    {formatMoney(g.total, g.currency, g.minorUnits, locale)}
                  </strong>
                  <small>
                    {t("average")}:{" "}
                    {formatMoney(
                      averageMinor(g.total, g.count),
                      g.currency,
                      g.minorUnits,
                      locale,
                    )}
                  </small>
                </div>
              ))}
            </div>
          )}
          <div className="section-heading">
            <h2>{t("recent")}</h2>
            <Link href={`/app/${organizationId}/estimates`}>
              {t("estimates")} →
            </Link>
          </div>
          <EstimatesTable
            quotes={quotes.slice(0, 6)}
            orgId={organizationId}
            locale={locale}
            timezone={organization.timezone}
          />
          <section className="active-estimators">
            <div className="section-heading">
              <h2>{t("estimators")}</h2>
              <Link href={`/app/${organizationId}/estimators`}>
                {t("estimators")} →
              </Link>
            </div>
            {estimators.slice(0, 5).map((e) => (
              <Link
                className="estimator-strip"
                href={`/app/${organizationId}/estimators/${e.id}`}
                key={e.id}
              >
                <span className="estimator-icon" aria-hidden="true">
                  ▤
                </span>
                <strong>{e.name}</strong>
                <span className={`status status-${e.status}`}>
                  {t(e.status)}
                </span>
                <span aria-hidden="true">→</span>
              </Link>
            ))}
          </section>
        </>
      )}
    </>
  );
}
