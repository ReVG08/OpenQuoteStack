"use client";
import type { Domain, PanelContext } from "./types";
export function DomainsPanel({
  data,
  pending,
  mutate,
  t,
  feedbackView,
}: { data: Domain[] } & PanelContext) {
  return (
    <div className="platform-stack">
      {feedbackView}
      <section className="panel">
        <h2>{t("Connect your domain", "Conectar seu domínio")}</h2>
        <p className="muted">
          {t(
            "Point DNS to your server and configure HTTPS at your reverse proxy. Add the TXT record below, then verify ownership.",
            "Aponte o DNS para seu servidor e configure HTTPS no proxy reverso. Adicione o registro TXT abaixo e verifique a propriedade.",
          )}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutate(
              "domain.create",
              new FormData(e.currentTarget).get("hostname"),
            );
          }}
        >
          <label>
            {t("Hostname", "Domínio")}
            <input
              name="hostname"
              required
              placeholder="quote.your-company.com"
              maxLength={253}
            />
          </label>
          <button className="button primary" disabled={pending}>
            {t("Add domain", "Adicionar domínio")}
          </button>
        </form>
      </section>
      {(data as Domain[]).map((d) => (
        <section className="panel" key={d.id}>
          <div className="integration-row">
            <h2>{d.hostname}</h2>
            <span className="status-badge">{d.status}</span>
          </div>
          <p>
            TXT <code>_oqs.{d.hostname}</code>
          </p>
          <input
            readOnly
            aria-label={t("DNS verification value", "Valor de verificação DNS")}
            value={`v=OQS1;token=${d.verifyToken}`}
            onFocus={(e) => e.target.select()}
          />
          {d.errorCategory && (
            <p role="status">
              {t(
                "DNS verification failed. Check the TXT record and public address records.",
                "Falha na verificação DNS. Confira o registro TXT e os registros de endereço público.",
              )}
            </p>
          )}
          <div className="button-row">
            <button
              disabled={pending}
              onClick={() => mutate("domain.verify", d.id)}
            >
              {t("Verify DNS", "Verificar DNS")}
            </button>
            <button
              disabled={pending}
              onClick={() => {
                if (
                  confirm(
                    t("Disconnect this domain?", "Desconectar este domínio?"),
                  )
                )
                  mutate("domain.remove", d.id);
              }}
            >
              {t("Remove", "Remover")}
            </button>
          </div>
        </section>
      ))}
    </div>
  );
}
