"use client";
import { useState, useTransition } from "react";
import { setupOrganization } from "@/app/product-actions";
import { templateDocuments } from "@/lib/templates";
import { copy, localized } from "@/lib/product-i18n";
import type { Locale } from "@/lib/i18n";
import { Button } from "@openquotestack/ui";
export function Onboarding({ locale: initialLocale }: { locale: Locale }) {
  const [step, setStep] = useState(0),
    [locale, setLocale] = useState(initialLocale),
    [name, setName] = useState(""),
    [slug, setSlug] = useState(""),
    [color, setColor] = useState("#176653"),
    [currency, setCurrency] = useState(
      initialLocale === "pt-BR" ? "BRL" : "USD",
    ),
    [timezone, setTimezone] = useState(
      initialLocale === "pt-BR" ? "America/Sao_Paulo" : "UTC",
    ),
    [template, setTemplate] = useState("moving-company"),
    [error, setError] = useState(false),
    [pending, startTransition] = useTransition();
  const t = copy(locale);
  return (
    <div className="onboarding">
      <div className="onboarding-intro">
        <p className="eyebrow">OpenQuoteStack</p>
        <h1>{t("welcome")}</h1>
        <p>{t("welcomeHelp")}</p>
        <ol className="setup-steps">
          {(["organization", "appearance", "choose"] as const).map((key, i) => (
            <li
              key={key}
              className={step === i ? "current" : step > i ? "complete" : ""}
            >
              <span>{step > i ? "✓" : i + 1}</span>
              {t(key)}
            </li>
          ))}
        </ol>
        <p className="fineprint">
          {locale === "pt-BR"
            ? "Comece pequeno. Tudo pode ser ajustado depois."
            : "Start simple. You can refine everything later."}
        </p>
      </div>
      <section className="onboarding-form">
        <h2>
          {t(
            step === 0 ? "organization" : step === 1 ? "appearance" : "choose",
          )}
        </h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (step < 2) {
              setStep((s) => s + 1);
              setError(false);
            } else
              startTransition(async () => {
                const r = await setupOrganization(
                  {
                    name,
                    slug,
                    locale,
                    timezone,
                    defaultCurrency: currency,
                    branding: { displayName: name, primaryColor: color },
                  },
                  template,
                );
                if (r?.error) setError(true);
              });
          }}
        >
          {step === 0 && (
            <>
              <label>
                {t("name")}
                <input
                  autoComplete="organization"
                  required
                  minLength={2}
                  maxLength={100}
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setSlug(
                      event.target.value
                        .toLowerCase()
                        .normalize("NFD")
                        .replace(/[\u0300-\u036f]/g, "")
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/^-|-$/g, ""),
                    );
                  }}
                />
              </label>
              <label>
                {locale === "pt-BR"
                  ? "Identificador público"
                  : "Public identifier"}
                <input
                  required
                  minLength={2}
                  maxLength={60}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                />
                <small>
                  {locale === "pt-BR"
                    ? "Usado no endereço público das suas calculadoras."
                    : "Used in your public estimator addresses."}
                </small>
              </label>
            </>
          )}
          {step === 1 && (
            <>
              <label>
                {t("primary")}
                <input
                  type="color"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                />
              </label>
              <div className="form-grid">
                <label>
                  {locale === "pt-BR" ? "Idioma" : "Language"}
                  <select
                    value={locale}
                    onChange={(event) =>
                      setLocale(event.target.value as Locale)
                    }
                  >
                    <option value="en">English</option>
                    <option value="pt-BR">Português (Brasil)</option>
                  </select>
                </label>
                <label>
                  {locale === "pt-BR" ? "Moeda" : "Currency"}
                  <select
                    value={currency}
                    onChange={(event) => setCurrency(event.target.value)}
                  >
                    {[
                      "USD",
                      "BRL",
                      "EUR",
                      "GBP",
                      "CAD",
                      "AUD",
                      "JPY",
                      "KWD",
                    ].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                {locale === "pt-BR" ? "Fuso horário" : "Timezone"}
                <input
                  value={timezone}
                  required
                  onChange={(event) => setTimezone(event.target.value)}
                />
              </label>
              <p className="fineprint">
                {locale === "pt-BR"
                  ? "Logotipo e contatos podem ser adicionados em Marca. Esta etapa é opcional."
                  : "Add your logo and contact details in Branding. This step is optional."}
              </p>
            </>
          )}
          {step === 2 && (
            <div className="template-picker">
              {templateDocuments.map((d) => (
                <label
                  className={`template-option ${template === d.template!.id ? "selected" : ""}`}
                  key={d.template!.id}
                >
                  <input
                    type="radio"
                    name="template"
                    checked={template === d.template!.id}
                    onChange={() => setTemplate(d.template!.id)}
                  />
                  <span>
                    <strong>
                      {localized(d.estimator, locale, "name", d.estimator.name)}
                    </strong>
                    <small>
                      {localized(
                        d.estimator,
                        locale,
                        "description",
                        d.estimator.description ?? "",
                      )}
                    </small>
                  </span>
                </label>
              ))}
              <label className="template-option">
                <input
                  type="radio"
                  name="template"
                  checked={template === "blank"}
                  onChange={() => setTemplate("blank")}
                />
                <span>
                  <strong>{t("blank")}</strong>
                </span>
              </label>
              <p className="fineprint">
                {locale === "pt-BR"
                  ? "Preços de exemplo. Confira os valores e unidades antes de publicar."
                  : "Example pricing. Review amounts and units before publishing."}
              </p>
            </div>
          )}
          {error && (
            <p role="alert">
              {locale === "pt-BR"
                ? "Confira os dados. O identificador pode já estar em uso."
                : "Check your details. The public identifier may already be in use."}
            </p>
          )}
          <div className="actions">
            {step > 0 && (
              <Button
                type="button"
                className="secondary"
                disabled={pending}
                onClick={() => setStep((s) => s - 1)}
              >
                {t("back")}
              </Button>
            )}
            <Button disabled={pending}>
              {pending
                ? t("working")
                : step === 2
                  ? t("create")
                  : t("continue")}{" "}
              →
            </Button>
            {step === 1 && (
              <Button
                type="button"
                className="text-button"
                onClick={() => setStep(2)}
              >
                {locale === "pt-BR" ? "Pular por agora" : "Skip for now"}
              </Button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
