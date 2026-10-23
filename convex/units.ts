// Unit read functions for members. Unit creation and settings changes arrive with the unit
// management user story.
import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUnitMember, requireUser } from "./lib/authz";

export const get = query({
  args: { unitId: v.id("units") },
  handler: async (ctx, { unitId }) => {
    const { unit } = await requireUnitMember(ctx, unitId);
    return unit;
  },
});

// Only units where the caller has an active membership.
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const units = [];
    for (const membership of memberships) {
      if (membership.status !== "active") continue;
      const unit = await ctx.db.get(membership.unitId);
      if (unit) units.push({ unit, roles: membership.roles });
    }
    return units;
  },
});
