import { z } from "zod";
export const roles = ["owner", "admin", "sales", "viewer"] as const;
export type Role = (typeof roles)[number];
export type Permission =
  | "estimator.read"
  | "estimator.write"
  | "estimator.publish"
  | "estimate.read"
  | "estimate.create"
  | "organization.manage";
const permissions: Record<Role, readonly Permission[]> = {
  owner: [
    "estimator.read",
    "estimator.write",
    "estimator.publish",
    "estimate.read",
    "estimate.create",
    "organization.manage",
  ],
  admin: [
    "estimator.read",
    "estimator.write",
    "estimator.publish",
    "estimate.read",
    "estimate.create",
    "organization.manage",
  ],
  sales: ["estimator.read", "estimate.read", "estimate.create"],
  viewer: ["estimator.read", "estimate.read"],
};
export function hasPermission(role: string, permission: Permission): boolean {
  return (
    Object.hasOwn(permissions, role) &&
    permissions[role as Role].includes(permission)
  );
}
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
  branding: z
    .strictObject({
      displayName: z.string().max(100).optional(),
      primaryColor: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .optional(),
    })
    .default({}),
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
