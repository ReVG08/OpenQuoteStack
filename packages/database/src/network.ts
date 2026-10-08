import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request } from "node:https";
import ipaddr from "ipaddr.js";
export function isPublicAddress(address: string): boolean {
  try {
    return ipaddr.process(address).range() === "unicast";
  } catch {
    return false;
  }
}
export function publicHostname(value: string): string {
  const host = value.toLowerCase();
  if (
    host.length > 253 ||
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host) ||
    /\.(local|internal|localhost|test|invalid|example)$/.test(host) ||
    isIP(host)
  )
    throw new Error("Public DNS hostname required");
  return host;
}
export function webhookUrl(value: string): URL {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    (url.port && url.port !== "443") ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new Error(
      "Webhook requires HTTPS on port 443 without credentials or fragments",
    );
  publicHostname(url.hostname);
  return url;
}
export async function publicAddresses(host: string, resolver = lookup) {
  const addresses = await boundedDns(
    resolver(host, { all: true, verbatim: true }),
  );
  if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address)))
    throw new Error("Destination must resolve exclusively to public addresses");
  return addresses;
}
/** DNS is checked per attempt, then pinned to the connection; redirects are never followed. */
export async function postWebhook(
  urlText: string,
  body: string,
  headers: Record<string, string>,
) {
  const url = webhookUrl(urlText);
  const addresses = await publicAddresses(url.hostname);
  const address = addresses[0]!;
  return new Promise<{ status: number; durationMs: number }>(
    (resolve, reject) => {
      const start = performance.now();
      const req = request(
        url,
        {
          method: "POST",
          agent: false,
          family: address.family,
          lookup: (_host, _options, cb) =>
            cb(null, address.address, address.family),
          headers: {
            ...headers,
            "Content-Type": "application/json",
            "Content-Length": String(Buffer.byteLength(body)),
            "User-Agent": "OpenQuoteStack/0.1",
          },
        },
        (res) => {
          const status = res.statusCode ?? 0;
          // Consumer responses are discarded, never persisted or logged.
          res.destroy();
          resolve({
            status,
            durationMs: Math.round(performance.now() - start),
          });
        },
      );
      const timer = setTimeout(
        () => req.destroy(new Error("Delivery timeout")),
        10000,
      );
      req.once("close", () => clearTimeout(timer));
      req.once("error", reject);
      req.end(body);
    },
  );
}

export async function boundedDns<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("dns_timeout")), 5000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
