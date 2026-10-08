"use client";
import { platformAction } from "@/app/platform-actions";
import type { Locale } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { useState, useTransition, useRef, useEffect } from "react";
import { ApiKeysPanel } from "./platform/api-keys";
import { AuditPanel } from "./platform/audit";
import { DomainsPanel } from "./platform/domains";
import { IntegrationsPanel } from "./platform/integrations";
import { SystemPanel } from "./platform/system";
import type {
  Audit,
  Delivery,
  Domain,
  Endpoint,
  Integrations,
  Key,
  PanelData,
  Status,
} from "./platform/types";
import { WebhooksPanel } from "./platform/webhooks";
export function PlatformPanel({
  org,
  locale,
  section,
  data,
  estimators,
  origin,
}: {
  org: string;
  locale: Locale;
  section: string;
  data: PanelData;
  estimators: { id: string; name: string; organization: { slug: string } }[];
  origin: string;
}) {
  const pt = locale === "pt-BR",
    router = useRouter(),
    [pending, start] = useTransition(),
    [secret, setSecret] = useState(""),
    [feedback, setFeedback] = useState("");
  const secretInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (secret) {
      secretInput.current?.focus();
      secretInput.current?.select();
    }
  }, [secret]);
  const t = (en: string, br: string) => (pt ? br : en);
  function mutate(operation: string, input: unknown) {
    setFeedback("");
    start(async () => {
      try {
        const r = await platformAction(org, operation, input);
        if (r.error)
          setFeedback(
            t(
              "Could not save. Check your permissions, configuration and input.",
              "Não foi possível salvar. Confira as permissões, configurações e dados.",
            ),
          );
        else {
          if (r.secret) setSecret(r.secret);
          setFeedback(t("Saved.", "Salvo."));
          router.refresh();
        }
      } catch {
        setFeedback(
          t(
            "Connection failed. Try again.",
            "Falha de conexão. Tente novamente.",
          ),
        );
      }
    });
  }
  const date = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat(locale, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(value))
      : "—";
  const feedbackView = (
    <>
      <p role="status" aria-live="polite">
        {pending ? t("Saving…", "Salvando…") : feedback}
      </p>
      {secret && (
        <section
          className="secret-panel"
          aria-label={t("New secret", "Novo segredo")}
        >
          <strong>
            {t(
              "Copy this secret now. It will not be shown again.",
              "Copie este segredo agora. Ele não será exibido novamente.",
            )}
          </strong>
          <input
            aria-label={t("Secret", "Segredo")}
            ref={secretInput}
            autoComplete="off"
            spellCheck={false}
            readOnly
            value={secret}
            onFocus={(e) => e.target.select()}
          />
          <button onClick={() => setSecret("")}>
            {t("I've saved it", "Já salvei")}
          </button>
        </section>
      )}
    </>
  );
  const context = { pending, mutate, t, date, feedbackView };
  if (section === "api-keys")
    return <ApiKeysPanel {...context} data={data as Key[]} />;
  if (section === "webhooks")
    return (
      <WebhooksPanel
        {...context}
        data={data as { endpoints: Endpoint[]; deliveries: Delivery[] }}
      />
    );
  if (section === "domains")
    return <DomainsPanel {...context} data={data as Domain[]} />;
  if (section === "integrations")
    return (
      <IntegrationsPanel
        {...context}
        data={data as Integrations}
        estimators={estimators}
        origin={origin}
      />
    );
  if (section === "audit")
    return <AuditPanel {...context} data={data as Audit[]} />;
  return <SystemPanel {...context} data={data as Status} />;
}
