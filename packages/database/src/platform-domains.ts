import { randomBytes } from "node:crypto";
import { resolveTxt } from "node:dns/promises";
import { audit } from "./access";
import { equalSecret } from "./crypto";
import { type PrismaClient } from "./index";
import { boundedDns, publicAddresses, publicHostname } from "./network";
import { createAdmin } from "./platform-context";
import { AccessDeniedError, ConflictError, type Actor } from "./services";
export function domainsServices(db: PrismaClient) {
  const admin = createAdmin(db);
  return {
    async listDomains(actor: Actor, org: string) {
      return admin(actor, org, (tx) =>
        tx.customDomain.findMany({
          where: { organizationId: org },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            hostname: true,
            status: true,
            errorCategory: true,
            verifyToken: true,
            createdAt: true,
            checkedAt: true,
          },
        }),
      );
    },
    async createDomain(actor: Actor, org: string, hostname: string) {
      const host = publicHostname(hostname),
        verifyToken = `oqs_domain_${randomBytes(24).toString("hex")}`;
      return admin(actor, org, async (tx) => {
        if (
          (await tx.customDomain.count({ where: { organizationId: org } })) >=
          10
        )
          throw new ConflictError("Domain limit reached");
        const row = await tx.customDomain.create({
          data: { organizationId: org, hostname: host, verifyToken },
        });
        await audit(tx, actor, org, "domain.created", row.id);
        return row;
      });
    },
    async verifyDomain(actor: Actor, org: string, id: string) {
      const domain = await admin(actor, org, async (tx) => {
        const d = await tx.customDomain.findFirst({
          where: { id, organizationId: org },
        });
        if (!d) throw new AccessDeniedError();
        return d;
      });
      let active = false;
      try {
        await publicAddresses(domain.hostname);
        const records = await boundedDns(resolveTxt(`_oqs.${domain.hostname}`));
        active = records.some((parts) =>
          equalSecret(parts.join(""), `v=OQS1;token=${domain.verifyToken}`),
        );
      } catch {
        active = false;
      }
      return admin(actor, org, async (tx) => {
        const row = await tx.customDomain.update({
          where: { id: domain.id },
          data: {
            status: active ? "active" : "error",
            errorCategory: active ? null : "dns_verification_failed",
            verifiedAt: active ? new Date() : null,
            checkedAt: new Date(),
          },
        });
        await audit(tx, actor, org, "domain.verified", id, { active });
        return row;
      });
    },
    async removeDomain(actor: Actor, org: string, id: string) {
      return admin(actor, org, async (tx) => {
        const row = await tx.customDomain.deleteMany({
          where: { id, organizationId: org },
        });
        if (!row.count) throw new AccessDeniedError();
        await audit(tx, actor, org, "domain.removed", id);
      });
    },
  };
}
