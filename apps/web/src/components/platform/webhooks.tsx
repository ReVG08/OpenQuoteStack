"use client";
import { webhookEvents } from "@openquotestack/sdk/api-types";
import type { Delivery, Endpoint, PanelContext } from "./types";
export function WebhooksPanel({
  data,
  pending,
  mutate,
  t,
  feedbackView,
}: { data: { endpoints: Endpoint[]; deliveries: Delivery[] } } & PanelContext) {
  const d = data as { endpoints: Endpoint[]; deliveries: Delivery[] };
  return (
    <div className="platform-stack">
      {feedbackView}
      <section className="panel">
        <h2>{t("Add an endpoint", "Adicionar destino")}</h2>
        <p className="muted">
          {t(
            "Public HTTPS destinations only. Deliveries are signed and retried in the background.",
            "Apenas destinos HTTPS públicos. As entregas são assinadas e repetidas em segundo plano.",
          )}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            mutate("webhook.create", {
              url: f.get("url"),
              subscriptions: f.getAll("event"),
            });
          }}
        >
          <label>
            URL
            <input
              name="url"
              type="url"
              required
              placeholder="https://your-service.com/webhooks"
              maxLength={2000}
            />
          </label>
          <fieldset>
            <legend>{t("Events", "Eventos")}</legend>
            {webhookEvents.map((ev) => (
              <label className="check-label" key={ev}>
                <input type="checkbox" name="event" value={ev} />
                <code>{ev}</code>
              </label>
            ))}
          </fieldset>
          <button className="button primary" disabled={pending}>
            {t("Add endpoint", "Adicionar destino")}
          </button>
        </form>
      </section>
      <section className="panel">
        <h2>{t("Endpoints", "Destinos")}</h2>
        {!d.endpoints.length && (
          <p>{t("No endpoints yet.", "Nenhum destino ainda.")}</p>
        )}
        {d.endpoints.map((ep) => (
          <article className="integration-row" key={ep.id}>
            <div>
              <strong>{ep.url}</strong>
              <p>{ep.subscriptions.join(", ")}</p>
            </div>
            {ep.active ? (
              <button
                disabled={pending}
                onClick={() => mutate("webhook.disable", ep.id)}
              >
                {t("Disable", "Desativar")}
              </button>
            ) : (
              <span>{t("Disabled", "Desativado")}</span>
            )}
          </article>
        ))}
      </section>
      <section className="panel">
        <h2>{t("Recent deliveries", "Entregas recentes")}</h2>
        {!d.deliveries.length && (
          <p className="muted">
            {t(
              "Subscribed events will appear here.",
              "Os eventos assinados aparecerão aqui.",
            )}
          </p>
        )}
        {d.deliveries.map((x) => (
          <article className="integration-row" key={x.id}>
            <div>
              <code>{x.eventId}</code>
              <p>
                {x.status} · HTTP {x.responseCode ?? "—"} ·{" "}
                {x.durationMs ?? "—"} ms · {x.attempts}{" "}
                {t("attempts", "tentativas")}
              </p>
              {x.errorCategory && <small>{x.errorCategory}</small>}
            </div>
            {x.status === "failed" && (
              <button
                disabled={pending}
                onClick={() => mutate("webhook.retry", x.id)}
              >
                {t("Retry", "Tentar novamente")}
              </button>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
