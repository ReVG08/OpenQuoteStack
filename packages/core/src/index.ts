import { z } from "zod";
export const roles = ["owner", "admin", "sales", "viewer"] as const;
export type Role = (typeof roles)[number];
export type Permission =
  | "estimator.read"
  | "estimator.write"
  | "estimator.publish"
  | "estimate.read"
  | "estimate.create"
  | "estimate.manage"
  | "organization.manage";
const permissions: Record<Role, readonly Permission[]> = {
  owner: [
    "estimator.read",
    "estimator.write",
    "estimator.publish",
    "estimate.read",
    "estimate.create",
    "estimate.manage",
    "organization.manage",
  ],
  admin: [
    "estimator.read",
    "estimator.write",
    "estimator.publish",
    "estimate.read",
    "estimate.create",
    "estimate.manage",
    "organization.manage",
  ],
  sales: [
    "estimator.read",
    "estimate.read",
    "estimate.create",
    "estimate.manage",
  ],
  viewer: ["estimator.read", "estimate.read"],
};
export function hasPermission(role: string, permission: Permission): boolean {
  return (
    Object.hasOwn(permissions, role) &&
    permissions[role as Role].includes(permission)
  );
}
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const asset = z
  .string()
  .regex(/^\/assets\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\.(png|jpg|webp)$/);
export const brandingSchema = z.strictObject({
  displayName: z.string().max(100).optional(),
  primaryColor: color.optional(),
  secondaryColor: color.optional(),
  backgroundColor: color.optional(),
  font: z.enum(["sans", "serif", "mono"]).optional(),
  buttonStyle: z.enum(["solid", "outline"]).optional(),
  radius: z.number().int().min(0).max(20).optional(),
  logo: asset.optional(),
  favicon: asset.optional(),
  businessAddress: z.string().max(500).optional(),
  email: z.union([z.email(), z.literal("")]).optional(),
  phone: z.string().max(80).optional(),
  website: z
    .union([z.url().refine((v) => /^https?:\/\//.test(v)), z.literal("")])
    .optional(),
});
export type Branding = z.infer<typeof brandingSchema>;
export const organizationInputSchema = z.strictObject({
  name: z.string().trim().min(2).max(100),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .min(2)
    .max(60),
  locale: z.enum(["en", "pt-BR"]),
  timezone: z
    .string()
    .max(100)
    .refine((v) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }, "Unknown timezone"),
  defaultCurrency: z.string().regex(/^[A-Z]{3}$/),
  branding: brandingSchema.default({}),
});
export type EventName =
  | "estimator.created"
  | "estimator.revision_created"
  | "estimator.published"
  | "estimate.started"
  | "estimate.completed"
  | "lead.created"
  | "estimate.status_changed";
export type DomainEvent = {
  id: string;
  name: EventName;
  organizationId: string;
  resourceId: string;
  occurredAt: string;
  actorId: string;
};
export type EventHandler = (
  event: Readonly<DomainEvent>,
) => void | Promise<void>;
/** Best-effort, in-process events. Handlers run after commit and cannot roll back writes. */
export class EventBus {
  private handlers = new Map<EventName, Set<EventHandler>>();
  subscribe(name: EventName, handler: EventHandler): () => void {
    const group = this.handlers.get(name) ?? new Set<EventHandler>();
    group.add(handler);
    this.handlers.set(name, group);
    return () => {
      group.delete(handler);
    };
  }
  async publish(event: DomainEvent): Promise<PromiseSettledResult<void>[]> {
    const immutable = Object.freeze({ ...event });
    return Promise.allSettled(
      [...(this.handlers.get(event.name) ?? [])].map((handler) =>
        Promise.resolve().then(() => handler(immutable)),
      ),
    );
  }
}

export const contactSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  email: z.email().max(250),
  phone: z.string().max(80).optional(),
  company: z.string().max(200).optional(),
  address: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});
