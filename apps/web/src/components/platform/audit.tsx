"use client";
import type { Audit, PanelContext } from "./types";
export function AuditPanel({
  data,
  t,
  date,
}: { data: Audit[] } & PanelContext) {
  return (
    <section className="panel">
      <p className="muted">
        {t(
          "The latest 200 events. Secret values and customer answers are never recorded here.",
          "Os 200 eventos mais recentes. Segredos e respostas de clientes nunca são registrados aqui.",
        )}
      </p>
      {(data as Audit[]).map((a) => (
        <article className="integration-row" key={a.id}>
          <div>
            <strong>{a.action}</strong>
            <p>
              <code>{a.resourceId}</code>
            </p>
            <small>
              {t("Actor", "Autor")}: {a.actorId}
            </small>
          </div>
          <time dateTime={a.createdAt}>{date(a.createdAt)}</time>
        </article>
      ))}
    </section>
  );
}
