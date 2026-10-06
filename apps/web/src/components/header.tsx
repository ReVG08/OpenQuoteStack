import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { messages, type Locale } from "@/lib/i18n";
export function Header({ locale }: { locale: Locale }) {
  const t = messages(locale);
  return (
    <header lang={locale}>
      <Link className="brand" href={`/?lang=${locale}`}>
        <span className="brand-mark">O</span>OpenQuoteStack
      </Link>
      <nav
        aria-label={
          locale === "pt-BR" ? "Navegação principal" : "Main navigation"
        }
      >
        <Link href={`/demo?lang=${locale}`}>Demo</Link>
        <Link href={`/app?lang=${locale}`}>{t.dashboard}</Link>
        <Link href="?lang=en" lang="en">
          EN
        </Link>
        <Link href="?lang=pt-BR" lang="pt-BR">
          PT
        </Link>
        <ThemeToggle label={t.theme} />
      </nav>
    </header>
  );
}
