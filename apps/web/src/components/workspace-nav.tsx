"use client";
import { DocumentLanguage } from "./document-language";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { copy, type CopyKey } from "@/lib/product-i18n";
import type { Locale } from "@/lib/i18n";
import { ThemeToggle } from "./theme-toggle";
import { Logout } from "./auth-form";
export function WorkspaceNav({
  id,
  name,
  locale,
  canManage,
}: {
  id: string;
  name: string;
  locale: Locale;
  canManage: boolean;
}) {
  const path = usePathname(),
    base = `/app/${id}`,
    t = copy(locale);
  const links = [
    ["", "overview", "◫"],
    ["/estimators", "estimators", "▤"],
    ["/estimates", "estimates", "↗"],
    ["/leads", "leads", "♧"],
    ["/templates", "templates", "▦"],
    ["/analytics", "analytics", "▥"],
    ...(canManage
      ? [
          ["/branding", "branding", "◐"],
          ["/settings", "settings", "⚙"],
        ]
      : []),
  ] as const;
  return (
    <aside className="workspace-sidebar">
      <DocumentLanguage locale={locale} />
      <Link className="brand" href="/app">
        <span className="brand-mark">O</span>
        <span>OpenQuoteStack</span>
      </Link>
      <Link className="tenant-switch" href="/app">
        <span className="tenant-avatar">{name.slice(0, 1).toUpperCase()}</span>
        <span>
          {name}
          <small>
            {locale === "pt-BR" ? "Seu espaço de trabalho" : "Your workspace"}
          </small>
        </span>
        <span aria-hidden="true">⌄</span>
      </Link>
      <nav
        aria-label={
          locale === "pt-BR"
            ? "Navegação do espaço de trabalho"
            : "Workspace navigation"
        }
      >
        {links.map(([suffix, key, icon]) => (
          <Link
            key={key}
            className={
              path === base + suffix ||
              (suffix && path.startsWith(base + suffix + "/"))
                ? "active"
                : ""
            }
            href={base + suffix}
          >
            <span aria-hidden="true">{icon}</span>
            {t(key as CopyKey)}
          </Link>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <ThemeToggle label={locale === "pt-BR" ? "Tema" : "Theme"} />
        <Logout label={locale === "pt-BR" ? "Sair" : "Log out"} />
      </div>
    </aside>
  );
}
