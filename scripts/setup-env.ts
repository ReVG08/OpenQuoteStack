import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--url"))
  throw new Error("Usage: pnpm setup:env [--url https://quotes.example.com]");
const url = new URL(args[1] ?? "http://localhost:3000");
if (
  url.origin !== url.href.replace(/\/$/, "") ||
  url.username ||
  url.password ||
  !(
    ["https:"].includes(url.protocol) ||
    (url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname))
  )
)
  throw new Error("Use an HTTPS origin or loopback HTTP");
const password = randomBytes(32).toString("hex");
const template = (await readFile(".env.example", "utf8"))
  .replaceAll("replace-with-a-random-hex-password", password)
  .replace(
    "replace-with-a-random-secret-of-at-least-32-characters",
    randomBytes(32).toString("hex"),
  )
  .replace(
    "replace-with-64-random-hex-characters",
    randomBytes(32).toString("hex"),
  )
  .replace(
    "BETTER_AUTH_URL=http://localhost:3000",
    `BETTER_AUTH_URL=${url.origin}`,
  );
await writeFile(".env", template, { flag: "wx", mode: 0o600 });
console.log(
  "Created .env with unique local credentials. Existing files are never overwritten.",
);
