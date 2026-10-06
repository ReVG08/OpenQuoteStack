"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card } from "@openquotestack/ui";
import { authClient } from "@/lib/auth-client";
import { messages, type Locale } from "@/lib/i18n";
export function AuthForm({
  mode,
  locale,
}: {
  mode: "login" | "register";
  locale: Locale;
}) {
  const t = messages(locale),
    router = useRouter();
  const [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  return (
    <Card>
      <h1>{mode === "login" ? t.login : t.register}</h1>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (pending) return;
          const data = new FormData(e.currentTarget);
          setPending(true);
          setError("");
          try {
            const payload = {
              email: String(data.get("email")),
              password: String(data.get("password")),
            };
            const result =
              mode === "login"
                ? await authClient.signIn.email(payload)
                : await authClient.signUp.email({
                    ...payload,
                    name: String(data.get("name")),
                  });
            if (result.error) setError(t.authError);
            else {
              router.push(`/app?lang=${locale}`);
              router.refresh();
            }
          } catch {
            setError(t.authError);
          } finally {
            setPending(false);
          }
        }}
      >
        {mode === "register" && (
          <label>
            {t.name}
            <input name="name" autoComplete="name" required maxLength={100} />
          </label>
        )}
        <label>
          {t.email}
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          {t.password}
          <input
            name="password"
            type="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            minLength={12}
            maxLength={128}
            required
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <Button disabled={pending}>{pending ? t.working : t.submit}</Button>
      </form>
      <p>
        <Link
          href={`/${mode === "login" ? "register" : "login"}?lang=${locale}`}
        >
          {mode === "login" ? t.register : t.login}
        </Link>
      </p>
    </Card>
  );
}
export function Logout({ label }: { label: string }) {
  const router = useRouter();
  return (
    <Button
      className="secondary"
      onClick={async () => {
        const result = await authClient.signOut();
        if (!result.error) {
          router.push("/");
          router.refresh();
        }
      }}
    >
      {label}
    </Button>
  );
}
