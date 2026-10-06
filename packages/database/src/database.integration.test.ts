import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createDatabase } from "./index.js";
import { createServices, AccessDeniedError } from "./services.js";
import { calculateEstimate } from "@openquotestack/engine";
import { parseEstimator, type Answers } from "@openquotestack/schema";
import { EventBus } from "@openquotestack/core";
const url = process.env.DATABASE_TEST_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error(
    "DATABASE_TEST_URL must point to a disposable *_test database",
  );
const db = createDatabase(url),
  events = new EventBus(),
  svc = createServices(db, events);
const sample = () =>
  JSON.parse(
    readFileSync(
      new URL("../../../templates/moving-company.oqs.json", import.meta.url),
      "utf8",
    ),
  );
const alice = { userId: "alice" },
  bob = { userId: "bob" },
  viewer = { userId: "viewer" };
const answers: Answers = {
  origin: "Boston",
  destination: "Cambridge",
  bedrooms: 3,
  distance: 22,
  elevator: true,
  boxes: 0,
  piano: true,
  packing: false,
  moving_date: "2026-10-10",
};
let orgA: string,
  orgB: string,
  estimatorA: string,
  estimatorB: string,
  revisionA: string,
  revisionB: string,
  estimateB: string;
beforeAll(async () => {
  await db.$executeRawUnsafe('TRUNCATE TABLE "Organization", "User" CASCADE');
  for (const actor of [alice, bob, viewer])
    await db.user.create({
      data: {
        id: actor.userId,
        name: actor.userId,
        email: `${actor.userId}@example.test`,
      },
    });
  orgA = (
    await svc.createOrganization(alice, {
      name: "Tenant A",
      slug: "tenant-a",
      locale: "en",
      timezone: "UTC",
      defaultCurrency: "USD",
    })
  ).id;
  orgB = (
    await svc.createOrganization(bob, {
      name: "Tenant B",
      slug: "tenant-b",
      locale: "pt-BR",
      timezone: "America/Sao_Paulo",
      defaultCurrency: "BRL",
    })
  ).id;
  await db.membership.create({
    data: { organizationId: orgA, userId: viewer.userId, role: "viewer" },
  });
  const a = await svc.createEstimator(alice, orgA, sample()),
    b = await svc.createEstimator(bob, orgB, sample());
  estimatorA = a.estimator.id;
  revisionA = a.revision.id;
  estimatorB = b.estimator.id;
  revisionB = b.revision.id;
  await svc.publishRevision(alice, orgA, estimatorA, revisionA);
  await svc.publishRevision(bob, orgB, estimatorB, revisionB);
  estimateB = (await svc.createEstimate(bob, orgB, estimatorB, answers)).id;
});
afterAll(async () => {
  await db.$disconnect();
});
describe("tenant isolation", () => {
  it("scopes organization and estimator lists to verified membership", async () => {
    expect((await svc.listOrganizations(alice)).map((o) => o.id)).toEqual([
      orgA,
    ]);
    await expect(svc.listEstimators(alice, orgB)).rejects.toBeInstanceOf(
      AccessDeniedError,
    );
    await expect(svc.getOrganization(alice, orgB)).rejects.toBeInstanceOf(
      AccessDeniedError,
    );
  });
  it("rejects manipulated tenant and resource identifiers on reads", async () => {
    await expect(
      svc.getEstimator(alice, orgB, estimatorB),
    ).rejects.toBeInstanceOf(AccessDeniedError);
    await expect(
      svc.getEstimator(alice, orgA, estimatorB),
    ).rejects.toBeInstanceOf(AccessDeniedError);
    await expect(
      svc.getEstimate(alice, orgB, estimateB),
    ).rejects.toBeInstanceOf(AccessDeniedError);
    await expect(
      svc.getEstimate(alice, orgA, estimateB),
    ).rejects.toBeInstanceOf(AccessDeniedError);
  });
  it("rejects cross-tenant mutations for both owned and foreign tenant arguments", async () => {
    for (const org of [orgA, orgB]) {
      await expect(
        svc.createRevision(alice, org, estimatorB, sample()),
      ).rejects.toBeInstanceOf(AccessDeniedError);
      await expect(
        svc.publishRevision(alice, org, estimatorB, revisionB),
      ).rejects.toBeInstanceOf(AccessDeniedError);
      await expect(
        svc.archiveEstimator(alice, org, estimatorB),
      ).rejects.toBeInstanceOf(AccessDeniedError);
      await expect(
        svc.createEstimate(alice, org, estimatorB, answers),
      ).rejects.toBeInstanceOf(AccessDeniedError);
    }
    await expect(
      svc.createEstimator(alice, orgB, sample()),
    ).rejects.toBeInstanceOf(AccessDeniedError);
    await expect(
      svc.publishRevision(alice, orgA, estimatorA, revisionB),
    ).rejects.toBeInstanceOf(AccessDeniedError);
  });
  it("fails closed for nonmembers and viewers on mutations", async () => {
    await expect(
      svc.createEstimator({ userId: "missing" }, orgA, sample()),
    ).rejects.toBeInstanceOf(AccessDeniedError);
    await expect(
      svc.createRevision(viewer, orgA, estimatorA, sample()),
    ).rejects.toBeInstanceOf(AccessDeniedError);
    await expect(
      svc.publishRevision(viewer, orgA, estimatorA, revisionA),
    ).rejects.toBeInstanceOf(AccessDeniedError);
    await expect(
      svc.createEstimate(viewer, orgA, estimatorA, answers),
    ).rejects.toBeInstanceOf(AccessDeniedError);
    expect((await svc.getEstimator(viewer, orgA, estimatorA)).id).toBe(
      estimatorA,
    );
  });
  it("enforces tenant links in PostgreSQL as well as services", async () => {
    await expect(
      db.estimator.update({
        where: { id: estimatorA },
        data: { publishedRevisionId: revisionB },
      }),
    ).rejects.toThrow();
    await expect(
      db.estimate.create({
        data: {
          organizationId: orgA,
          estimatorId: estimatorA,
          revisionId: revisionB,
          answers: {},
          result: {},
          engineVersion: "0.1.0",
        },
      }),
    ).rejects.toThrow();
  });
});
it("assigns distinct sequential revisions under concurrent writes", async () => {
  const created = await svc.createEstimator(alice, orgA, sample());
  const revisions = await Promise.all([
    svc.createRevision(alice, orgA, created.estimator.id, sample()),
    svc.createRevision(alice, orgA, created.estimator.id, sample()),
  ]);
  expect(revisions.map((r) => r.number).sort()).toEqual([2, 3]);
});
describe("revision lifecycle", () => {
  it("preserves prior estimates after pricing changes and supports rollback", async () => {
    const first = await svc.createEstimate(alice, orgA, estimatorA, answers),
      changed = sample();
    changed.estimator.rules[2].rateMinor = 240;
    const revision = await svc.createRevision(alice, orgA, estimatorA, changed);
    expect(revision.number).toBe(2);
    await svc.publishRevision(alice, orgA, estimatorA, revision.id);
    const second = await svc.createEstimate(alice, orgA, estimatorA, answers);
    const retained = await svc.getEstimate(alice, orgA, first.id);
    expect(retained.result).toEqual(first.result);
    expect(retained.revisionId).toBe(revisionA);
    expect(second.result).not.toEqual(first.result);
    expect(
      calculateEstimate(
        parseEstimator(retained.revision.definition),
        retained.answers as Answers,
      ),
    ).toEqual(first.result);
    await svc.publishRevision(alice, orgA, estimatorA, revisionA);
    expect(
      (await svc.createEstimate(alice, orgA, estimatorA, answers)).result,
    ).toEqual(first.result);
  });
  it("makes revision and estimate snapshots immutable in the database", async () => {
    await expect(
      db.estimatorRevision.update({
        where: { id: revisionA },
        data: { definition: {} },
      }),
    ).rejects.toThrow();
    await expect(
      db.estimatorRevision.delete({ where: { id: revisionA } }),
    ).rejects.toThrow();
    const e = await svc.createEstimate(alice, orgA, estimatorA, answers);
    await expect(
      db.estimate.update({ where: { id: e.id }, data: { answers: {} } }),
    ).rejects.toThrow();
    expect(
      (
        await db.estimate.update({
          where: { id: e.id },
          data: { status: "accepted" },
        })
      ).status,
    ).toBe("accepted");
  });
  it("emits events after commits, retaining audit entries despite subscriber errors", async () => {
    let observed = false;
    const off = events.subscribe(
      "estimator.revision_created",
      async (event) => {
        observed = !!(await db.estimatorRevision.findUnique({
          where: { id: event.resourceId },
        }));
        throw new Error("Subscriber failure");
      },
    );
    const revision = await svc.createRevision(
      alice,
      orgA,
      estimatorA,
      sample(),
    );
    off();
    expect(observed).toBe(true);
    expect(
      await db.auditEntry.count({ where: { resourceId: revision.id } }),
    ).toBe(1);
  });
  it("archives estimators without discarding historical estimates", async () => {
    const e = await svc.createEstimate(alice, orgA, estimatorA, answers);
    await svc.archiveEstimator(alice, orgA, estimatorA);
    await expect(
      svc.createEstimate(alice, orgA, estimatorA, answers),
    ).rejects.toThrow("active published");
    await expect(
      svc.createRevision(alice, orgA, estimatorA, sample()),
    ).rejects.toThrow("Archived");
    expect((await svc.getEstimate(alice, orgA, e.id)).id).toBe(e.id);
    await svc.publishRevision(alice, orgA, estimatorA, revisionA);
  });
});
