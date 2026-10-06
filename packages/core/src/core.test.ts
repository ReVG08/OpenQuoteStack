import { it, expect } from "vitest";
import { hasPermission, EventBus, organizationInputSchema } from "./index.js";
it("uses explicit grants and fails closed for unknown roles", () => {
  expect(hasPermission("sales", "estimator.publish")).toBe(false);
  expect(hasPermission("viewer", "estimate.create")).toBe(false);
  expect(hasPermission("owner", "organization.manage")).toBe(true);
  expect(hasPermission("constructor", "estimator.read")).toBe(false);
});
it("isolates subscriber failures and supports unsubscribe", async () => {
  const bus = new EventBus();
  let calls = 0;
  const off = bus.subscribe("estimator.created", () => {
    calls++;
  });
  bus.subscribe("estimator.created", () => {
    throw new Error("subscriber failed");
  });
  const event = {
    id: "1",
    name: "estimator.created" as const,
    organizationId: "a",
    resourceId: "e",
    occurredAt: "2026-10-06T00:00:00Z",
    actorId: "u",
  };
  expect((await bus.publish(event)).map((x) => x.status)).toEqual([
    "fulfilled",
    "rejected",
  ]);
  off();
  await bus.publish(event);
  expect(calls).toBe(1);
});
it("validates tenant locale, branding and timezone", () => {
  expect(
    organizationInputSchema.safeParse({
      name: "Test",
      slug: "test",
      locale: "pt-BR",
      timezone: "America/Sao_Paulo",
      defaultCurrency: "BRL",
    }).success,
  ).toBe(true);
  expect(
    organizationInputSchema.safeParse({
      name: "Test",
      slug: "test",
      locale: "en",
      timezone: "invalid",
      defaultCurrency: "USD",
    }).success,
  ).toBe(false);
});
