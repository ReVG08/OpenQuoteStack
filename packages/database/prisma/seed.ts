import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getDatabase } from "../src/index.js";
import { createServices } from "../src/services.js";
import { parseDocument, type Answers } from "@openquotestack/schema";
config({ path: "../../.env", quiet: true });
if (process.env.SEED_DEMO !== "1")
  throw new Error(
    "Set SEED_DEMO=1 to explicitly install fictional development data",
  );
const db = getDatabase();
try {
  const email = process.env.SEED_OWNER_EMAIL;
  if (!email)
    throw new Error("Set SEED_OWNER_EMAIL to an existing registered account");
  const user = await db.user.findUnique({ where: { email } });
  if (!user) throw new Error("Register the seed owner before seeding");
  const svc = createServices(db),
    actor = { userId: user.id };
  let org = await db.organization.findUnique({
    where: { slug: "acme-moving-demo" },
  });
  if (!org)
    org = await svc.createOrganization(actor, {
      name: "Acme Moving",
      slug: "acme-moving-demo",
      locale: "en",
      timezone: "America/New_York",
      defaultCurrency: "USD",
      branding: {
        displayName: "Acme Moving",
        primaryColor: "#176653",
        businessAddress: "120 Example Street, Boston, MA",
        email: "hello@acme.example.test",
        phone: "+1 (555) 010-0200",
      },
    });
  await svc.getOrganization(actor, org.id);
  const existing = await svc.listEstimators(actor, org.id);
  if (existing.length) {
    console.log(
      "Acme Moving demo already exists; retained data was preserved.",
    );
  } else {
    const names = [
      "moving-company",
      "residential-cleaning",
      "web-design-agency",
    ];
    const inputs: Answers[] = [
      {
        origin: "120 Example Street, Boston",
        destination: "48 Sample Avenue, Cambridge",
        bedrooms: 3,
        distance: 22,
        elevator: true,
        boxes: 12,
        piano: true,
        packing: false,
        moving_date: "2026-10-10",
      },
      {
        bedrooms: 3,
        bathrooms: 2,
        area: 1600,
        frequency: "weekly",
        deep: true,
        oven: false,
        windows: true,
      },
      {
        package: "growth",
        pages: 6,
        commerce: false,
        booking: true,
        copy: true,
        rush: false,
      },
    ];
    const contacts = [
      {
        name: "Taylor Example",
        email: "taylor@example.test",
        phone: "+1 (555) 010-0410",
      },
      {
        name: "Jordan Sample",
        email: "jordan@example.test",
        phone: "+1 (555) 010-0411",
      },
      {
        name: "Casey Demo",
        email: "casey@example.test",
        company: "Example Studio",
      },
    ];
    for (const [index, name] of names.entries()) {
      const doc = parseDocument(
          JSON.parse(
            readFileSync(
              process.env.OQS_TEMPLATE_DIR
                ? resolve(process.env.OQS_TEMPLATE_DIR, `${name}.oqs.json`)
                : new URL(
                    `../../../templates/${name}.oqs.json`,
                    import.meta.url,
                  ),
              "utf8",
            ),
          ),
        ),
        { estimator } = await svc.createEstimator(actor, org.id, doc),
        revision = await svc.publishDraft(actor, org.id, estimator.id, 0);
      for (let i = 0; i < 8; i++) {
        const session = await svc.beginPublicSession(
          org.slug,
          estimator.id,
          revision.id,
        );
        if (i === 0) continue;
        await svc.progressPublicSession(session.id, 0);
        if (i === 1) continue;
        if (i === 2) {
          await svc.progressPublicSession(session.id, 1);
          continue;
        }
        const estimate = await svc.submitPublicEstimate(
          session.id,
          inputs[index]!,
        );
        if (i !== 3)
          await svc.capturePublicLead(
            session.id,
            contacts[(i + index) % contacts.length]!,
          );
        if (i === 4)
          await svc.updateEstimate(
            actor,
            org.id,
            estimate.id,
            "contacted",
            "Fictional demonstration: service details requested.",
          );
        if (i === 5)
          await svc.updateEstimate(
            actor,
            org.id,
            estimate.id,
            "qualified",
            "Fictional demonstration: scope confirmed.",
          );
        if (i === 6)
          await svc.updateEstimate(
            actor,
            org.id,
            estimate.id,
            "won",
            "Fictional demonstration: proposal accepted.",
          );
      }
    }
    console.log(
      "Acme Moving fictional demo is ready: three estimators, contacts, estimates and session analytics.",
    );
  }
} finally {
  await db.$disconnect();
}
