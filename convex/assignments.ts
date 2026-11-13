// Equipment currently held by members. Rows are created and closed only by ledger
// transactions (transactions.issue / transactions.return); this module is read-only.
import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUnitPermission } from "./lib/authz";
import { notFound } from "./lib/errors";

const DAY_MS = 24 * 60 * 60 * 1000;
const DUE_SOON_DAYS = 3;
const MAX_ROWS = 500;

export type AssignmentState = "overdue" | "due_soon" | "outstanding";

// Overdue is derived from the expected return date at read time, so it is always current
// without a scheduled job rewriting assignment rows.
function stateOf(expectedReturnAt: number | undefined, now: number): AssignmentState {
  if (expectedReturnAt === undefined) return "outstanding";
  if (expectedReturnAt < now) return "overdue";
  if (expectedReturnAt - now <= DUE_SOON_DAYS * DAY_MS) return "due_soon";
  return "outstanding";
}

const STATE_ORDER: Record<AssignmentState, number> = { overdue: 0, due_soon: 1, outstanding: 2 };

export const listOutstanding = query({
  args: { unitId: v.id("units"), memberId: v.optional(v.id("memberships")) },
  handler: async (ctx, { unitId, memberId }) => {
    await requireUnitPermission(ctx, unitId, "members.viewAssignments");
    const now = Date.now();

    let assignments;
    if (memberId !== undefined) {
      const member = await ctx.db.get(memberId);
      if (!member || member.unitId !== unitId) throw notFound("Member");
      assignments = await ctx.db
        .query("assignments")
        .withIndex("by_unit_and_member", (q) => q.eq("unitId", unitId).eq("memberId", memberId))
        .filter((q) => q.neq(q.field("status"), "closed"))
        .take(MAX_ROWS);
    } else {
      const [open, partial, overdue] = await Promise.all(
        (["open", "partially_returned", "overdue"] as const).map((status) =>
          ctx.db
            .query("assignments")
            .withIndex("by_unit_and_status", (q) => q.eq("unitId", unitId).eq("status", status))
            .take(MAX_ROWS),
        ),
      );
      assignments = [...open, ...partial, ...overdue];
    }

    const memberNames = new Map<string, string>();
    const rows = await Promise.all(
      assignments.map(async (assignment) => {
        const item = await ctx.db.get(assignment.itemId);
        if (!memberNames.has(assignment.memberId)) {
          const membership = await ctx.db.get(assignment.memberId);
          const profile = membership ? await ctx.db.get(membership.userId) : null;
          memberNames.set(assignment.memberId, profile?.displayName ?? "Unknown");
        }
        return {
          assignmentId: assignment._id,
          itemId: assignment.itemId,
          itemName: item?.name ?? "Unknown item",
          assetTag: item?.assetTag,
          trackingMode: item?.trackingMode ?? "bulk",
          memberId: assignment.memberId,
          memberName: memberNames.get(assignment.memberId) ?? "Unknown",
          quantityIssued: assignment.quantityIssued,
          quantityReturned: assignment.quantityReturned,
          quantityOutstanding: assignment.quantityIssued - assignment.quantityReturned,
          issuedAt: assignment.issuedAt,
          expectedReturnAt: assignment.expectedReturnAt,
          state: stateOf(assignment.expectedReturnAt, now),
        };
      }),
    );

    return rows.sort(
      (a, b) =>
        STATE_ORDER[a.state] - STATE_ORDER[b.state] ||
        (a.expectedReturnAt ?? Infinity) - (b.expectedReturnAt ?? Infinity),
    );
  },
});
