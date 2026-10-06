import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { getDatabase, type PrismaClient } from "@openquotestack/database";
export function createAuth(
  database: PrismaClient,
  config: { secret: string; url: string },
) {
  const secure = new URL(config.url).protocol === "https:";
  return betterAuth({
    database: prismaAdapter(database, { provider: "postgresql" }),
    secret: config.secret,
    baseURL: config.url,
    trustedOrigins: [config.url],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    advanced: {
      disableCSRFCheck: false,
      disableOriginCheck: false,
      useSecureCookies: secure,
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", secure },
    },
    rateLimit: { enabled: true, window: 60, max: 60 },
    logger: { disabled: true },
  });
}
let auth: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  if (auth) return auth;
  const secret = process.env.BETTER_AUTH_SECRET,
    url = process.env.BETTER_AUTH_URL;
  if (!secret || secret.length < 32 || secret.includes("replace-with"))
    throw new Error(
      "BETTER_AUTH_SECRET must be a unique secret of at least 32 characters",
    );
  if (!url) throw new Error("BETTER_AUTH_URL is required");
  if (
    process.env.NODE_ENV === "production" &&
    new URL(url).protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(new URL(url).hostname)
  )
    throw new Error("Production authentication requires HTTPS");
  auth = createAuth(getDatabase(), { secret, url });
  return auth;
}
