import { randomUUID } from "node:crypto";
import { getDatabase } from "@openquotestack/database";
import { getAssetStorage } from "@openquotestack/database/storage";
export async function systemStatus(organizationId: string) {
  const db = getDatabase();
  let database = false,
    storage = false;
  try {
    await db.$queryRaw`SELECT 1`;
    database = true;
  } catch {
    database = false;
  }
  const key = `${organizationId}/${randomUUID()}.webp`;
  let store: ReturnType<typeof getAssetStorage> | undefined;
  try {
    store = getAssetStorage();
    await store.put(key, new Uint8Array([79, 81, 83]));
    storage = (await store.get(key))?.length === 3;
  } catch {
    storage = false;
  } finally {
    await store?.remove(key).catch(() => {});
  }
  const [heartbeat, pending, failed] = await Promise.allSettled([
    db.workerHeartbeat.findFirst({ orderBy: { updatedAt: "desc" } }),
    db.backgroundJob.count({
      where: { organizationId, status: { in: ["pending", "running"] } },
    }),
    db.backgroundJob.count({ where: { organizationId, status: "failed" } }),
  ]);
  return {
    version: process.env.OQS_VERSION ?? "0.2.0-alpha.1",
    build: process.env.OQS_BUILD_ID ?? "local",
    database,
    storage,
    storageDriver: process.env.OQS_STORAGE_DRIVER ?? "local",
    smtp: !!(process.env.SMTP_HOST && process.env.SMTP_FROM),
    worker:
      heartbeat.status === "fulfilled" &&
      !!heartbeat.value &&
      heartbeat.value.updatedAt.getTime() > Date.now() - 120000,
    pending: pending.status === "fulfilled" ? pending.value : null,
    failed: failed.status === "fulfilled" ? failed.value : null,
  };
}
