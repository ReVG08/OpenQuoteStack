import { workspace } from "@/lib/workspace";
import { services } from "@/lib/services";
import { copy } from "@/lib/product-i18n";
import { EstimatesTable } from "@/components/estimates-table";
export default async function Estimates({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ estimator?: string }>;
}) {
  const { organizationId } = await params,
    { actor, organization, locale } = await workspace(organizationId),
    t = copy(locale),
    quotes = await services().listEstimates(
      actor,
      organizationId,
      (await searchParams).estimator,
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{organization.name}</p>
          <h1>{t("estimates")}</h1>
          <p>
            {locale === "pt-BR"
              ? "Solicitações reais, com cada cálculo preservado. Até 200 orçamentos recentes."
              : "Real requests, with every calculation preserved. Up to 200 recent estimates."}
          </p>
        </div>
      </div>
      <EstimatesTable
        quotes={quotes}
        orgId={organizationId}
        locale={locale}
        timezone={organization.timezone}
      />
    </>
  );
}
