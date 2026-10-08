import { hasPermission, type Permission } from "@openquotestack/core";
import { Prisma, type PrismaClient } from "./index";
import { AccessDeniedError, type Actor } from "./errors";
export async function authorize(
  tx: Prisma.TransactionClient,
  actor: Actor,
  organizationId: string,
  permission: Permission,
) {
  const membership = await tx.membership.findUnique({
    where: { organizationId_userId: { organizationId, userId: actor.userId } },
  });
  if (!membership || !hasPermission(membership.role, permission))
    throw new AccessDeniedError();
  return membership;
}
export async function serializable<T>(
  db: PrismaClient,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034" &&
        attempt < 3
      )
        continue;
      throw error;
    }
  }
}
export async function audit(
  tx: Prisma.TransactionClient,
  actor: Actor,
  organizationId: string,
  action: string,
  resourceId: string,
  metadata: Prisma.InputJsonValue = {},
) {
  await tx.auditEntry.create({
    data: {
      organizationId,
      actorId: actor.userId,
      action,
      resourceId,
      metadata,
    },
  });
}
