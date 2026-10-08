import moving from "../../../../templates/moving-company.oqs.json";
import cleaning from "../../../../templates/residential-cleaning.oqs.json";
import agency from "../../../../templates/web-design-agency.oqs.json";
import { parseDocument, type EstimatorDocument } from "@openquotestack/schema";
import { localized } from "./product-i18n";
import type { Locale } from "./i18n";
export const templateDocuments = [moving, cleaning, agency].map(parseDocument);
export function templateFor(
  id: string,
  locale: Locale,
  currency: string,
): EstimatorDocument {
  const source = templateDocuments.find((d) => d.template?.id === id);
  if (!source) throw new Error("Unknown template");
  const doc = structuredClone(source);
  doc.estimator.locale = locale;
  const e = doc.estimator;
  e.name = localized(e, locale, "name", e.name);
  e.description = localized(e, locale, "description", e.description ?? "");
  e.steps = e.steps.map((s) => ({
    ...s,
    title: localized(e, locale, `step:${s.id}`, s.title),
    fields: s.fields.map((f) => ({
      ...f,
      label: localized(e, locale, `field:${f.id}`, f.label),
      ...(f.placeholder
        ? {
            placeholder: localized(
              e,
              locale,
              `placeholder:${f.id}`,
              f.placeholder,
            ),
          }
        : {}),
      ...(f.help ? { help: localized(e, locale, `help:${f.id}`, f.help) } : {}),
      ...(f.choices
        ? {
            choices: f.choices.map((c) => ({
              ...c,
              label: localized(e, locale, `choice:${f.id}.${c.id}`, c.label),
            })),
          }
        : {}),
    })),
  }));
  e.rules = e.rules.map((r) => ({
    ...r,
    label: localized(e, locale, `rule:${r.id}`, r.label),
  }));
  if (e.output.message)
    e.output.message = localized(e, locale, "message", e.output.message);
  if (e.output.terms)
    e.output.terms = localized(e, locale, "terms", e.output.terms);
  if (e.leadCapture.consentText)
    e.leadCapture.consentText = localized(
      e,
      locale,
      "consent",
      e.leadCapture.consentText,
    );
  delete e.translations[locale];
  const oldExponent = e.currency.minorUnits;
  doc.estimator.currency = {
    code: currency,
    minorUnits:
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
      }).resolvedOptions().maximumFractionDigits ?? 2,
  };
  const delta = e.currency.minorUnits - oldExponent;
  // Preserve example prices in major units; currency selection is not conversion.
  const scale = (n: number) => {
    const value = BigInt(n);
    const factor = 10n ** BigInt(Math.abs(delta));
    return Number(delta >= 0 ? value * factor : (value + factor / 2n) / factor);
  };
  e.rules = e.rules.map((rule) => {
    if (rule.type === "fixed")
      return { ...rule, amountMinor: scale(rule.amountMinor) };
    if (rule.type === "per_unit")
      return { ...rule, rateMinor: scale(rule.rateMinor) };
    if (rule.type === "tiered")
      return {
        ...rule,
        tiers: rule.tiers.map((tier) => ({
          ...tier,
          rateMinor: scale(tier.rateMinor),
        })),
      };
    return rule;
  });
  if (e.output.minimumMinor !== undefined)
    e.output.minimumMinor = scale(e.output.minimumMinor);
  if (e.output.maximumMinor !== undefined)
    e.output.maximumMinor = scale(e.output.maximumMinor);
  return parseDocument(doc);
}
export const blankDocument = (locale: Locale, currency: string) =>
  parseDocument({
    schemaVersion: "1",
    estimator: {
      id: "untitled",
      name: locale === "pt-BR" ? "Nova calculadora" : "Untitled estimator",
      locale,
      currency: {
        code: currency,
        minorUnits:
          new Intl.NumberFormat(locale, {
            style: "currency",
            currency,
          }).resolvedOptions().maximumFractionDigits ?? 2,
      },
      steps: [
        {
          id: "details",
          title: locale === "pt-BR" ? "Detalhes" : "Details",
          fields: [
            {
              id: "quantity",
              label: locale === "pt-BR" ? "Quantidade" : "Quantity",
              type: "quantity",
              required: true,
              validation: { min: 1, max: 1000, integer: true },
            },
          ],
        },
      ],
      rules: [
        {
          id: "base",
          label: locale === "pt-BR" ? "Serviço básico" : "Base service",
          type: "fixed",
          amountMinor:
            100 *
            10 **
              (new Intl.NumberFormat(locale, {
                style: "currency",
                currency,
              }).resolvedOptions().maximumFractionDigits ?? 2),
        },
      ],
    },
  });
