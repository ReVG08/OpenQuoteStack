import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { getDatabase } from "../src/index.js";
import { createServices } from "../src/services.js";
config({ path: "../../.env", quiet: true });
const db = getDatabase();
try {
  const email = process.env.SEED_OWNER_EMAIL;
  if (!email)
    throw new Error("Set SEED_OWNER_EMAIL to an existing registered account");
  const user = await db.user.findUnique({ where: { email } });
  if (!user) throw new Error("Register the seed owner account before seeding");
  const svc = createServices(db),
    actor = { userId: user.id };
  let org = await db.organization.findUnique({
    where: { slug: "moving-demo" },
  });
  if (!org)
    org = await svc.createOrganization(actor, {
      name: "Moving Demo",
      slug: "moving-demo",
      locale: "en",
      timezone: "UTC",
      defaultCurrency: "USD",
    });
  await svc.getOrganization(actor, org.id);
  if ((await svc.listEstimators(actor, org.id)).length === 0) {
    const doc: unknown = JSON.parse(
      readFileSync(
        new URL("../../../templates/moving-company.oqs.json", import.meta.url),
        "utf8",
      ),
    );
    const { estimator, revision } = await svc.createEstimator(
      actor,
      org.id,
      doc,
    );
    await svc.publishRevision(actor, org.id, estimator.id, revision.id);
  }
  console.log("Moving demo is ready.");
} finally {
  await db.$disconnect();
}
