import EmbeddedPostgres from "embedded-postgres";
import { loadEnvFile } from "node:process";
import { existsSync } from "node:fs";
if (existsSync(".env")) loadEnvFile(".env");
const url = new URL(
  process.env.DATABASE_URL ?? "postgresql://oqs:oqs@localhost:5432/oqs",
);
if (!["localhost", "127.0.0.1"].includes(url.hostname))
  throw new Error("Local database requires a loopback DATABASE_URL");
const pg = new EmbeddedPostgres({
  databaseDir: ".local/postgres",
  port: Number(url.port || 5432),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  persistent: true,
  authMethod: "scram-sha-256",
  postgresFlags: ["-h", "127.0.0.1"],
});
if (!existsSync(".local/postgres/PG_VERSION")) await pg.initialise();
await pg.start();
const client = pg.getPgClient("postgres", "127.0.0.1");
await client.connect();
const name = url.pathname.slice(1);
if (!/^[a-z][a-z0-9_]*$/.test(name))
  throw new Error("Use a simple local database name");
const result = await client.query(
  "SELECT 1 FROM pg_database WHERE datname = $1",
  [name],
);
if (!result.rowCount) await client.query(`CREATE DATABASE "${name}"`);
await client.end();
console.log("Local PostgreSQL is ready. Keep this terminal running.");
process.once("SIGINT", async () => {
  await pg.stop();
  process.exit(0);
});
process.once("SIGTERM", async () => {
  await pg.stop();
  process.exit(0);
});
await new Promise(() => {});
