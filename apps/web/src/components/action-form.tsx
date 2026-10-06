"use client";
import { useActionState } from "react";
import { Button } from "@openquotestack/ui";
import type { ActionState } from "@/app/actions";
import { messages, type Locale } from "@/lib/i18n";
export function ActionForm({
  action,
  label,
  locale,
  children,
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  label: string;
  locale: Locale;
  children?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {}),
    t = messages(locale);
  return (
    <form action={formAction}>
      {children}
      {state.error && <p role="alert">{t.failure}</p>}
      {state.success && <p role="status">✓</p>}
      <Button disabled={pending}>{pending ? t.working : label}</Button>
    </form>
  );
}
