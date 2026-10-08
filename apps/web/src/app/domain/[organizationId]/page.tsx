import Link from "next/link";
import { notFound } from "next/navigation";
import { getDatabase } from "@openquotestack/database";
import { brandingOf, brandStyle } from "@/lib/branding";
export const dynamic = "force-dynamic";
export default async function Domain({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params,
    org = await getDatabase().organization.findUnique({
      where: { id: organizationId },
      include: {
        estimators: {
          where: { status: "published", deletedAt: null },
          select: { id: true, name: true },
        },
      },
    });
  if (!org) notFound();
  const brand = brandingOf(org.branding),
    pt = org.locale === "pt-BR";
  return (
    <main className="public-page" style={brandStyle(brand)} lang={org.locale}>
      <header className="public-header">
        <strong>{brand.displayName ?? org.name}</strong>
      </header>
      <section className="public-main">
        <h1>
          {pt
            ? "Vamos preparar seu orçamento."
            : "Let's prepare your estimate."}
        </h1>
        {org.estimators.map((e) => (
          <p key={e.id}>
            <Link className="button primary" href={`/q/${org.slug}/${e.id}`}>
              {e.name} →
            </Link>
          </p>
        ))}
        {!org.estimators.length && (
          <p>
            {pt ? "Nenhuma calculadora publicada." : "No published estimators."}
          </p>
        )}
      </section>
    </main>
  );
}
