import { getDatabase } from "@openquotestack/database";
export async function GET() {
  try {
    await getDatabase().$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
