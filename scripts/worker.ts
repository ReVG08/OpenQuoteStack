import { loadEnvFile } from "node:process";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { getDatabase } from "@openquotestack/database";
import {
  dispatchOutbox,
  runJob,
  maintainWorker,
} from "@openquotestack/database/worker";
if (existsSync(".env")) loadEnvFile(".env");
const db = getDatabase(),
  id = randomUUID();
let stopping = false,
  lastMaintenance = 0;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
console.log(JSON.stringify({ level: "info", operation: "worker.started" }));
try {
  while (!stopping) {
    try {
      if (Date.now() - lastMaintenance > 30000) {
        await maintainWorker(db, id);
        lastMaintenance = Date.now();
      }
      await dispatchOutbox(db);
      if (!(await runJob(db)))
        await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch {
      console.error(
        JSON.stringify({
          level: "error",
          operation: "worker.iteration",
          errorCategory: "processing_failed",
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
} finally {
  await db.$disconnect();
}
