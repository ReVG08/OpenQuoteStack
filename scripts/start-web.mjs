import { cpSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { spawn } from "node:child_process";

const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--port"))
  throw new Error(
    "Usage: pnpm --filter @openquotestack/web start [--port 3000]",
  );
const port = Number(args[1] ?? process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("Invalid web port");
const web = resolve(import.meta.dirname, "../apps/web"),
  standalone = resolve(web, ".next/standalone/apps/web"),
  server = resolve(standalone, "server.js"),
  env = resolve(import.meta.dirname, "../.env");
if (!existsSync(server))
  throw new Error("Build the application with pnpm build first");
if (existsSync(env)) loadEnvFile(env);
cpSync(resolve(web, ".next/static"), resolve(standalone, ".next/static"), {
  recursive: true,
});
cpSync(resolve(web, "public"), resolve(standalone, "public"), {
  recursive: true,
});
const child = spawn(process.execPath, [server], {
  cwd: web,
  stdio: "inherit",
  env: {
    ...process.env,
    PORT: String(port),
    NEXT_TELEMETRY_DISABLED: "1",
    HOSTNAME: process.env.HOSTNAME ?? "0.0.0.0",
  },
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", () => {
  process.stderr.write("The application process could not start.\n");
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 0;
});
