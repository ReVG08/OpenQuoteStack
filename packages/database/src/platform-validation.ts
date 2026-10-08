import { z } from "zod";
import {
  apiScopes,
  webhookEvents,
  type ApiScope,
} from "@openquotestack/sdk/api-types";
export { apiScopes, webhookEvents, type ApiScope };
export const keyInput = z.strictObject({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(500).optional(),
  scopes: z
    .array(z.enum(apiScopes))
    .min(1)
    .max(5)
    .refine((a) => new Set(a).size === a.length),
});
export const webhookInput = z.strictObject({
  url: z.url().max(2000),
  subscriptions: z
    .array(z.enum(webhookEvents))
    .min(1)
    .max(6)
    .refine((a) => new Set(a).size === a.length),
});
export const notificationsInput = z.strictObject({
  notifyEmail: z.union([z.email(), z.literal("")]).default(""),
  customerConfirmation: z.boolean().default(false),
  footer: z.string().max(500).default(""),
});
export const embeddingInput = z
  .array(
    z
      .url()
      .max(250)
      .refine((s) => {
        const u = new URL(s);
        return u.origin === s && u.protocol === "https:";
      }),
  )
  .max(20)
  .refine((a) => new Set(a).size === a.length);
