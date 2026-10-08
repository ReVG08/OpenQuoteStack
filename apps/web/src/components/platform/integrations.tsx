"use client";
import type { Integrations, PanelContext } from "./types";
export function IntegrationsPanel({
  data,
  pending,
  mutate,
  t,
  feedbackView,
  estimators,
  origin,
}: { data: Integrations } & PanelContext & {
    estimators: { id: string; name: string; organization: { slug: string } }[];
    origin: string;
  }) {
  const d = data as Integrations;
  return (
    <div className="platform-stack">
      {feedbackView}
      <section className="panel">
        <h2>{t("Email & embedding", "E-mail e incorporação")}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            mutate("settings.update", {
              notifications: {
                notifyEmail: f.get("notifyEmail"),
                customerConfirmation: f.get("confirmation") === "on",
                footer: f.get("footer"),
              },
              embedOrigins: String(f.get("origins"))
                .split("\n")
                .map((x) => x.trim())
                .filter(Boolean),
            });
          }}
        >
          <label>
            {t("New lead notifications", "Notificações de novos contatos")}
            <input
              type="email"
              name="notifyEmail"
              defaultValue={d.notifications.notifyEmail ?? ""}
            />
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              name="confirmation"
              defaultChecked={d.notifications.customerConfirmation}
            />
            {t(
              "Email a confirmation when customers share contact details",
              "Enviar confirmação quando o cliente informar seus dados",
            )}
          </label>
          <label>
            {t("Email footer", "Rodapé do e-mail")}
            <textarea
              name="footer"
              maxLength={500}
              defaultValue={d.notifications.footer ?? ""}
            />
          </label>
          <p className="muted">
            {t(
              "Your operator must configure SMTP and run the background worker for email delivery.",
              "O administrador do servidor deve configurar SMTP e executar o processo de segundo plano para enviar e-mails.",
            )}
          </p>
          <label>
            {t(
              "Allowed embed origins — one HTTPS origin per line",
              "Origens permitidas para incorporação — uma origem HTTPS por linha",
            )}
            <textarea
              name="origins"
              defaultValue={d.embedOrigins.join("\n")}
              placeholder="https://www.your-company.com"
            />
          </label>
          <button className="button primary" disabled={pending}>
            {t("Save integrations", "Salvar integrações")}
          </button>
        </form>
      </section>
      <section className="panel">
        <h2>
          {t(
            "Embed a published estimator",
            "Incorporar uma calculadora publicada",
          )}
        </h2>
        {!estimators.length && (
          <p>
            {t(
              "Publish an estimator to get its embed code.",
              "Publique uma calculadora para obter o código de incorporação.",
            )}
          </p>
        )}
        {estimators.map((e) => (
          <div key={e.id}>
            <h3>{e.name}</h3>
            <textarea
              readOnly
              aria-label={`${t("Embed code", "Código de incorporação")} ${e.name}`}
              value={`<script src="${origin}/embed.js" defer></script>\n<div data-oqs-estimator="${e.id}" data-oqs-organization="${e.organization.slug}"></div>`}
              onFocus={(x) => x.target.select()}
            />
            <p>
              <a
                href={`${origin}/q/${e.organization.slug}/${e.id}`}
                target="_blank"
                rel="noreferrer"
              >
                {t("Open public link", "Abrir link público")} ↗
              </a>
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}
