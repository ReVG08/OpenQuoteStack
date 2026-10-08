"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateEstimate } from "@/app/product-actions";
import { copy } from "@/lib/product-i18n";
import type { Locale } from "@/lib/i18n";
import { Button } from "@openquotestack/ui";
export function EstimateManagement({
  orgId,
  id,
  status,
  locale,
}: {
  orgId: string;
  id: string;
  status: string;
  locale: Locale;
}) {
  const t = copy(locale),
    router = useRouter(),
    [pending, startTransition] = useTransition(),
    [state, setState] = useState<"idle" | "saved" | "error">("idle");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget,
          data = new FormData(form);
        startTransition(async () => {
          const r = await updateEstimate(
            orgId,
            id,
            String(data.get("status")),
            String(data.get("note")),
          );
          setState(r.ok ? "saved" : "error");
          if (r.ok) {
            form.reset();
            router.refresh();
          }
        });
      }}
    >
      <label>
        {t("status")}
        <select name="status" defaultValue={status}>
          {(
            [
              "new",
              "contacted",
              "qualified",
              "won",
              "lost",
              "archived",
            ] as const
          ).map((s) => (
            <option key={s} value={s}>
              {t(s)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("internalNote")}
        <textarea name="note" maxLength={4000} />
      </label>
      <Button disabled={pending}>{pending ? t("saving") : t("save")}</Button>
      {state !== "idle" && (
        <p role={state === "error" ? "alert" : "status"}>
          {t(state === "error" ? "failure" : "saved")}
        </p>
      )}
    </form>
  );
}
