import { workspace } from "@/lib/workspace";
import { services } from "@/lib/services";
import { copy } from "@/lib/product-i18n";
import { parseDocument } from "@openquotestack/schema";
import { monetaryGroups, averageMinor } from "@/lib/analytics";
import { formatMoney } from "@/lib/i18n";
export default async function Analytics({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params,
    { actor, locale } = await workspace(organizationId),
    t = copy(locale),
    [data, estimators] = await Promise.all([
      services().analytics(actor, organizationId),
      services().listEstimators(actor, organizationId),
    ]),
    number = new Intl.NumberFormat(locale),
    percent = new Intl.NumberFormat(locale, {
      style: "percent",
      maximumFractionDigits: 1,
    }),
    starts = data.sessions.filter((s) => s.startedAt).length;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t("last30")}</p>
          <h1>{t("analytics")}</h1>
          <p>{t("analyticsHelp")}</p>
        </div>
      </div>
      {!data.sessions.length ? (
        <section className="empty-state">
          <h2>{t("noAnalytics")}</h2>
        </section>
      ) : (
        <>
          <dl className="metrics">
            {[
              [t("views"), data.sessions.length],
              [t("starts"), starts],
              [
                t("completions"),
                data.sessions.filter((s) => s.completedAt).length,
              ],
              [
                t("completionRate"),
                percent.format(
                  starts
                    ? data.sessions.filter((s) => s.completedAt).length / starts
                    : 0,
                ),
              ],
              [t("leads"), data.estimates.filter((e) => e.lead).length],
            ].map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <h2>{t("performance")}</h2>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("name")}</th>
                  <th>{t("views")}</th>
                  <th>{t("starts")}</th>
                  <th>{t("completions")}</th>
                  <th>{t("completionRate")}</th>
                  <th>{t("leads")}</th>
                </tr>
              </thead>
              <tbody>
                {estimators.map((e) => {
                  const sessions = data.sessions.filter(
                      (s) => s.estimatorId === e.id,
                    ),
                    starts = sessions.filter((s) => s.startedAt).length,
                    completed = sessions.filter((s) => s.completedAt).length;
                  return (
                    <tr key={e.id}>
                      <td>{e.name}</td>
                      <td>{number.format(sessions.length)}</td>
                      <td>{number.format(starts)}</td>
                      <td>{number.format(completed)}</td>
                      <td>{percent.format(starts ? completed / starts : 0)}</td>
                      <td>
                        {
                          data.estimates.filter(
                            (q) => q.estimatorId === e.id && q.lead,
                          ).length
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <h2>{t("dropoff")}</h2>
          {estimators.flatMap((e) => {
            const revisions = new Map<string, typeof data.sessions>();
            for (const s of data.sessions.filter(
              (s) => s.estimatorId === e.id && s.startedAt,
            ))
              revisions.set(s.revision.id, [
                ...(revisions.get(s.revision.id) ?? []),
                s,
              ]);
            return [...revisions.entries()].map(([id, sessions]) => {
              const revision = sessions[0]!.revision,
                steps = parseDocument(revision.definition).estimator.steps;
              return (
                <section className="step-report" key={id}>
                  <h3>
                    {e.name} · {t("revision")} {revision.number}
                  </h3>
                  {steps.map((step, i) => {
                    const reached = sessions.filter(
                      (s) => s.lastStep >= i,
                    ).length;
                    return (
                      <div className="funnel-row" key={step.id}>
                        <span>
                          {i + 1}. {step.title}
                        </span>
                        <progress
                          max={sessions.length}
                          value={reached}
                          aria-label={step.title}
                        />
                        <strong>{number.format(reached)}</strong>
                        <small>
                          {percent.format(reached / sessions.length)}
                        </small>
                      </div>
                    );
                  })}
                </section>
              );
            });
          })}
          <h2>{t("pipeline")}</h2>
          <div className="value-summary">
            {monetaryGroups(data.estimates).map((g) => (
              <div key={g.currency}>
                <span>{g.currency}</span>
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
        </>
      )}
    </>
  );
}
