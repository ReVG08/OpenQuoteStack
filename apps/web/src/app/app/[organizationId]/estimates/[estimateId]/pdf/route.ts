import { workspace } from "@/lib/workspace";
import { services } from "@/lib/services";
import { brandingOf } from "@/lib/branding";
import { estimatePdf } from "@/lib/estimate-pdf";
import { reference } from "@/lib/product-i18n";
import { parseDocument } from "@openquotestack/schema";
import type { EstimateResult } from "@openquotestack/engine";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  {
    params,
  }: { params: Promise<{ organizationId: string; estimateId: string }> },
) {
  const { organizationId, estimateId } = await params,
    { actor, organization, locale } = await workspace(organizationId);
  try {
    const q = await services().getEstimate(actor, organizationId, estimateId);
    const buffer = await estimatePdf({
      id: q.id,
      revisionNumber: q.revision.number,
      organizationId,
      businessName: organization.name,
      branding: brandingOf(organization.branding),
      createdAt: q.createdAt,
      timezone: organization.timezone,
      locale,
      estimator: parseDocument(q.revision.definition).estimator,
      result: q.result as unknown as EstimateResult,
      customer: q.lead,
    });
    return new Response(Uint8Array.from(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${reference(q.id)}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
