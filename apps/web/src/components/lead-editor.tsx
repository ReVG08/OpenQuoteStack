"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { platformAction } from "@/app/platform-actions";
export function LeadEditor({
  org,
  lead,
  pt,
}: {
  org: string;
  lead: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    company?: string | null;
    address?: string | null;
    notes?: string | null;
  };
  pt: boolean;
}) {
  const [pending, start] = useTransition(),
    [message, setMessage] = useState(""),
    router = useRouter();
  return (
    <details className="contact-editor">
      <summary>{pt ? "Editar contato" : "Edit contact"}</summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget),
            contact = Object.fromEntries(
              ["name", "email", "phone", "company", "address", "notes"].map(
                (key) => [key, String(form.get(key) ?? "")],
              ),
            );
          start(async () => {
            try {
              const result = await platformAction(org, "lead.update", {
                id: lead.id,
                contact,
              });
              setMessage(
                result.ok
                  ? pt
                    ? "Contato atualizado."
                    : "Contact updated."
                  : pt
                    ? "Confira os dados e tente novamente."
                    : "Check the details and try again.",
              );
              if (result.ok) router.refresh();
            } catch {
              setMessage(pt ? "Falha de conexão." : "Connection failed.");
            }
          });
        }}
      >
        <label>
          {pt ? "Nome" : "Name"}
          <input
            name="name"
            required
            maxLength={100}
            defaultValue={lead.name}
          />
        </label>
        <label>
          {pt ? "E-mail" : "Email"}
          <input
            name="email"
            type="email"
            required
            maxLength={250}
            defaultValue={lead.email}
          />
        </label>
        <label>
          {pt ? "Telefone" : "Phone"}
          <input
            name="phone"
            type="tel"
            maxLength={80}
            defaultValue={lead.phone ?? ""}
          />
        </label>
        <label>
          {pt ? "Empresa" : "Company"}
          <input
            name="company"
            maxLength={200}
            defaultValue={lead.company ?? ""}
          />
        </label>
        <label>
          {pt ? "Endereço" : "Address"}
          <textarea
            name="address"
            maxLength={500}
            defaultValue={lead.address ?? ""}
          />
        </label>
        <label>
          {pt ? "Observações do cliente" : "Customer notes"}
          <textarea
            name="notes"
            maxLength={2000}
            defaultValue={lead.notes ?? ""}
          />
        </label>
        <button disabled={pending}>
          {pending
            ? pt
              ? "Salvando…"
              : "Saving…"
            : pt
              ? "Salvar contato"
              : "Save contact"}
        </button>
        <p role="status">{message}</p>
      </form>
    </details>
  );
}
