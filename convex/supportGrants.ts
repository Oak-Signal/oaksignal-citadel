// Support grants (FR-040): time-limited access for a platform administrator to act on one unit,
// verified by an Officer or Logistics Officer of that unit. Without a grant a platform
// administrator has no access to unit data.
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { appendAudit } from "./lib/audit";
import { requirePlatformAdmin } from "./lib/authz";
import { appError, forbidden, notFound, validation } from "./lib/errors";
import { normalizeEmail } from "./lib/members";
import { requireText } from "./lib/validators";

const MAX_GRANT_HOURS = 72;
const HOUR_MS = 60 * 60 * 1000;
const VERIFIER_ROLES = ["officer_staff", "logistics_officer"];

export const create = mutation({
  args: {
    unitId: v.id("units"),
    verifierEmail: v.string(),
    reason: v.string(),
    durationHours: v.number(),
  },
  handler: async (ctx, args) => {
    const admin = await requirePlatformAdmin(ctx);
    const reason = requireText(args.reason, "Reason");
    if (
      !Number.isInteger(args.durationHours) ||
      args.durationHours < 1 ||
      args.durationHours > MAX_GRANT_HOURS
    ) {
      throw validation(`Duration must be a whole number of hours from 1 to ${MAX_GRANT_HOURS}.`);
    }
    const email = normalizeEmail(args.verifierEmail);

    const matches = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();
    let verifierMembership = null;
    for (const candidate of matches) {
      if (candidate.anonymizedAt !== undefined) continue;
      const membership = await ctx.db
        .query("memberships")
        .withIndex("by_unit_and_user", (q) =>
          q.eq("unitId", args.unitId).eq("userId", candidate._id),
        )
        .unique();
      if (
        membership &&
        membership.status === "active" &&
        membership.roles.some((role) => VERIFIER_ROLES.includes(role))
      ) {
        verifierMembership = membership;
        break;
      }
    }
    if (!verifierMembership) {
      throw appError(
        "FORBIDDEN",
        "The verifier must be an active Officer Staff or Logistics Officer of this unit. No active member with that email and role was found.",
      );
    }

    const grantId = await ctx.db.insert("supportGrants", {
      unitId: args.unitId,
      platformAdminId: admin._id,
      verifiedByMembershipId: verifierMembership._id,
      reason,
      expiresAt: Date.now() + args.durationHours * HOUR_MS,
    });
    await appendAudit(ctx, {
      unitId: args.unitId,
      actorId: admin._id,
      action: "support_grant.create",
      entityType: "supportGrants",
      entityId: grantId,
      after: { verifiedByMembershipId: verifierMembership._id, durationHours: args.durationHours },
      reason,
    });
    return grantId;
  },
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const admin = await requirePlatformAdmin(ctx);
    const grants = await ctx.db
      .query("supportGrants")
      .withIndex("by_platform_admin", (q) => q.eq("platformAdminId", admin._id))
      .collect();
    const rows = [];
    for (const grant of grants) {
      const unit = await ctx.db.get(grant.unitId);
      rows.push({
        grantId: grant._id,
        unitId: grant.unitId,
        unitName: unit?.name ?? "Unknown unit",
        reason: grant.reason,
        expiresAt: grant.expiresAt,
      });
    }
    return rows;
  },
});

export const revoke = mutation({
  args: { grantId: v.id("supportGrants") },
  handler: async (ctx, { grantId }) => {
    const admin = await requirePlatformAdmin(ctx);
    const grant = await ctx.db.get(grantId);
    if (!grant) throw notFound("Support grant");
    if (grant.platformAdminId !== admin._id) throw forbidden();
    await ctx.db.delete(grantId);
    await appendAudit(ctx, {
      unitId: grant.unitId,
      actorId: admin._id,
      action: "support_grant.revoke",
      entityType: "supportGrants",
      entityId: grantId,
    });
  },
});
