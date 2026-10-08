import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { Header } from "@/components/header";
import { getLocale } from "@/lib/i18n";
export default async function Register({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const locale = getLocale((await searchParams).lang);
  return (
    <>
      <Header locale={locale} />
      <main className="narrow" lang={locale}>
        {process.env.OQS_DISABLE_REGISTRATION === "true" ? (
          <>
            <h1>
              {locale === "pt-BR"
                ? "Cadastro fechado"
                : "Registration is closed"}
            </h1>
            <p>
              {locale === "pt-BR"
                ? "Entre com uma conta existente ou fale com o administrador do servidor."
                : "Sign in with an existing account or contact the installation operator."}
            </p>
            <Link href={`/login?lang=${locale}`}>
              {locale === "pt-BR" ? "Entrar" : "Log in"}
            </Link>
          </>
        ) : (
          <AuthForm mode="register" locale={locale} />
        )}
      </main>
    </>
  );
}
