// Self-service reads limited to the signed-in member's own records.
import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUnitMember } from "./lib/authz";

const MAX_ROWS = 200;

export const myAssignments = query({
  args: { unitId: v.id("units") },
  handler: async (ctx, { unitId }) => {
    const { membership } = await requireUnitMember(ctx, unitId);
    const now = Date.now();
    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_unit_and_member", (q) => q.eq("unitId", unitId).eq("memberId", membership._id))
      .filter((q) => q.neq(q.field("status"), "closed"))
      .take(MAX_ROWS);

    const rows = await Promise.all(
      assignments.map(async (assignment) => {
        const item = await ctx.db.get(assignment.itemId);
        return {
          assignmentId: assignment._id,
          itemName: item?.name ?? "Unknown item",
          assetTag: item?.assetTag,
          quantityOutstanding: assignment.quantityIssued - assignment.quantityReturned,
          issuedAt: assignment.issuedAt,
          expectedReturnAt: assignment.expectedReturnAt,
          overdue: assignment.expectedReturnAt !== undefined && assignment.expectedReturnAt < now,
        };
      }),
    );
    return rows.sort(
      (a, b) => (a.expectedReturnAt ?? Infinity) - (b.expectedReturnAt ?? Infinity),
    );
  },
});
