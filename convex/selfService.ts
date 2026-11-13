// Self-service reads limited to the signed-in member's own records.
import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUnitMember } from "./lib/authz";
import { toRow } from "./requests";

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
          itemId: assignment.itemId,
          trackingMode: item?.trackingMode ?? "bulk",
          itemName: item?.name ?? "Unknown item",
          assetTag: item?.assetTag,
          quantityOutstanding: assignment.quantityIssued - assignment.quantityReturned,
          issuedAt: assignment.issuedAt,
          expectedReturnAt: assignment.expectedReturnAt,
          overdue: assignment.expectedReturnAt !== undefined && assignment.expectedReturnAt < now,
        };
      }),
    );
    return rows.sort((a, b) => (a.expectedReturnAt ?? Infinity) - (b.expectedReturnAt ?? Infinity));
  },
});

// Catalogue for the request form. Members without inventory access still need to choose an
// item, so this exposes only the fields needed to pick one.
export const requestableItems = query({
  args: { unitId: v.id("units") },
  handler: async (ctx, { unitId }) => {
    await requireUnitMember(ctx, unitId);
    const items = await ctx.db
      .query("items")
      .withIndex("by_unit", (q) => q.eq("unitId", unitId))
      .filter((q) => q.eq(q.field("archived"), false))
      .take(MAX_ROWS);
    return items
      .filter((item) => item.status === "available" || item.trackingMode === "bulk")
      .map((item) => ({
        itemId: item._id,
        name: item.name,
        assetTag: item.assetTag,
        trackingMode: item.trackingMode,
        quantityAvailable: item.quantityAvailable,
        restricted: item.restricted,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const myRequests = query({
  args: { unitId: v.id("units") },
  handler: async (ctx, { unitId }) => {
    const { membership } = await requireUnitMember(ctx, unitId);
    const requests = await ctx.db
      .query("requests")
      .withIndex("by_unit_and_requester", (q) =>
        q.eq("unitId", unitId).eq("requesterId", membership._id),
      )
      .order("desc")
      .take(MAX_ROWS);
    return await Promise.all(requests.map((request) => toRow(ctx, request)));
  },
});
