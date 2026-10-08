import sample from "../../../../../templates/moving-company.oqs.json";
import { parseEstimator } from "@openquotestack/schema";
import { Calculator } from "@/components/calculator";
import { Header } from "@/components/header";
import { getLocale, messages } from "@/lib/i18n";
export default async function Demo({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const locale = getLocale((await searchParams).lang),
    t = messages(locale);
  return (
    <>
      <Header locale={locale} />
      <main lang={locale} className="narrow">
        <h1>{t.preview}</h1>
        <p>{t.previewHelp}</p>
        <div className="runtime-card">
          <Calculator estimator={parseEstimator(sample)} locale={locale} />
        </div>
      </main>
    </>
  );
}
