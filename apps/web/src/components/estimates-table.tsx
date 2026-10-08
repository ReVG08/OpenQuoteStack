import Link from "next/link";
import type { EstimateResult } from "@openquotestack/engine";
import { copy, reference, dateLabel, type CopyKey } from "@/lib/product-i18n";
import { formatMoney, type Locale } from "@/lib/i18n";
export type QuoteRow = {
  id: string;
  createdAt: Date;
  status: string;
  result: unknown;
  lead: { name: string; email: string } | null;
  revision: { number: number; estimator: { name: string } };
};
export function EstimatesTable({
  quotes,
  orgId,
  locale,
  timezone,
}: {
  quotes: QuoteRow[];
  orgId: string;
  locale: Locale;
  timezone: string;
}) {
  const t = copy(locale);
  if (!quotes.length)
    return (
      <section className="empty-state">
        <span className="empty-symbol" aria-hidden="true">
          ↗
        </span>
        <h2>{t("noEstimates")}</h2>
        <p>{t("emptyQuotes")}</p>
        <Link className="button secondary" href={`/app/${orgId}/estimators`}>
          {t("estimators")}
        </Link>
      </section>
    );
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>{t("reference")}</th>
            <th>{t("customer")}</th>
            <th>{t("amount")}</th>
            <th>{t("status")}</th>
            <th>{t("date")}</th>
          </tr>
        </thead>
        <tbody>
          {quotes.map((q) => {
            const r = q.result as EstimateResult,
              money = (n: number) =>
                formatMoney(n, r.currency, r.minorUnits, locale);
            return (
              <tr key={q.id}>
                <td>
                  <Link
                    className="strong-link mono"
                    href={`/app/${orgId}/estimates/${q.id}`}
                  >
                    {reference(q.id)}
                  </Link>
                  <small>
                    {q.revision.estimator.name} · {t("revision")}{" "}
                    {q.revision.number}
                  </small>
                </td>
                <td>
                  {q.lead?.name ?? t("anonymous")}
                  <small>{q.lead?.email}</small>
                </td>
                <td className="money-cell">
                  {r.range
                    ? `${money(r.range.minMinor)} – ${money(r.range.maxMinor)}`
                    : money(r.totalMinor)}
                </td>
                <td>
                  <span className={`status status-${q.status}`}>
                    {t(q.status as CopyKey)}
                  </span>
                </td>
                <td>{dateLabel(q.createdAt, locale, timezone)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
