"use server";
import { revalidatePath } from "next/cache";
import { requireActor } from "@/lib/session";
import { platform } from "@/lib/platform";
export type PlatformMutation = {
  ok?: boolean;
  secret?: string;
  error?: string;
};
export async function platformAction(
  org: string,
  operation: string,
  input: unknown,
): Promise<PlatformMutation> {
  const actor = await requireActor(),
    p = platform();
  try {
    let secret: string | undefined;
    const id = typeof input === "string" ? input : "";
    switch (operation) {
      case "key.create":
        secret = (await p.createKey(actor, org, input)).secret;
        break;
      case "key.revoke":
        await p.revokeKey(actor, org, id);
        break;
      case "webhook.create":
        secret = (await p.createWebhook(actor, org, input)).secret;
        break;
      case "webhook.disable":
        await p.deactivateWebhook(actor, org, id);
        break;
      case "webhook.retry":
        await p.retryWebhook(actor, org, id);
        break;
      case "domain.create":
        await p.createDomain(actor, org, id);
        break;
      case "domain.verify":
        await p.verifyDomain(actor, org, id);
        break;
      case "domain.remove":
        await p.removeDomain(actor, org, id);
        break;
      case "settings.update": {
        const parsed = input as {
          notifications: unknown;
          embedOrigins: unknown;
        };
        await p.updateSettings(actor, org, parsed);
        break;
      }
      case "lead.update": {
        const data = input as { id: string; contact: unknown };
        await p.updateLead(actor, org, data.id, data.contact);
        break;
      }
      case "estimate.send":
        await p.sendEstimate(actor, org, id);
        break;
      default:
        return { error: "invalid" };
    }
    revalidatePath(`/app/${org}`, "layout");
    return { ok: true, ...(secret ? { secret } : {}) };
  } catch {
    return { error: "invalid" };
  }
}
