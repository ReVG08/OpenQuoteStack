import { describe, it, expect, vi } from "vitest";
import { OpenQuoteStack, OpenQuoteStackError } from "./client";
const secret = "oqs_test";
describe("API client", () => {
  it("uses bearer authentication and cursor pagination without credentials or redirects", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({ data: [], pagination: { nextCursor: null, limit: 2 } }),
    );
    const client = new OpenQuoteStack({
      baseUrl: "https://quotes.example.com/",
      apiKey: secret,
      fetch: fetcher,
    });
    await client.estimators.list({ limit: 2, cursor: "opaque-id" });
    expect(fetcher).toHaveBeenCalledWith(
      "https://quotes.example.com/api/v1/estimators?limit=2&cursor=opaque-id",
      expect.objectContaining({
        redirect: "error",
        credentials: "omit",
        headers: expect.objectContaining({ Authorization: `Bearer ${secret}` }),
      }),
    );
  });
  it("preserves an explicit idempotency key and unwraps resources", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({ data: { id: "estimate-one" } }),
    );
    const client = new OpenQuoteStack({
      baseUrl: "http://localhost:3000",
      apiKey: secret,
      fetch: fetcher,
    });
    expect(
      await client.estimates.create(
        { estimatorId: "calc", answers: {} },
        { idempotencyKey: "persistent-request-id" },
      ),
    ).toEqual({ id: "estimate-one" });
    expect(fetcher.mock.calls[0]![1]?.headers).toMatchObject({
      "Idempotency-Key": "persistent-request-id",
    });
    await expect(client.estimates.get("../../secret")).rejects.toThrow(
      TypeError,
    );
  });
  it("exposes stable errors and request IDs without leaking credentials", async () => {
    const client = new OpenQuoteStack({
      baseUrl: "https://quotes.example.com",
      apiKey: secret,
      fetch: async () =>
        Response.json(
          {
            error: {
              code: "rate_limited",
              message: "Retry later",
              requestId: "trace-id",
            },
          },
          { status: 429, headers: { "Retry-After": "60" } },
        ),
    });
    await expect(client.leads.list()).rejects.toMatchObject({
      status: 429,
      code: "rate_limited",
      requestId: "trace-id",
      retryAfter: 60,
    });
    const failed = new OpenQuoteStack({
      baseUrl: "https://quotes.example.com",
      apiKey: secret,
      fetch: async () => {
        throw new Error(secret);
      },
    });
    await expect(failed.estimators.list()).rejects.toThrow(OpenQuoteStackError);
    await expect(failed.estimators.list()).rejects.not.toThrow(secret);
  });
  it("rejects unsafe configuration and invalid responses", async () => {
    for (const baseUrl of [
      "http://quotes.example.com",
      "https://quotes.example.com/unsupported-path",
      "https://key:secret@quotes.example.com",
      "https://quotes.example.com?key=x",
    ])
      expect(() => new OpenQuoteStack({ baseUrl, apiKey: secret })).toThrow();
    const client = new OpenQuoteStack({
      baseUrl: "https://quotes.example.com",
      apiKey: secret,
      fetch: async () => new Response("not json"),
    });
    await expect(client.estimates.list()).rejects.toMatchObject({
      code: "invalid_response",
    });
  });
});
