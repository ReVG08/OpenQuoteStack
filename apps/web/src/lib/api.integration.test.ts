import { beforeAll, afterAll, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { getDatabase } from "@openquotestack/database";
import { createPlatform } from "@openquotestack/database/platform";
import { createServices } from "@openquotestack/database/services";
import { OpenQuoteStack } from "@openquotestack/sdk";
import { apiRequest } from "./api";
const url = process.env.DATABASE_TEST_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Disposable test database required");
const db = getDatabase(),
  platform = createPlatform(db),
  svc = createServices(db),
  actor = { userId: randomUUID() };
let secret: string, id: string;
const fetcher: typeof fetch = async (input, init) => {
  const request = new Request(input, init),
    path = new URL(request.url).pathname.slice("/api/v1/".length).split("/");
  return apiRequest(request, path);
};
beforeAll(async () => {
  await db.user.create({
    data: {
      id: actor.userId,
      name: "API test",
      email: `${actor.userId}@example.test`,
    },
  });
  const org = await svc.createOrganization(actor, {
    name: "HTTP API tests",
    slug: `api-${randomUUID()}`,
    locale: "en",
    timezone: "UTC",
    defaultCurrency: "USD",
  });
  const e = await svc.createEstimator(
    actor,
    org.id,
    JSON.parse(
      readFileSync(
        new URL(
          "../../../../templates/moving-company.oqs.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ),
  );
  id = e.estimator.id;
  await svc.publishRevision(actor, org.id, id, e.revision.id);
  secret = (
    await platform.createKey(actor, org.id, {
      name: "HTTP client",
      scopes: ["estimators:read", "estimates:write", "estimates:read"],
    })
  ).secret;
});
afterAll(() => db.$disconnect());
it("runs the published estimate journey through the SDK and HTTP contract", async () => {
  const sdk = new OpenQuoteStack({
    baseUrl: "http://localhost:3000",
    apiKey: secret,
    fetch: fetcher,
  });
  const page = await sdk.estimators.list({ limit: 1 });
  expect(page.data[0]!.id).toBe(id);
  expect(page.pagination.limit).toBe(1);
  const input = {
    estimatorId: id,
    answers: {
      origin: "Boston",
      destination: "Cambridge",
      bedrooms: 3,
      distance: 22,
      elevator: true,
      boxes: 0,
      piano: true,
      packing: false,
      moving_date: "2026-10-10",
    },
  };
  const quote = await sdk.estimates.create(input, {
    idempotencyKey: "http-api-request-one",
  });
  expect(quote.result.totalMinor).toBe(70863);
  expect((await sdk.estimates.get(quote.id)).revision.id).toBe(
    quote.revision.id,
  );
  expect(
    (
      await sdk.estimates.create(input, {
        idempotencyKey: "http-api-request-one",
      })
    ).id,
  ).toBe(quote.id);
  await expect(sdk.leads.list()).rejects.toMatchObject({
    status: 403,
    code: "forbidden",
  });
});
it("returns bounded consistent errors and request IDs", async () => {
  const send = (path: string, init: RequestInit = {}) =>
    fetcher(`http://localhost:3000/api/v1/${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${secret}`, ...init.headers },
    });
  const unauth = await fetcher("http://localhost:3000/api/v1/estimates");
  expect(unauth.status).toBe(401);
  expect(unauth.headers.get("WWW-Authenticate")).toContain("Bearer");
  const invalid = await send("estimators?limit=101");
  expect(invalid.status).toBe(422);
  expect((await invalid.json()).error.requestId).toBe(
    invalid.headers.get("X-Request-Id"),
  );
  expect((await send("estimators?unknown=true")).status).toBe(400);
  expect(
    (
      await send("estimates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "x".repeat(250001),
      })
    ).status,
  ).toBe(400);
  expect((await send("estimators", { method: "DELETE" })).status).toBe(405);
  expect((await send("webhooks")).status).toBe(403);
});
