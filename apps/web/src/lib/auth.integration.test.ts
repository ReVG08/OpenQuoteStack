import { it, expect, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { createDatabase } from "@openquotestack/database";
import { createAuth } from "./auth";
const url = process.env.DATABASE_TEST_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("DATABASE_TEST_URL must use a disposable *_test database");
const db = createDatabase(url),
  auth = createAuth(db, {
    secret: "integration-test-secret-at-least-32-characters",
    url: "http://localhost:3000",
  });
const request = (
  path: string,
  body: unknown,
  cookie?: string,
  origin = "http://localhost:3000",
) =>
  auth.handler(
    new Request(`http://localhost:3000/api/auth/${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin,
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
afterAll(async () => {
  await db.$disconnect();
});
it("registers, logs in, resolves and revokes a database session", async () => {
  const email = `auth-${randomUUID()}@example.test`,
    password = "A-valid-test-password-123";
  const registered = await request("sign-up/email", {
    name: "Test account",
    email,
    password,
  });
  expect(registered.status).toBe(200);
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  const account = await db.account.findFirstOrThrow({
    where: { userId: user.id },
  });
  expect(account.password).not.toBe(password);
  expect(account.password).toBeTruthy();
  expect(
    (await request("sign-in/email", { email, password: "wrong-password" }))
      .status,
  ).toBe(401);
  const login = await request("sign-in/email", { email, password });
  expect(login.status).toBe(200);
  const setCookie = login.headers.get("set-cookie");
  expect(setCookie).toContain("HttpOnly");
  expect(setCookie).toContain("SameSite=Lax");
  const cookie = setCookie!.split(";")[0]!;
  expect(
    (await auth.api.getSession({ headers: new Headers({ cookie }) }))?.user.id,
  ).toBe(user.id);
  expect((await request("sign-out", {}, cookie)).status).toBe(200);
  expect(
    await auth.api.getSession({ headers: new Headers({ cookie }) }),
  ).toBeNull();
});
it("rejects cross-origin authentication requests and short passwords", async () => {
  expect(
    (
      await request("sign-up/email", {
        name: "X",
        email: "short@example.test",
        password: "short",
      })
    ).status,
  ).toBeGreaterThanOrEqual(400);
  expect(
    (
      await request(
        "sign-in/email",
        { email: "x@example.test", password: "irrelevant-password" },
        undefined,
        "https://evil.example",
      )
    ).status,
  ).toBe(403);
});
it("sets secure cookies when configured for HTTPS", async () => {
  const secureAuth = createAuth(db, {
    secret: "integration-test-secret-at-least-32-characters",
    url: "https://quotes.example.test",
  });
  const response = await secureAuth.handler(
    new Request("https://quotes.example.test/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://quotes.example.test",
      },
      body: JSON.stringify({
        name: "Secure",
        email: `secure-${randomUUID()}@example.test`,
        password: "Secure-test-password-123",
      }),
    }),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("set-cookie")).toContain("Secure");
});
