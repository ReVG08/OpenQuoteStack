import { contactSchema } from "@openquotestack/core";
import { answerSchema } from "@openquotestack/schema";
import { z } from "zod";
import { authorize, serializable } from "./access";
import { type Prisma, type PrismaClient } from "./index";
import { type ApiScope } from "./platform-validation";
import { type Actor } from "./services";
export class PlatformError extends Error {
  constructor(
    public code:
      | "unauthorized"
      | "forbidden"
      | "rate_limited"
      | "not_found"
      | "invalid_request"
      | "conflict",
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export type ApiPrincipal = {
  keyId: string;
  organizationId: string;
  scopes: string[];
};
export function requireScope(principal: ApiPrincipal, scope: ApiScope) {
  if (!principal.scopes.includes(scope))
    throw new PlatformError(
      "forbidden",
      403,
      "The API key does not grant this scope.",
    );
}
export const paginationInput = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{1,100}$/)
    .optional(),
});
export const json = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value));
export const createEstimateInput = z.strictObject({
  estimatorId: z.string().min(1).max(100),
  revisionId: z.string().max(100).optional(),
  answers: z.record(z.string().max(100), answerSchema),
  contact: contactSchema.optional(),
});

export const createAdmin =
  (db: PrismaClient) =>
  <T>(
    actor: Actor,
    org: string,
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ) =>
    serializable(db, async (tx) => {
      await authorize(tx, actor, org, "organization.manage");
      return operation(tx);
    });
export async function consumeRate(
  db: PrismaClient,
  key: string,
  limit: number,
) {
  const expiresAt = new Date(Math.ceil((Date.now() + 1) / 60000) * 60000);
  const bucket = `${key}:${expiresAt.getTime()}`;
  const [row] = await db.$queryRaw<
    { count: number }[]
  >`INSERT INTO "RateBucket" ("key","count","expiresAt") VALUES (${bucket},1,${expiresAt}) ON CONFLICT ("key") DO UPDATE SET "count"="RateBucket"."count"+1 RETURNING "count"`;
  if (!row || row.count > limit)
    throw new PlatformError(
      "rate_limited",
      429,
      "Request limit exceeded. Retry in one minute.",
    );
}
