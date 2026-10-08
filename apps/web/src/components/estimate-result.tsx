import { pricingTraces } from "@/lib/pricing-traces";
import type { EstimateResult } from "@openquotestack/engine";
import type { Estimator } from "@openquotestack/schema";
import { formatMoney, type Locale } from "@/lib/i18n";
import { copy, localized, dateLabel } from "@/lib/product-i18n";
export function EstimateResultView({
  result,
  estimator,
  locale,
  details = false,
}: {
  result: EstimateResult;
  estimator: Estimator;
  locale: Locale;
  details?: boolean;
}) {
  const t = copy(locale),
    money = (n: number) =>
      formatMoney(n, result.currency, result.minorUnits, locale);
  return (
    <section className="quote-result" aria-label={t("yourEstimate")}>
      <p className="eyebrow">{t("yourEstimate")}</p>
      <h2 className="quote-total">
        {result.range
          ? `${money(result.range.minMinor)} – ${money(result.range.maxMinor)}`
          : money(result.totalMinor)}
      </h2>
      {result.range && (
        <p>
          {t("amount")}: {money(result.totalMinor)}
        </p>
      )}
      <h3>{t("breakdown")}</h3>
      <dl className="price-lines">
        {pricingTraces(result).map((line, i) => (
          <div key={`${line.ruleId}-${i}`}>
            <dt>
              {localized(
                estimator,
                locale,
                `rule:${line.ruleId}`,
                line.operation === "minimum"
                  ? t("min")
                  : line.operation === "maximum"
                    ? t("max")
                    : line.label,
              )}
              {line.input !== undefined && (
                <small>
                  {Array.isArray(line.input)
                    ? line.input.join(", ")
                    : typeof line.input === "boolean"
                      ? line.input
                        ? t("yes")
                        : t("no")
                      : line.operation === "date_weekday"
                        ? dateLabel(`${line.input}T12:00:00Z`, locale)
                        : typeof line.input === "number"
                          ? new Intl.NumberFormat(locale).format(line.input)
                          : String(line.input)}
                  {line.operation === "per_unit"
                    ? ` × ${money(Number(line.parameters.rateMinor))}`
                    : ""}
                </small>
              )}
              {line.parameters.percent !== undefined && (
                <small>
                  {String(line.parameters.percent).replace(
                    ".",
                    locale === "pt-BR" ? "," : ".",
                  )}
                  % × {money(Number(line.parameters.basisMinor))}
                </small>
              )}
              {details && (
                <small className="mono">
                  {line.ruleId} · {line.operation}
                </small>
              )}
            </dt>
            <dd>{money(line.amountMinor)}</dd>
          </div>
        ))}
      </dl>
      <div className="price-sum">
        <span>{t("yourEstimate")}</span>
        <strong>{money(result.totalMinor)}</strong>
      </div>
      {result.messages.map((message, i) => (
        <p className="fineprint" key={i}>
          {localized(
            estimator,
            locale,
            i === 0 ? "message" : `message:${i}`,
            message,
          )}
        </p>
      ))}
      {estimator.output.terms && (
        <p className="fineprint">
          {localized(estimator, locale, "terms", estimator.output.terms)}
        </p>
      )}
      {result.cta && (
        <a className="button" href={result.cta.url} rel="noopener noreferrer">
          {result.cta.label}
        </a>
      )}
    </section>
  );
}
