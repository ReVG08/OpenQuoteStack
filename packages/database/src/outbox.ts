import { randomUUID } from "node:crypto";
import type { Prisma } from "./index";
import {
  estimatorResource,
  estimateResource,
  leadResource,
} from "./representations";
export async function enqueueEvent(
  tx: Prisma.TransactionClient,
  organizationId: string,
  name: string,
  resourceId: string,
) {
  let data: unknown;
  if (name === "estimator.published") {
    const revision = await tx.estimatorRevision.findFirstOrThrow({
      where: { id: resourceId, organizationId },
    });
    const e = await tx.estimator.findFirstOrThrow({
      where: { id: revision.estimatorId, organizationId },
      include: { publishedRevision: true },
    });
    data = estimatorResource(e);
  } else if (
    [
      "estimate.created",
      "estimate.completed",
      "estimate.status_changed",
    ].includes(name)
  ) {
    const e = await tx.estimate.findFirstOrThrow({
      where: { id: resourceId, organizationId },
      include: { revision: true, lead: true },
    });
    data = estimateResource(e);
  } else if (["lead.created", "lead.updated"].includes(name)) {
    data = leadResource(
      await tx.lead.findFirstOrThrow({
        where: { id: resourceId, organizationId },
      }),
    );
  } else return;
  const types =
    name === "estimate.completed"
      ? ["estimate.created", "estimate.completed"]
      : [name];
  for (const type of types) {
    const id = randomUUID(),
      createdAt = new Date();
    await tx.outboxEvent.create({
      data: {
        id,
        organizationId,
        name: type,
        resourceId,
        createdAt,
        payload: JSON.parse(
          JSON.stringify({
            id,
            type,
            createdAt: createdAt.toISOString(),
            organizationId,
            data,
          }),
        ),
      },
    });
  }
}
