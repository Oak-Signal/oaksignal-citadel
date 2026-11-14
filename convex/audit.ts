// Read access to the audit trail. There are intentionally no update or delete functions for
// `auditLog`; entries are written only by appendAudit() in convex/lib/audit.ts.
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUnitPermission } from "./lib/authz";

export const list = query({
  args: {
    unitId: v.id("units"),
    paginationOpts: paginationOptsValidator,
    actorId: v.optional(v.id("users")),
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    action: v.optional(v.string()),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireUnitPermission(ctx, args.unitId, "audit.view");
    const result = await ctx.db
      .query("auditLog")
      .withIndex("by_unit_and_time", (q) => {
        const unitRange = q.eq("unitId", args.unitId);
        if (args.from !== undefined && args.to !== undefined) {
          return unitRange.gte("occurredAt", args.from).lte("occurredAt", args.to);
        }
        if (args.from !== undefined) return unitRange.gte("occurredAt", args.from);
        if (args.to !== undefined) return unitRange.lte("occurredAt", args.to);
        return unitRange;
      })
      .order("desc")
      .filter((q) =>
        q.and(
          args.actorId ? q.eq(q.field("actorId"), args.actorId) : true,
          args.entityType ? q.eq(q.field("entityType"), args.entityType) : true,
          args.entityId ? q.eq(q.field("entityId"), args.entityId) : true,
          args.action ? q.eq(q.field("action"), args.action) : true,
        ),
      )
      .paginate(args.paginationOpts);

    const names = new Map<string, string>();
    for (const entry of result.page) {
      if (names.has(entry.actorId)) continue;
      const actor = await ctx.db.get(entry.actorId);
      names.set(entry.actorId, actor?.displayName ?? "Unknown user");
    }
    return {
      ...result,
      page: result.page.map((entry) => ({
        ...entry,
        actorName: names.get(entry.actorId) ?? "Unknown user",
      })),
    };
  },
});

// People who can appear as the actor filter: everyone with a membership in the unit.
export const actors = query({
  args: { unitId: v.id("units") },
  handler: async (ctx, args) => {
    await requireUnitPermission(ctx, args.unitId, "audit.view");
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_unit_and_user", (q) => q.eq("unitId", args.unitId))
      .take(500);
    const people = [];
    for (const membership of memberships) {
      const user = await ctx.db.get(membership.userId);
      if (user) people.push({ userId: user._id, name: user.displayName });
    }
    return people.sort((a, b) => a.name.localeCompare(b.name));
  },
});
