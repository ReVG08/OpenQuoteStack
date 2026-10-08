import Link from "next/link";
import { notFound } from "next/navigation";
import { workspace } from "@/lib/workspace";
import { services } from "@/lib/services";
import { copy, reference, dateLabel, type CopyKey } from "@/lib/product-i18n";
import { parseDocument } from "@openquotestack/schema";
import { hasPermission } from "@openquotestack/core";
import type { EstimateResult } from "@openquotestack/engine";
import { AccessDeniedError } from "@openquotestack/database/services";
import { EstimateResultView } from "@/components/estimate-result";
import { EstimateManagement } from "@/components/estimate-management";
export default async function Estimate({
  params,
}: {
  params: Promise<{ organizationId: string; estimateId: string }>;
}) {
  const { organizationId, estimateId } = await params,
    { actor, locale, role, organization } = await workspace(organizationId),
    t = copy(locale);
  let quote;
  try {
    quote = await services().getEstimate(actor, organizationId, estimateId);
  } catch (error) {
    if (error instanceof AccessDeniedError) notFound();
    throw error;
  }
  const e = parseDocument(quote.revision.definition).estimator,
    answers = quote.answers as Record<string, unknown>;
  return (
    <>
      <div className="page-heading">
        <div>
          <Link
            className="breadcrumb"
            href={`/app/${organizationId}/estimates`}
          >
            {t("estimates")}
          </Link>
          <h1 className="reference-heading">{reference(quote.id)}</h1>
          <p>
            {e.name} · {t("revision")} {quote.revision.number} ·{" "}
            {dateLabel(quote.createdAt, locale, organization.timezone)}
          </p>
        </div>
        <a
          className="button secondary"
          href={`/app/${organizationId}/estimates/${estimateId}/pdf`}
        >
          {t("pdf")} ↓
        </a>
      </div>
      <div className="estimate-layout">
        <div>
          <section className="detail-panel">
            <EstimateResultView
              result={quote.result as unknown as EstimateResult}
              estimator={e}
              locale={locale}
              details
            />
          </section>
          <section className="detail-panel">
            <h2>{t("answers")}</h2>
            <dl className="answer-lines">
              {e.steps
                .flatMap((s) => s.fields)
                .filter((f) => Object.hasOwn(answers, f.id))
                .map((f) => {
                  const value = answers[f.id];
                  const display =
                    typeof value === "boolean"
                      ? t(value ? "yes" : "no")
                      : Array.isArray(value)
                        ? value
                            .map(
                              (v) =>
                                f.choices?.find((c) => c.id === v)?.label ??
                                String(v),
                            )
                            .join(", ")
                        : (f.choices?.find((c) => c.id === value)?.label ??
                          (typeof value === "number"
                            ? new Intl.NumberFormat(locale).format(value)
                            : String(value)));
                  return (
                    <div key={f.id}>
                      <dt>{f.label}</dt>
                      <dd>{display}</dd>
                    </div>
                  );
                })}
            </dl>
          </section>
        </div>
        <aside>
          <section className="detail-panel">
            <h2>{t("customer")}</h2>
            {quote.lead ? (
              <>
                <h3>{quote.lead.name}</h3>
                <a href={`mailto:${quote.lead.email}`}>{quote.lead.email}</a>
                {quote.lead.phone && <p>{quote.lead.phone}</p>}
                {quote.lead.company && <p>{quote.lead.company}</p>}
                {quote.lead.address && <p>{quote.lead.address}</p>}
                {quote.lead.notes && (
                  <p className="preserve-text">{quote.lead.notes}</p>
                )}
              </>
            ) : (
              <p>{t("anonymous")}</p>
            )}
          </section>
          {hasPermission(role, "estimate.manage") && (
            <section className="detail-panel">
              <EstimateManagement
                orgId={organizationId}
                id={quote.id}
                status={quote.status}
                locale={locale}
              />
            </section>
          )}
          <section className="detail-panel">
            <h2>{t("activity")}</h2>
            {!quote.activities.length && <p>{t("noActivity")}</p>}
            <ol className="activity-list">
              {quote.activities.map((a) => (
                <li key={a.id}>
                  <span>
                    {a.kind === "status" ? t(a.text as CopyKey) : a.text}
                  </span>
                  <small>
                    {dateLabel(a.createdAt, locale, organization.timezone)}
                  </small>
                </li>
              ))}
            </ol>
            <p className="fineprint mono">
              {quote.engineVersion} · {quote.revision.contentHash.slice(0, 12)}
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
