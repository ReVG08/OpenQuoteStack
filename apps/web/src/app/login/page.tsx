import { AuthForm } from "@/components/auth-form";
import { Header } from "@/components/header";
import { getLocale } from "@/lib/i18n";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const locale = getLocale((await searchParams).lang);
  return (
    <>
      <Header locale={locale} />
      <main className="narrow" lang={locale}>
        <AuthForm mode="login" locale={locale} />
      </main>
    </>
  );
}
