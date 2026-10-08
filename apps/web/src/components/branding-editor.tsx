"use client";
import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@openquotestack/ui";
import type { Branding } from "@openquotestack/core";
import { copy } from "@/lib/product-i18n";
import type { Locale } from "@/lib/i18n";
import { brandStyle } from "@/lib/branding";
import { saveOrganization } from "@/app/product-actions";
export type OrganizationInput = {
  name: string;
  slug: string;
  locale: Locale;
  timezone: string;
  defaultCurrency: string;
  branding: Branding;
};
export function BrandingEditor({
  orgId,
  initial,
  locale,
  settings = false,
}: {
  orgId: string;
  initial: OrganizationInput;
  locale: Locale;
  settings?: boolean;
}) {
  const [data, setData] = useState(initial),
    [pending, startTransition] = useTransition(),
    [uploading, setUploading] = useState(false),
    [state, setState] = useState<"idle" | "saved" | "error">("idle"),
    t = copy(locale),
    router = useRouter(),
    b = data.branding;
  const update = (next: Branding) => {
    setData((d) => ({ ...d, branding: next }));
    setState("idle");
  };
  async function upload(file: File, key: "logo" | "favicon") {
    setUploading(true);
    setState("idle");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch(`/app/${orgId}/assets`, {
        method: "POST",
        body: form,
      });
      const body = await response.json();
      if (!response.ok || typeof body.url !== "string") throw new Error();
      setData((d) => ({ ...d, branding: { ...d.branding, [key]: body.url } }));
    } catch {
      setState("error");
    } finally {
      setUploading(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{data.name}</p>
          <h1>{t(settings ? "settings" : "branding")}</h1>
          <p>
            {settings
              ? locale === "pt-BR"
                ? "Idioma, moeda e detalhes do seu espaço de trabalho."
                : "Language, currency and workspace details."
              : locale === "pt-BR"
                ? "Uma experiência que tem a cara do seu negócio."
                : "An experience that feels like your business."}
          </p>
        </div>
      </div>
      <div className="branding-layout">
        <form
          className="detail-panel"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              const result = await saveOrganization(orgId, data);
              setState(result.ok ? "saved" : "error");
              if (result.ok) router.refresh();
            });
          }}
        >
          {settings ? (
            <>
              <label>
                {t("name")}
                <input
                  value={data.name}
                  minLength={2}
                  maxLength={100}
                  required
                  onChange={(e) =>
                    setData((d) => ({ ...d, name: e.target.value }))
                  }
                />
              </label>
              <label>
                {locale === "pt-BR"
                  ? "Identificador público"
                  : "Public identifier"}
                <input
                  value={data.slug}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  minLength={2}
                  maxLength={60}
                  required
                  onChange={(e) =>
                    setData((d) => ({ ...d, slug: e.target.value }))
                  }
                />
                <small>
                  {locale === "pt-BR"
                    ? "Alterar este valor muda os links públicos."
                    : "Changing this value changes public links."}
                </small>
              </label>
              <label>
                {locale === "pt-BR" ? "Idioma" : "Language"}
                <select
                  value={data.locale}
                  onChange={(e) =>
                    setData((d) => ({ ...d, locale: e.target.value as Locale }))
                  }
                >
                  <option value="en">English</option>
                  <option value="pt-BR">Português (Brasil)</option>
                </select>
                <small>
                  {locale === "pt-BR"
                    ? "Calculadoras publicadas mantêm o idioma da revisão."
                    : "Published estimators keep their revision language."}
                </small>
              </label>
              <label>
                {locale === "pt-BR" ? "Moeda padrão" : "Default currency"}
                <input
                  value={data.defaultCurrency}
                  required
                  pattern="[A-Z]{3}"
                  onChange={(e) =>
                    setData((d) => ({ ...d, defaultCurrency: e.target.value }))
                  }
                />
                <small>
                  {locale === "pt-BR"
                    ? "A moeda padrão se aplica a novas calculadoras. Orçamentos existentes não são convertidos."
                    : "The default applies to new estimators. Existing estimates are not converted."}
                </small>
              </label>
              <label>
                {locale === "pt-BR" ? "Fuso horário" : "Timezone"}
                <input
                  value={data.timezone}
                  required
                  onChange={(e) =>
                    setData((d) => ({ ...d, timezone: e.target.value }))
                  }
                />
              </label>
            </>
          ) : (
            <>
              <h2>{t("appearance")}</h2>
              <label>
                {t("displayName")}
                <input
                  value={b.displayName ?? ""}
                  maxLength={100}
                  onChange={(e) =>
                    update({ ...b, displayName: e.target.value })
                  }
                />
              </label>
              <div className="form-grid">
                {(["logo", "favicon"] as const).map((key) => (
                  <div className="asset-control" key={key}>
                    <label>
                      {t(key)}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        disabled={uploading}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void upload(f, key);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    {b[key] && (
                      <>
                        <Image
                          src={b[key]!}
                          unoptimized
                          width={80}
                          height={48}
                          alt={t(key)}
                        />
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => {
                            const next = { ...b };
                            delete next[key];
                            update(next);
                          }}
                        >
                          {t("remove")}
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <p className="field-help">{t("logoHelp")}</p>
              <div className="form-grid">
                {(
                  ["primaryColor", "secondaryColor", "backgroundColor"] as const
                ).map((key, i) => (
                  <label key={key}>
                    {t((["primary", "secondary", "background"] as const)[i]!)}
                    <input
                      type="color"
                      value={b[key] ?? ["#176653", "#344d47", "#f5f6f3"][i]!}
                      onChange={(e) => update({ ...b, [key]: e.target.value })}
                    />
                  </label>
                ))}
                <label>
                  {t("radius")}
                  <input
                    type="range"
                    min={0}
                    max={20}
                    value={b.radius ?? 10}
                    onChange={(e) =>
                      update({ ...b, radius: Number(e.target.value) })
                    }
                  />
                  <output>{b.radius ?? 10}px</output>
                </label>
              </div>
              <div className="form-grid">
                <label>
                  {t("font")}
                  <select
                    value={b.font ?? "sans"}
                    onChange={(e) =>
                      update({ ...b, font: e.target.value as Branding["font"] })
                    }
                  >
                    {(["sans", "serif", "mono"] as const).map((f) => (
                      <option value={f} key={f}>
                        {t(f)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("buttonStyle")}
                  <select
                    value={b.buttonStyle ?? "solid"}
                    onChange={(e) =>
                      update({
                        ...b,
                        buttonStyle: e.target.value as Branding["buttonStyle"],
                      })
                    }
                  >
                    <option value="solid">{t("solid")}</option>
                    <option value="outline">{t("outline")}</option>
                  </select>
                </label>
              </div>
              <h2>{t("details")}</h2>
              {(["businessAddress", "email", "phone", "website"] as const).map(
                (key) => (
                  <label key={key}>
                    {t(key === "businessAddress" ? "address" : key)}
                    <input
                      type={
                        key === "email"
                          ? "email"
                          : key === "website"
                            ? "url"
                            : "text"
                      }
                      value={b[key] ?? ""}
                      maxLength={key === "businessAddress" ? 500 : 200}
                      onChange={(e) => update({ ...b, [key]: e.target.value })}
                    />
                  </label>
                ),
              )}
            </>
          )}
          <Button disabled={pending || uploading}>
            {pending ? t("saving") : uploading ? t("working") : t("save")}
          </Button>
          {state !== "idle" && (
            <p role={state === "error" ? "alert" : "status"}>
              {t(state === "error" ? "failure" : "saved")}
            </p>
          )}
        </form>
        {!settings && (
          <aside className="branding-preview">
            <div className="section-heading">
              <h2>{t("preview")}</h2>
              <span className="badge">{t("live")}</span>
            </div>
            <div
              className={`preview-frame ${b.buttonStyle === "outline" ? "brand-outline" : ""}`}
              style={brandStyle(b)}
            >
              <div className="preview-brand">
                {b.logo ? (
                  <Image
                    unoptimized
                    src={b.logo}
                    alt={b.displayName ?? data.name}
                    width={160}
                    height={50}
                  />
                ) : (
                  (b.displayName ?? data.name)
                )}
              </div>
              <div className="runtime-card">
                <p className="eyebrow">{t("step")} 1 / 3</p>
                <h2>
                  {locale === "pt-BR"
                    ? "Vamos estimar seu serviço."
                    : "Let’s estimate your service."}
                </h2>
                <label>
                  {locale === "pt-BR"
                    ? "Conte o que você precisa"
                    : "Tell us what you need"}
                  <input
                    placeholder={
                      locale === "pt-BR" ? "Alguns detalhes…" : "A few details…"
                    }
                    readOnly
                  />
                </label>
                <Button type="button">{t("continue")} →</Button>
              </div>
            </div>
            <p className="fineprint">{t("readability")}</p>
          </aside>
        )}
      </div>
    </>
  );
}
