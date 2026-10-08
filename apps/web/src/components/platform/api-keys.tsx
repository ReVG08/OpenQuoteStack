"use client";
import { apiScopes } from "@openquotestack/sdk/api-types";
import type { Key, PanelContext } from "./types";
export function ApiKeysPanel({
  data,
  pending,
  mutate,
  t,
  date,
  feedbackView,
}: { data: Key[] } & PanelContext) {
  return (
    <div className="platform-stack">
      {feedbackView}
      <section className="panel">
        <h2>{t("Create an API key", "Criar chave de API")}</h2>
        <p className="muted">
          {t(
            "Use keys on your server. Give each integration only the scopes it needs.",
            "Use chaves no servidor. Conceda apenas as permissões necessárias a cada integração.",
          )}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            mutate("key.create", {
              name: f.get("name"),
              description: f.get("description") || undefined,
              scopes: f.getAll("scope"),
            });
          }}
        >
          <label>
            {t("Name", "Nome")}
            <input
              name="name"
              required
              maxLength={100}
              placeholder={t("Website integration", "Integração do site")}
            />
          </label>
          <label>
            {t("Description (optional)", "Descrição (opcional)")}
            <input name="description" maxLength={500} />
          </label>
          <fieldset>
            <legend>{t("Scopes", "Permissões")}</legend>
            {apiScopes.map((s) => (
              <label className="check-label" key={s}>
                <input type="checkbox" name="scope" value={s} />
                <code>{s}</code>
              </label>
            ))}
          </fieldset>
          <button className="button primary" disabled={pending}>
            {t("Create key", "Criar chave")}
          </button>
        </form>
      </section>
      <section className="panel">
        <h2>{t("Your API keys", "Suas chaves de API")}</h2>
        {(data as Key[]).length === 0 ? (
          <p className="muted">{t("No keys yet.", "Nenhuma chave ainda.")}</p>
        ) : (
          (data as Key[]).map((k) => (
            <article className="integration-row" key={k.id}>
              <div>
                <strong>{k.name}</strong>
                <p>
                  <code>{k.prefix}…</code> · {k.scopes.join(", ")}
                </p>
                <small>
                  {t("Created", "Criada")} {date(k.createdAt)} ·{" "}
                  {t("Last used", "Último uso")} {date(k.lastUsedAt)}
                </small>
              </div>
              {k.revokedAt ? (
                <span className="status-badge">{t("Revoked", "Revogada")}</span>
              ) : (
                <button
                  disabled={pending}
                  onClick={() => {
                    if (
                      confirm(
                        t(
                          "Revoke this key? Its integrations will stop working.",
                          "Revogar esta chave? Suas integrações deixarão de funcionar.",
                        ),
                      )
                    )
                      mutate("key.revoke", k.id);
                  }}
                >
                  {t("Revoke", "Revogar")}
                </button>
              )}
            </article>
          ))
        )}
      </section>
    </div>
  );
}
