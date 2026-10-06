import EmbeddedPostgres from "embedded-postgres";
import { randomUUID, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdir } from "node:fs/promises";
const server = createServer();
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw new Error("No local port");
const port = address.port;
await new Promise<void>((resolve) => server.close(() => resolve()));
await mkdir(".local", { recursive: true });
const password = randomBytes(24).toString("hex");
const pg = new EmbeddedPostgres({
  databaseDir: `.local/test-${randomUUID()}`,
  port,
  user: "oqs",
  password,
  persistent: false,
  authMethod: "scram-sha-256",
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: () => {},
});
const url = `postgresql://oqs:${password}@127.0.0.1:${port}/oqs_test`;
async function run(args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("pnpm", args, {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: url, DATABASE_TEST_URL: url },
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`Check exited with ${code}`)),
    );
  });
}
try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("oqs_test");
  await run(["db:migrate"]);
  await run(["test:integration"]);
} finally {
  await pg.stop();
}
