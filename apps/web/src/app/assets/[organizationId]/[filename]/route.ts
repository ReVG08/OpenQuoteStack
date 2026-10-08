import { assetKey, getAssetStorage } from "@/lib/assets";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ organizationId: string; filename: string }> },
) {
  try {
    const { organizationId, filename } = await params,
      image = await getAssetStorage().get(assetKey(organizationId, filename));
    return new Response(Uint8Array.from(image), {
      headers: {
        "Content-Type": filename.endsWith(".png")
          ? "image/png"
          : filename.endsWith(".jpg")
            ? "image/jpeg"
            : "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
