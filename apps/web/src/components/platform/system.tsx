"use client";
import type { PanelContext, Status } from "./types";
export function SystemPanel({ data, t }: { data: Status } & PanelContext) {
  const s = data as Status;
  return (
    <section className="panel">
      <h2>OpenQuoteStack {s.version}</h2>
      <p>
        {t("Build", "Compilação")}: <code>{s.build}</code>
      </p>
      {[
        [t("Database", "Banco de dados"), s.database],
        [t("Storage", "Armazenamento") + ` (${s.storageDriver})`, s.storage],
        ["SMTP", s.smtp],
        [t("Background worker", "Processo de segundo plano"), s.worker],
      ].map(([label, good]) => (
        <div className="integration-row" key={String(label)}>
          <strong>{label}</strong>
          <span>
            {good
              ? t("Ready", "Pronto")
              : t(
                  "Unavailable or not configured",
                  "Indisponível ou não configurado",
                )}
          </span>
        </div>
      ))}
      <p>
        {s.pending} {t("pending jobs", "tarefas pendentes")} · {s.failed}{" "}
        {t("failed jobs", "tarefas com falha")}
      </p>
      <p className="muted">
        {t(
          "SMTP status reflects configuration; delivery errors are recorded by the worker.",
          "O status SMTP reflete a configuração; erros de entrega são registrados pelo processo de segundo plano.",
        )}
      </p>
    </section>
  );
}
