import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { Calculator } from "@/components/calculator";
import { ActionForm } from "@/components/action-form";
import { publishRevision, createRevision } from "@/app/actions";
import { requireActor } from "@/lib/session";
import { services } from "@/lib/services";
import { getLocale, messages } from "@/lib/i18n";
import { parseDocument } from "@openquotestack/schema";
import { AccessDeniedError } from "@openquotestack/database/services";
import { hasPermission } from "@openquotestack/core";
import { Card } from "@openquotestack/ui";
export default async function EstimatorPage({
  params,
}: {
  params: Promise<{ organizationId: string; estimatorId: string }>;
}) {
  const actor = await requireActor(),
    { organizationId, estimatorId } = await params;
  let organization, estimator, role;
  try {
    organization = await services().getOrganization(actor, organizationId);
    [estimator, role] = await Promise.all([
      services().getEstimator(actor, organizationId, estimatorId),
      services().getRole(actor, organizationId),
    ]);
  } catch (error) {
    if (error instanceof AccessDeniedError) notFound();
    throw error;
  }
  const locale = getLocale(organization.locale),
    t = messages(locale),
    latest = estimator.revisions[0];
  if (!latest) notFound();
  const active = estimator.revisions.find(
      (r) => r.id === estimator.publishedRevisionId,
    ),
    document = parseDocument((active ?? latest).definition);
  return (
    <>
      <Header locale={locale} />
      <main lang={locale}>
        <Link href={`/app/${organizationId}`}>{t.back}</Link>
        <h1>{estimator.name}</h1>
        <p>
          <span className="badge">{t[estimator.status]}</span> · {t.revision}{" "}
          {(active ?? latest).number}
        </p>
        <Calculator
          estimator={document.estimator}
          locale={locale}
          persist={
            active &&
            estimator.status === "published" &&
            hasPermission(role, "estimate.create")
              ? { organizationId, estimatorId }
              : undefined
          }
        />
        {!active && <p>{t.noPublished}</p>}
        <Card>
          <h2>{t.revision}</h2>
          <p>{t.revisionHelp}</p>
          {estimator.revisions.map((r) => (
            <div className="card" key={r.id}>
              <p>
                {t.revision} {r.number} ·{" "}
                <code>{r.contentHash.slice(0, 12)}</code>{" "}
                {r.id === estimator.publishedRevisionId && (
                  <span className="badge">{t.published}</span>
                )}
              </p>
              {hasPermission(role, "estimator.publish") && (
                <ActionForm
                  action={publishRevision.bind(
                    null,
                    organizationId,
                    estimatorId,
                    r.id,
                  )}
                  label={t.publish}
                  locale={locale}
                />
              )}
            </div>
          ))}
        </Card>
        {hasPermission(role, "estimator.write") &&
          estimator.status !== "archived" && (
            <Card>
              <h2>{t.definition}</h2>
              <ActionForm
                action={createRevision.bind(null, organizationId, estimatorId)}
                label={t.saveRevision}
                locale={locale}
              >
                <label>
                  {t.definition}
                  <textarea
                    name="definition"
                    defaultValue={JSON.stringify(latest.definition, null, 2)}
                    required
                    maxLength={200000}
                  />
                </label>
              </ActionForm>
            </Card>
          )}
      </main>
    </>
  );
}
