import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { requireActor } from "@/lib/session";
import { services } from "@/lib/services";
import { hasPermission } from "@openquotestack/core";
import { assetFile } from "@/lib/assets";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  try {
    if (
      request.headers.get("origin") !==
      new URL(process.env.BETTER_AUTH_URL!).origin
    )
      return Response.json({ error: "Access denied" }, { status: 403 });
    if (Number(request.headers.get("content-length") ?? 0) > 2200000)
      return Response.json({ error: "Image too large" }, { status: 413 });
    const actor = await requireActor(),
      { organizationId } = await params,
      role = await services().getRole(actor, organizationId);
    if (!hasPermission(role, "organization.manage"))
      return Response.json({ error: "Access denied" }, { status: 403 });
    const data = await request.formData(),
      file = data.get("file");
    if (!(file instanceof File) || file.size > 2000000)
      return Response.json({ error: "Invalid image" }, { status: 400 });
    const input = Buffer.from(await file.arrayBuffer()),
      meta = await sharp(input, { limitInputPixels: 20000000 }).metadata();
    if (
      !["png", "jpeg", "webp"].includes(meta.format ?? "") ||
      (meta.pages && meta.pages > 1)
    )
      return Response.json({ error: "Invalid image" }, { status: 400 });
    const image = await sharp(input, { limitInputPixels: 20000000 })
      .rotate()
      .resize({
        width: 1024,
        height: 1024,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();
    const filename = `${randomUUID()}.webp`,
      path = assetFile(organizationId, filename);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, image, { flag: "wx", mode: 0o640 });
    return Response.json({ url: `/assets/${organizationId}/${filename}` });
  } catch {
    return Response.json({ error: "Upload failed" }, { status: 400 });
  }
}
