import Link from "next/link";
import { Header } from "@/components/header";
import { messages, getLocale } from "@/lib/i18n";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const locale = getLocale((await searchParams).lang),
    t = messages(locale);
  return (
    <>
      <Header locale={locale} />
      <main lang={locale}>
        <section className="hero">
          <p className="eyebrow">OpenQuoteStack · 0.1</p>
          <h1>{t.tagline}</h1>
          <p className="lead">{t.subtitle}</p>
          <div className="actions">
            <Link className="button" href={`/register?lang=${locale}`}>
              {t.register}
            </Link>
            <Link className="button secondary" href={`/demo?lang=${locale}`}>
              {t.demo}
            </Link>
          </div>
        </section>
        <div className="grid-three">
          {(locale === "pt-BR"
            ? [
                [
                  "Preços explicáveis",
                  "Regras declarativas, valores exatos e cálculos detalhados.",
                ],
                [
                  "Hospedagem própria",
                  "PostgreSQL e uma aplicação que você pode operar no seu servidor.",
                ],
                [
                  "Versões preservadas",
                  "Orçamentos salvos mantêm sua configuração de preços original.",
                ],
              ]
            : [
                [
                  "Explainable pricing",
                  "Declarative rules, exact amounts and itemized calculations.",
                ],
                [
                  "Self-hosted",
                  "PostgreSQL and an application you can operate on your own server.",
                ],
                [
                  "Preserved revisions",
                  "Saved estimates retain their original pricing configuration.",
                ],
              ]
          ).map(([title, body]) => (
            <section className="card" key={title}>
              <h2>{title}</h2>
              <p>{body}</p>
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
