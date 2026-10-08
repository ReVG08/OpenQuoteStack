"use client";
import { useState, useTransition } from "react";
import { platformAction } from "@/app/platform-actions";
export function SendEstimate({
  org,
  id,
  pt,
}: {
  org: string;
  id: string;
  pt: boolean;
}) {
  const [pending, start] = useTransition(),
    [message, setMessage] = useState("");
  return (
    <div>
      <button
        className="button secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            try {
              const r = await platformAction(org, "estimate.send", id);
              setMessage(
                r.ok
                  ? pt
                    ? "E-mail na fila de envio."
                    : "Email queued for delivery."
                  : pt
                    ? "Não foi possível enviar. Confira a configuração SMTP."
                    : "Could not send. Check the SMTP configuration.",
              );
            } catch {
              setMessage(pt ? "Falha de conexão." : "Connection failed.");
            }
          })
        }
      >
        {pending
          ? pt
            ? "Aguarde…"
            : "Working…"
          : pt
            ? "Enviar por e-mail"
            : "Send by email"}
      </button>
      <p role="status">{message}</p>
    </div>
  );
}
