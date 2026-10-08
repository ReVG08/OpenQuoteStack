import { randomBytes } from "node:crypto";
import { audit } from "./access";
import { secretHash } from "./crypto";
import { type PrismaClient } from "./index";
import {
  consumeRate as consume,
  createAdmin,
  PlatformError,
  type ApiPrincipal,
} from "./platform-context";
import { keyInput } from "./platform-validation";
import { AccessDeniedError, ConflictError, type Actor } from "./services";
export function keysServices(db: PrismaClient) {
  const admin = createAdmin(db);
  const consumeRate = (key: string, limit: number) => consume(db, key, limit);
  return {
    async authenticate(secret: string): Promise<ApiPrincipal> {
      if (!/^oqs_[a-f0-9]{64}$/.test(secret))
        throw new PlatformError(
          "unauthorized",
          401,
          "A valid bearer API key is required.",
        );
      const key = await db.apiKey.findUnique({
        where: { secretHash: secretHash(secret) },
      });
      if (!key || key.revokedAt)
        throw new PlatformError(
          "unauthorized",
          401,
          "A valid bearer API key is required.",
        );
      await consumeRate(`api:${key.id}`, 120);
      if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > 60000)
        await db.apiKey.updateMany({
          where: { id: key.id, revokedAt: null },
          data: { lastUsedAt: new Date() },
        });
      return {
        keyId: key.id,
        organizationId: key.organizationId,
        scopes: key.scopes,
      };
    },
    async createKey(actor: Actor, org: string, input: unknown) {
      const data = keyInput.parse(input),
        secret = `oqs_${randomBytes(32).toString("hex")}`;
      const key = await admin(actor, org, async (tx) => {
        if (
          (await tx.apiKey.count({
            where: { organizationId: org, revokedAt: null },
          })) >= 50
        )
          throw new ConflictError("API key limit reached");
        const row = await tx.apiKey.create({
          data: {
            ...data,
            organizationId: org,
            prefix: secret.slice(0, 12),
            secretHash: secretHash(secret),
          },
        });
        await audit(tx, actor, org, "api_key.created", row.id, {
          scopes: data.scopes,
        });
        return {
          id: row.id,
          name: row.name,
          prefix: row.prefix,
          scopes: row.scopes,
          createdAt: row.createdAt.toISOString(),
        };
      });
      return { ...key, secret };
    },
    async listKeys(actor: Actor, org: string) {
      return admin(actor, org, (tx) =>
        tx.apiKey.findMany({
          where: { organizationId: org },
          orderBy: { createdAt: "desc" },
          take: 100,
          select: {
            id: true,
            name: true,
            description: true,
            prefix: true,
            scopes: true,
            createdAt: true,
            lastUsedAt: true,
            revokedAt: true,
          },
        }),
      );
    },
    async revokeKey(actor: Actor, org: string, id: string) {
      return admin(actor, org, async (tx) => {
        const changed = await tx.apiKey.updateMany({
          where: { id, organizationId: org, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        if (!changed.count) throw new AccessDeniedError();
        await audit(tx, actor, org, "api_key.revoked", id);
      });
    },
  };
}
