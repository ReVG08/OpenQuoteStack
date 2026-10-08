import { beforeEach, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
const db = vi.hoisted(() => ({
  customDomain: { findFirst: vi.fn() },
  estimator: { findFirst: vi.fn() },
}));
vi.mock("@openquotestack/database", () => ({ getDatabase: () => db }));
import { proxy } from "./proxy";
beforeEach(() => {
  process.env.BETTER_AUTH_URL = "https://quotes.example.com";
  db.customDomain.findFirst.mockReset().mockResolvedValue(null);
  db.estimator.findFirst.mockReset().mockResolvedValue(null);
});
const request = (path: string, host = "quotes.example.com") =>
  new NextRequest(`https://${host}${path}`, { headers: { host } });
it("denies unknown hosts and direct internal organization routes", async () => {
  expect((await proxy(request("/", "unknown.example.com"))).status).toBe(404);
  expect((await proxy(request("/domain/other"))).status).toBe(404);
  expect((await proxy(request("/health", "unknown.example.com"))).status).toBe(
    200,
  );
});
it("routes a verified domain only to its organization and denies administrative routes", async () => {
  db.customDomain.findFirst.mockResolvedValue({
    organizationId: "own",
    organization: { slug: "acme" },
  });
  expect(
    (await proxy(request("/", "acme.example.com"))).headers.get(
      "x-middleware-rewrite",
    ),
  ).toBe("https://acme.example.com/domain/own");
  expect(
    (await proxy(request("/q/acme/calc", "acme.example.com"))).status,
  ).toBe(200);
  for (const path of [
    "/login",
    "/app/own",
    "/api/v1/estimates",
    "/q/other/calc",
    "/assets/other/logo.webp",
  ])
    expect((await proxy(request(path, "acme.example.com"))).status).toBe(404);
  expect(db.customDomain.findFirst.mock.calls[0]![0].where).toMatchObject({
    hostname: "acme.example.com",
    status: "active",
    checkedAt: { gte: expect.any(Date) },
  });
});
it("sets an estimator-specific frame allowlist and rejects absent publications", async () => {
  expect((await proxy(request("/embed/acme/absent"))).status).toBe(404);
  db.estimator.findFirst.mockResolvedValue({
    organization: { embedOrigins: ["https://www.acme.example.com"] },
  });
  const response = await proxy(request("/embed/acme/calc"));
  expect(response.headers.get("Content-Security-Policy")).toBe(
    "frame-ancestors 'self' https://www.acme.example.com",
  );
  expect(db.estimator.findFirst.mock.calls[1]![0].where).toMatchObject({
    id: "calc",
    organization: { slug: "acme" },
    status: "published",
    deletedAt: null,
  });
});
