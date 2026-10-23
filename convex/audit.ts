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
    action: v.optional(v.string()),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireUnitPermission(ctx, args.unitId, "audit.view");
    return await ctx.db
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
          args.action ? q.eq(q.field("action"), args.action) : true,
        ),
      )
      .paginate(args.paginationOpts);
  },
});
