// Notifications. `notifyByPermission` targets every active member who holds a permission, so
// feature mutations (low stock, overdue, requests) never need to know who the recipients are.
import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { requireUser } from "./lib/authz";
import { forbidden, notFound } from "./lib/errors";
import { effectivePermissions, type Permission } from "./lib/permissions";
import { permissionValidator } from "./lib/validators";

export type NotificationInput = {
  unitId: Id<"units">;
  permission: Permission;
  type: string;
  title: string;
  body: string;
  link: string;
};

export async function notifyByPermission(
  ctx: MutationCtx,
  input: NotificationInput,
): Promise<number> {
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_unit_and_status", (q) => q.eq("unitId", input.unitId).eq("status", "active"))
    .collect();
  const definitions = await ctx.db
    .query("roleDefinitions")
    .withIndex("by_unit", (q) => q.eq("unitId", input.unitId))
    .collect();
  const overrides: Record<string, readonly string[]> = {};
  for (const definition of definitions) overrides[definition.key] = definition.permissions;

  const now = Date.now();
  let created = 0;
  for (const membership of memberships) {
    if (!effectivePermissions(membership, overrides).has(input.permission)) continue;
    await ctx.db.insert("notifications", {
      unitId: input.unitId,
      userId: membership.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
      createdAt: now,
    });
    created += 1;
  }
  return created;
}

export async function notifyUser(
  ctx: MutationCtx,
  input: Omit<NotificationInput, "permission"> & { userId: Id<"users"> },
): Promise<void> {
  await ctx.db.insert("notifications", {
    unitId: input.unitId,
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    link: input.link,
    createdAt: Date.now(),
  });
}

export const create = internalMutation({
  args: {
    unitId: v.id("units"),
    permission: permissionValidator,
    type: v.string(),
    title: v.string(),
    body: v.string(),
    link: v.string(),
  },
  handler: async (ctx, args) => await notifyByPermission(ctx, args),
});

// Recipient only: a user sees just their own notifications.
export const list = query({
  args: { unreadOnly: v.optional(v.boolean()) },
  handler: async (ctx, { unreadOnly }) => {
    const user = await requireUser(ctx);
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_unread", (q) =>
        unreadOnly ? q.eq("userId", user._id).eq("readAt", undefined) : q.eq("userId", user._id),
      )
      .order("desc")
      .take(50);
    return notifications;
  },
});

export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, { notificationId }) => {
    const user = await requireUser(ctx);
    const notification = await ctx.db.get(notificationId);
    if (!notification) throw notFound("Notification");
    if (notification.userId !== user._id) throw forbidden();
    if (notification.readAt === undefined)
      await ctx.db.patch(notificationId, { readAt: Date.now() });
  },
});
