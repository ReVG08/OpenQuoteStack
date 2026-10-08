"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@openquotestack/ui";
import { templateDocuments } from "@/lib/templates";
import { localized, copy } from "@/lib/product-i18n";
import type { Locale } from "@/lib/i18n";
import { createFromTemplate, importDocument } from "@/app/product-actions";
export function TemplateGallery({
  orgId,
  locale,
  canCreate,
}: {
  orgId: string;
  locale: Locale;
  canCreate: boolean;
}) {
  const t = copy(locale),
    router = useRouter(),
    [pending, startTransition] = useTransition(),
    [error, setError] = useState("");
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t("templates")}</p>
          <h1>{t("choose")}</h1>
          <p>
            {locale === "pt-BR"
              ? "Modelos completos, prontos para adaptar ao seu negócio."
              : "Complete starting points, ready to shape around your business."}
          </p>
        </div>
        {canCreate && (
          <Button
            className="secondary"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await createFromTemplate(orgId, "blank");
                if (r?.error) setError(t("failure"));
              })
            }
          >
            + {t("blank")}
          </Button>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="template-gallery">
        {templateDocuments.map((d, index) => (
          <article
            className={`template-card template-${index}`}
            key={d.template!.id}
          >
            <div className="template-art" aria-hidden="true">
              <span className="template-symbol">{["↗", "✳", "▦"][index]}</span>
              <div className="template-art-lines">
                <i />
                <i />
                <i />
              </div>
            </div>
            <div className="template-content">
              <p className="eyebrow">
                {locale === "pt-BR"
                  ? ["Mudanças", "Serviços residenciais", "Agências"][index]
                  : d.template!.category}
              </p>
              <h2>
                {localized(d.estimator, locale, "name", d.estimator.name)}
              </h2>
              <p>
                {localized(
                  d.estimator,
                  locale,
                  "description",
                  d.estimator.description ?? "",
                )}
              </p>
              <div className="template-meta">
                <span>
                  {d.estimator.steps.length} {t("step").toLowerCase()}s
                </span>
                <span>
                  {d.estimator.steps.flatMap((s) => s.fields).length}{" "}
                  {t("fields").toLowerCase()}
                </span>
              </div>
              {canCreate && (
                <Button
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await createFromTemplate(orgId, d.template!.id);
                      if (r?.error) setError(t("failure"));
                    })
                  }
                >
                  {t("useTemplate")} →
                </Button>
              )}
            </div>
          </article>
        ))}
      </div>
      {canCreate && (
        <section className="import-panel">
          <div>
            <h2>{t("import")}</h2>
            <p>
              {locale === "pt-BR"
                ? "Importe uma definição portátil. Sempre criamos uma nova calculadora, preservando as existentes."
                : "Bring a portable definition. Imports always create a new estimator and preserve existing ones."}
            </p>
          </div>
          <label className="button secondary">
            {pending ? t("working") : t("import")}
            <input
              className="sr-only"
              type="file"
              accept=".json,.oqs.json,application/json"
              disabled={pending}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                event.target.value = "";
                startTransition(async () => {
                  try {
                    if (!file.name.endsWith(".oqs.json") || file.size > 200000)
                      throw new Error();
                    const r = await importDocument(orgId, await file.text());
                    if (!r.id) throw new Error();
                    router.push(`/app/${orgId}/estimators/${r.id}`);
                  } catch {
                    setError(t("importError"));
                  }
                });
              }}
            />
          </label>
        </section>
      )}
    </>
  );
}
