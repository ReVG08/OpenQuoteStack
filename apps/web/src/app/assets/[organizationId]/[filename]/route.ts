import { readFile } from "node:fs/promises";
import { assetFile } from "@/lib/assets";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ organizationId: string; filename: string }> },
) {
  try {
    const { organizationId, filename } = await params,
      image = await readFile(assetFile(organizationId, filename));
    return new Response(image, {
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
