import { createHash } from "node:crypto";
import { platform } from "./platform";
export async function publicAttempt(
  operation: string,
  key: string,
  limit: number,
) {
  await platform().consumeRate("public:all", 1200);
  await platform().consumeRate(
    `public:${operation}:${createHash("sha256").update(key).digest("hex")}`,
    limit,
  );
}
