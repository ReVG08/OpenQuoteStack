import type { Metadata } from "next";
import { cache } from "react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { services } from "@/lib/services";
import { Calculator } from "@/components/calculator";
import { brandingOf, brandStyle } from "@/lib/branding";
import { getLocale } from "@/lib/i18n";
import { localized } from "@/lib/product-i18n";
const loadPublic = cache((slug: string, id: string) =>
  services().publicEstimator(slug, id),
);
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; estimatorId: string }>;
}): Promise<Metadata> {
  const { slug, estimatorId } = await params;
  try {
    const data = await loadPublic(slug, estimatorId);
    const e = data.definition.estimator,
      locale = getLocale(e.locale),
      brand = brandingOf(data.organization.branding);
    return {
      title: {
        absolute: `${localized(e, locale, "name", e.name)} · ${brand.displayName ?? data.organization.name}`,
      },
      description: localized(e, locale, "description", e.description ?? ""),
    };
  } catch {
    return { title: "OpenQuoteStack" };
  }
}
export const dynamic = "force-dynamic";
export default async function PublicEstimator({
  params,
}: {
  params: Promise<{ slug: string; estimatorId: string }>;
}) {
  const { slug, estimatorId } = await params;
  let data;
  try {
    data = await loadPublic(slug, estimatorId);
  } catch {
    notFound();
  }
  const e = data.definition.estimator,
    locale = getLocale(e.locale),
    brand = brandingOf(data.organization.branding);
  return (
    <div
      className={`public-page ${brand.buttonStyle === "outline" ? "brand-outline" : ""}`}
      style={brandStyle(brand)}
      lang={locale}
    >
      {brand.favicon && <link rel="icon" href={brand.favicon} />}
      <header className="public-header">
        {brand.logo ? (
          <Image
            unoptimized
            src={brand.logo}
            alt={brand.displayName ?? data.organization.name}
            width={170}
            height={48}
          />
        ) : (
          <strong>{brand.displayName ?? data.organization.name}</strong>
        )}
        <span>{localized(e, locale, "name", e.name)}</span>
      </header>
      <main className="public-main">
        <p className="public-description">
          {localized(e, locale, "description", e.description ?? "")}
        </p>
        <div className="runtime-card">
          <Calculator
            estimator={e}
            locale={locale}
            publicQuote={{ slug, id: estimatorId, revisionId: data.revisionId }}
          />
        </div>
        <footer className="public-footer">
          {brand.email && <a href={`mailto:${brand.email}`}>{brand.email}</a>}
          {brand.phone && <span>{brand.phone}</span>}
        </footer>
      </main>
    </div>
  );
}
