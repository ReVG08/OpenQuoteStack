import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@openquotestack/database";
const unavailable = () => new NextResponse("Not found", { status: 404 });
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname,
    primary = new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000"),
    host = request.headers.get("host")?.toLowerCase();
  if (path === "/health" || path === "/api/health") return NextResponse.next();
  const db = getDatabase();
  let domain: {
    organizationId: string;
    organization: { slug: string };
  } | null = null;
  if (host !== primary.host) {
    if (!host || host.includes(":") || !/^[a-z0-9.-]{1,253}$/.test(host))
      return unavailable();
    domain = await db.customDomain.findFirst({
      where: {
        hostname: host,
        status: "active",
        checkedAt: { gte: new Date(Date.now() - 86400000) },
      },
      select: {
        organizationId: true,
        organization: { select: { slug: true } },
      },
    });
    if (!domain) return unavailable();
    if (path === "/") {
      const target = request.nextUrl.clone();
      target.pathname = `/domain/${domain.organizationId}`;
      return NextResponse.rewrite(target);
    }
    if (path.startsWith("/q/") || path.startsWith("/embed/")) {
      if (path.split("/")[2] !== domain.organization.slug) return unavailable();
    } else if (path.startsWith("/assets/")) {
      if (path.split("/")[2] !== domain.organizationId) return unavailable();
    } else if (path !== "/embed.js") return unavailable();
  }
  if (path.startsWith("/domain/")) return unavailable();
  if (path.startsWith("/embed/")) {
    const [, , slug, id] = path.split("/");
    const estimator = await db.estimator.findFirst({
      where: {
        id,
        organization: { slug },
        status: "published",
        deletedAt: null,
      },
      select: { organization: { select: { embedOrigins: true } } },
    });
    if (!estimator) return unavailable();
    const response = NextResponse.next();
    response.headers.set(
      "Content-Security-Policy",
      `frame-ancestors 'self' ${estimator.organization.embedOrigins.join(" ")}`,
    );
    return response;
  }
  return NextResponse.next();
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
