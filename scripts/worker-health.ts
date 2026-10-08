import { getDatabase } from "@openquotestack/database";
const db = getDatabase();
try {
  const heartbeat = await db.workerHeartbeat.findFirst({
    where: { updatedAt: { gte: new Date(Date.now() - 120000) } },
  });
  if (!heartbeat) process.exitCode = 1;
} catch {
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
