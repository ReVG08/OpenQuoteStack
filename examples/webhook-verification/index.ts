import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { verifyWebhook } from "@openquotestack/sdk";
const secret = process.env.OPENQUOTESTACK_WEBHOOK_SECRET;
if (!secret) throw new Error("Set OPENQUOTESTACK_WEBHOOK_SECRET");
const directory = resolve(".local/webhook-events");
await mkdir(directory, { recursive: true, mode: 0o700 });
createServer(async (req, res) => {
  try {
    if (req.method !== "POST" || req.url !== "/webhook") {
      res.writeHead(404).end();
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 250000) {
        res.writeHead(413).end();
        return;
      }
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks),
      header = req.headers["oqs-signature"];
    if (
      typeof header !== "string" ||
      !(await verifyWebhook(secret, header, body))
    ) {
      res.writeHead(401).end();
      return;
    }
    const event = JSON.parse(body.toString("utf8")) as { id?: string };
    if (
      !event.id ||
      !/^[a-f0-9-]{36}$/.test(event.id) ||
      req.headers["oqs-event-id"] !== event.id
    ) {
      res.writeHead(400).end();
      return;
    }
    try {
      await writeFile(resolve(directory, `${event.id}.json`), body, {
        flag: "wx",
        mode: 0o600,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    res.writeHead(204).end();
  } catch {
    res.writeHead(500).end();
  }
}).listen(4000, "127.0.0.1", () =>
  console.log("Webhook receiver listening on loopback port 4000"),
);
